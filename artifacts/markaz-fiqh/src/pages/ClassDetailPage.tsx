import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Infinity,
  Loader2,
  PlaySquare,
  ShieldCheck,
  ShoppingCart,
  Users,
  User,
} from 'lucide-react';

import { SEO } from '@/components/SEO';
import { AppShell } from '@/components/AppShell';
import { FormattedText } from '@/components/FormattedText';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShareButton } from '@/components/ShareButton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { formatPrice } from '@/data/mockClasses';
import { useQuery } from '@tanstack/react-query';
import { getClassById, listEnrollments, getVideoCompletions, listProgress } from '@/lib/db';
import { FacilitasCard } from '@/components/FacilitasCard';
import { ClassReviewSection } from '@/components/ClassReviewSection';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';

// ── Format duration ────────────────────────────────────────────────────────
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} menit`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} jam ${m} menit` : `${h} jam`;
}

// ── Not Found ──────────────────────────────────────────────────────────────
function ClassNotFound() {
  return (
    <AppShell>
      <main className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
        <BookOpen className="w-12 h-12 text-muted-foreground/50 mx-auto" />
        <h1 className="font-serif text-2xl font-bold">Kelas Tidak Ditemukan</h1>
        <p className="text-muted-foreground max-w-sm">
          Kelas yang kamu cari tidak tersedia atau belum dipublikasikan.
        </p>
        <Button asChild>
          <Link href="/katalog">Kembali ke Katalog</Link>
        </Button>
      </main>
    </AppShell>
  );
}

// ── Loading ────────────────────────────────────────────────────────────────
function ClassDetailLoading() {
  return (
    <AppShell>
      <main className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-4">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Memuat detail kelas...</p>
      </main>
    </AppShell>
  );
}

// ── Circular Progress (SVG manual, tanpa dependency tambahan) ───────────────
function CircularProgress({ percent }: { percent: number }) {
  const size = 120;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          className="stroke-muted"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="stroke-success transition-all duration-700 ease-out"
          fill="none"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-success">{percent}%</span>
      </div>
    </div>
  );
}

// ── Detail Page ────────────────────────────────────────────────────────────
export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: cls, isLoading, isError } = useQuery({
    queryKey: ['class', id],
    queryFn: () => getClassById(id ?? ''),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });
  const enrolledClassIdsQuery = useQuery({
    queryKey: ['enrolled-class-ids', user?.id],
    queryFn: async () => {
      const enrollments = await listEnrollments(user!.id);
      return new Set(enrollments.map((e) => e.class.id));
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000,
  });

  const { classIdsInCart, addToCart, isAdding } = useCart();
  const [, setLocation] = useLocation();


  // ── Progress Belajar (kartu beli) ──────────────────────────────────────────
  // Kelas berbasis playlist YouTube tidak punya modul/dars — dihitung dari
  // video_completions vs meeting_count. Kelas modul/bab dihitung dari tabel
  // progress vs jumlah dars asli. Hanya satu dari dua query ini yang aktif
  // sekaligus, tergantung jenis kelasnya.
  const isPlaylistClass = !!(cls && cls.youtubePlaylistId && cls.modules.length === 0);
  const { data: completedMeetings = new Set<number>() } = useQuery({
    queryKey: ['video-completions', user?.id, cls?.id],
    queryFn: () => getVideoCompletions(user!.id, cls!.id),
    enabled: !!user?.id && !!cls?.id && isPlaylistClass,
  });
  const { data: moduleProgressItems = [] } = useQuery({
    queryKey: ['progress', user?.id, cls?.id],
    queryFn: () => listProgress(user!.id, cls!.id),
    enabled: !!user?.id && !!cls?.id && !isPlaylistClass,
  });
  const progressTotal = isPlaylistClass ? cls?.meetingCount ?? 0 : (cls?.modules.flatMap((m: any) => m.dars).length ?? 0);
  const progressCompleted = isPlaylistClass
    ? completedMeetings.size
    : moduleProgressItems.filter((p) => p.isCompleted).length;
  const progressPct = progressTotal > 0 ? Math.round((progressCompleted / progressTotal) * 100) : 0;
  const showProgress = progressTotal > 0;

  useEffect(() => {
    if (cls) {
      const targetPath = `/kelas/${cls.slug}`;
      if (window.location.pathname !== targetPath && (window.location.pathname.startsWith('/class/') || id !== cls.slug)) {
        window.history.replaceState(null, '', targetPath);
      }
    }
  }, [cls, id]);

  if (isLoading && !cls) return <ClassDetailLoading />;
  if (isError || !cls || cls.status !== 'published') return <ClassNotFound />;

  const inCart = classIdsInCart.has(cls.id);
  const isEnrolled = enrolledClassIdsQuery.data?.has(cls.id) ?? false;

  // Kelas yang ditarik dari penjualan hanya bisa dibuka oleh yang sudah memilikinya.
  if (cls.salesStatus === 'withdrawn' && !isEnrolled) {
    if (user && enrolledClassIdsQuery.isLoading) return <ClassDetailLoading />;
    return <ClassNotFound />;
  }
  const isForSale = cls.salesStatus === 'open';

  const handleBuyClick = async () => {
    if (!isForSale) return;
    if (!user) {
      setLocation(`/login?redirect=${encodeURIComponent(`/class/${cls.id}`)}`);
      return;
    }
    if (inCart) {
      setLocation('/keranjang');
      return;
    }
    try {
      await addToCart(cls.id);
      toast.success('Berhasil ditambahkan ke keranjang');
    } catch (error) {
      console.error('Gagal menambahkan ke keranjang:', error);
      toast.error(error instanceof Error ? error.message : 'Gagal menambahkan ke keranjang. Coba lagi.');
    }
  };

  const hasDiscount = cls.discountPrice !== null;
  const totalMinutes = cls.totalDurationMinutes ?? 0;

  return (
    <AppShell>
      <SEO title={cls.title} description={cls.description} />
      <main className="flex-1 pb-20 lg:pb-0">
        {/* ── Breadcrumb ── */}
        <div className="border-b bg-muted/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl py-3">
            <Link
              href="/katalog"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors duration-150"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Kembali ke Katalog
            </Link>
          </div>
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl py-8 lg:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* ── Left Column: Main Content ── */}
            <div className="lg:col-span-2 space-y-8">
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {hasDiscount && (
                    <Badge className="bg-brand-gold-pale text-brand-gold-hover hover:bg-brand-gold-pale border-brand-gold-pale text-xs font-semibold">
                      Sedang Promo
                    </Badge>
                  )}
                  {isEnrolled && (
                    <Badge variant="success" className="text-xs font-semibold">
                      Terdaftar
                    </Badge>
                  )}
                  <ShareButton title={cls.title} />
                </div>
                <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground leading-tight">
                  {cls.title}
                </h1>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {cls.description}
                </p>

                {/* Quick stats row */}
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-1">
                  {cls.youtubePlaylistId && cls.modules.length === 0 ? (
                    cls.meetingCount ? (
                      <span className="flex items-center gap-1.5">
                        <PlaySquare className="w-4 h-4" />
                        {cls.meetingCount} Pertemuan
                      </span>
                    ) : null
                  ) : (
                    <>
                      <span className="flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4" />
                        {cls.moduleCount} modul
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        Total {formatDuration(totalMinutes)}
                      </span>
                    </>
                  )}
                  {cls.ownedCountDisplay != null && cls.ownedCountDisplay > 0 && (
                    <span className="flex items-center gap-1.5 font-semibold text-primary">
                      <Users className="w-4 h-4" />
                      Dimiliki {cls.ownedCountDisplay} Pelajar
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Infinity className="w-4 h-4" />
                    Akses seumur hidup
                  </span>
                </div>
              </motion.div>

              {/* Cover Image */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="aspect-video rounded-xl overflow-hidden bg-muted shadow-sm"
              >
                {cls.coverImage ? (
                  <img
                    src={cls.coverImage}
                    alt={cls.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <PlaySquare className="w-10 h-10 opacity-40" />
                    <span className="text-sm font-medium opacity-60">{cls.title}</span>
                  </div>
                )}
              </motion.div>

              {/* Instructor */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="flex items-start gap-4 p-5 rounded-xl border bg-card"
              >
                <Avatar className="w-14 h-14 shrink-0">
                  <AvatarImage src={cls.instructor.photoUrl} alt={cls.instructor.name} />
                  <AvatarFallback className="bg-muted text-muted-foreground">
                    <User className="h-7 w-7" strokeWidth={1.5} />
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Pengajar
                  </p>
                  <p className="font-serif font-bold text-lg text-foreground">
                    {cls.instructor.name}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {cls.instructor.bio}
                  </p>
                </div>
              </motion.div>

              {/* Tentang Kelas (menggantikan Kurikulum — isi diatur di Admin Panel) */}
              {cls.aboutText?.trim() && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.25 }}
                  className="space-y-3"
                >
                  <h2 className="font-serif text-2xl font-bold text-foreground">Tentang Kelas</h2>
                  <div className="rounded-xl border bg-card px-5 py-4">
                    <FormattedText text={cls.aboutText} className="text-sm text-foreground/85" />
                  </div>
                </motion.div>
              )}
            </div>

            {/* ── Right Column: Purchase Card ── */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 rounded-xl border bg-card shadow-md overflow-hidden">
                {isEnrolled ? (
                  <>
                    {/* Progress Belajar — disembunyikan kalau tidak ada data
                        akurat untuk dihitung (mis. kelas playlist yang admin
                        belum isi meeting_count-nya), daripada menampilkan
                        angka yang salah. */}
                    {showProgress && (
                      <>
                        <div className="p-6 flex flex-col items-center gap-4 text-center">
                          <p className="text-sm font-semibold text-foreground">
                            Progress Belajar
                          </p>
                          <CircularProgress percent={progressPct} />
                          <p className="text-xs text-muted-foreground">
                            {progressCompleted} dari {progressTotal}{' '}
                            {isPlaylistClass ? 'pertemuan' : 'pelajaran'} selesai
                          </p>
                        </div>

                        <Separator />
                      </>
                    )}

                    <div className="p-6">
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
                        <Button asChild size="lg" className="w-full text-base font-semibold">
                          <Link href={`/learn/${cls.id}`}>Lanjutkan Belajar</Link>
                        </Button>
                      </motion.div>
                    </div>

                    {(cls.gdriveMateriUrl || cls.waGroupUrl || cls.soalLatihanUrl || cls.ebookUrl || cls.testimoniFormUrl) && (
                      <>
                        <Separator />
                        <FacilitasCard
                          gdriveMateriUrl={cls.gdriveMateriUrl}
                          waGroupUrl={cls.waGroupUrl}
                          soalLatihanUrl={cls.soalLatihanUrl}
                          ebookUrl={cls.ebookUrl}
                          testimoniFormUrl={cls.testimoniFormUrl}
                        />
                      </>
                    )}

                    <Separator />
                  </>
                ) : (
                  <>
                    {/* Price section */}
                    <div className="p-6 space-y-1">
                      {hasDiscount ? (
                        <>
                          <p className="text-sm text-muted-foreground line-through">
                            {formatPrice(cls.basePrice)}
                          </p>
                          <p className="text-3xl font-bold text-primary">
                            {formatPrice(cls.discountPrice!)}
                          </p>
                          <Badge
                            variant="outline"
                            className="border-brand-gold text-brand-gold-hover text-xs mt-1"
                          >
                            Hemat{' '}
                            {formatPrice(cls.basePrice - cls.discountPrice!)}
                          </Badge>
                        </>
                      ) : (
                        <p className="text-3xl font-bold text-primary">
                          {formatPrice(cls.basePrice)}
                        </p>
                      )}
                    </div>

                    <Separator />

                    {/* CTA Button */}
                    <div className="p-6 space-y-4">
                      {!isForSale ? (
                        <div className="space-y-2 text-center">
                          <Button size="lg" variant="outline" className="w-full text-base font-semibold" disabled>
                            Tidak Dijual Sementara
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Kelas ini sedang tidak dibuka untuk pembelian.
                          </p>
                        </div>
                      ) : (
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
                        <Button
                          size="lg"
                          variant={inCart ? 'outline' : 'default'}
                          className="w-full text-base font-semibold gap-2"
                          disabled={isAdding}
                          onClick={handleBuyClick}
                        >
                          <AnimatePresence mode="wait">
                            <motion.span
                              key={inCart ? 'added' : 'add'}
                              initial={{ scale: 0, rotate: -90 }}
                              animate={{ scale: 1, rotate: 0 }}
                              exit={{ scale: 0, rotate: 90 }}
                              transition={{ duration: 0.2 }}
                              className="flex items-center"
                            >
                              {inCart ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <ShoppingCart className="w-4 h-4" />
                              )}
                            </motion.span>
                          </AnimatePresence>
                          {inCart ? 'Di Keranjang' : 'Tambah ke Keranjang'}
                        </Button>
                      </motion.div>
                      )}

                      {!user && isForSale && (
                        <p className="text-xs text-center text-muted-foreground">
                          Kamu akan diminta masuk dengan Google terlebih dahulu.
                        </p>
                      )}
                    </div>

                    <Separator />
                  </>
                )}

                {/* Class details */}
                <div className="p-6 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Yang kamu dapatkan
                  </p>

                  <div className="space-y-3 text-sm">
                    {cls.youtubePlaylistId && cls.modules.length === 0 ? (
                      cls.meetingCount ? (
                        <div className="flex items-start gap-2.5">
                          <PlaySquare className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          <span>
                            <strong>{cls.meetingCount}</strong> pertemuan video pelajaran
                          </span>
                        </div>
                      ) : null
                    ) : (
                      <>
                        <div className="flex items-start gap-2.5">
                          <BookOpen className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          <span>
                            <strong>{cls.moduleCount}</strong> modul video pelajaran
                          </span>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          <span>Total {formatDuration(totalMinutes)} materi video</span>
                        </div>
                      </>
                    )}
                    <div className="flex items-start gap-2.5">
                      <Infinity className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>Akses seumur hidup (lifetime)</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>Pembayaran aman via Mayar.id</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>Pelacak progres belajar otomatis</span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Users className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span>Akses grup diskusi pelajar</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Review & Ulasan */}
        <ClassReviewSection classId={cls.id} currentUserId={user?.id} />
      </main>

      {/* Footer — pb-20 lg:pb-0 memberi ruang dari sticky buy bar di mobile */}
      <footer className="border-t py-6 pb-24 lg:pb-6 text-center text-sm text-muted-foreground">
        © 2026 Markaz Fiqh. Semua Hak Dilindungi.
      </footer>

      {/* Mobile sticky buy bar — hanya muncul di bawah lg, disembunyikan jika sudah enrolled */}
      {!isEnrolled && (
        <div className="lg:hidden fixed bottom-[var(--bnav,0px)] left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm px-4 pt-3 pb-3 flex items-center justify-between gap-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <div className="min-w-0">
            {hasDiscount ? (
              <>
                <p className="text-[11px] text-muted-foreground line-through leading-none">
                  {formatPrice(cls.basePrice)}
                </p>
                <p className="text-lg font-bold text-primary leading-snug">
                  {formatPrice(cls.discountPrice!)}
                </p>
              </>
            ) : (
              <p className="text-lg font-bold text-primary leading-snug">
                {formatPrice(cls.basePrice)}
              </p>
            )}
          </div>
          {!isForSale ? (
            <span className="shrink-0 inline-flex items-center h-10 px-4 rounded-lg border border-border text-sm font-semibold text-muted-foreground">
              Tidak Dijual Sementara
            </span>
          ) : (
          <motion.button
            onClick={handleBuyClick}
            disabled={isAdding}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className={`shrink-0 inline-flex items-center justify-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
              inCart
                ? 'border border-border bg-background text-foreground hover:bg-muted'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {inCart ? (
              <>
                <Check className="w-4 h-4" />
                Di Keranjang
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                Tambah ke Keranjang
              </>
            )}
          </motion.button>
          )}
        </div>
      )}
    </AppShell>
  );
}
