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
  Lock,
  PlayCircle,
  PlaySquare,
  ShieldCheck,
  ShoppingCart,
  Users,
} from 'lucide-react';

import { SEO } from '@/components/SEO';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShareButton } from '@/components/ShareButton';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { formatPrice } from '@/data/mockClasses';
import { useQuery } from '@tanstack/react-query';
import { getClassById, listEnrollments, getClassEnrollmentStats } from '@/lib/db';
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

// ── Placeholder daftar dars per modul (data dars asli belum tersedia dari API) ─
// TODO: ganti dengan data dars asli dari backend setelah endpoint tersedia.
const PLACEHOLDER_DARS_PER_MODULE = 3;

// ── Detail Page ────────────────────────────────────────────────────────────
export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: cls, isLoading, isError } = useQuery({
    queryKey: ['class', id],
    queryFn: () => getClassById(id ?? ''),
    enabled: !!id,
  });
  const enrolledClassIdsQuery = useQuery({
    queryKey: ['enrolled-class-ids', user?.id],
    queryFn: async () => {
      const enrollments = await listEnrollments(user!.id);
      return new Set(enrollments.map((e) => e.class.id));
    },
    enabled: !!user?.id,
  });

  const { classIdsInCart, addToCart, isAdding } = useCart();
  const [, setLocation] = useLocation();

  const enrollmentStatsQuery = useQuery({
    queryKey: ['class-enrollment-stats'],
    queryFn: getClassEnrollmentStats,
    staleTime: 5 * 60 * 1000,
  });
  const enrollmentCount = enrollmentStatsQuery.data?.[cls?.id ?? '']?.enrolledCount ?? 0;

  useEffect(() => {
    if (cls && (window.location.pathname.startsWith('/class/') || id !== cls.slug)) {
      window.history.replaceState(null, '', `/kelas/${cls.slug}`);
    }
  }, [cls, id]);

  if (isLoading) return <ClassDetailLoading />;
  if (isError || !cls || cls.status !== 'published') return <ClassNotFound />;

  const inCart = classIdsInCart.has(cls.id);
  const isEnrolled = enrolledClassIdsQuery.data?.has(cls.id) ?? false;

  const handleBuyClick = async () => {
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
                  <span className="flex items-center gap-1.5 font-semibold text-primary">
                    <Users className="w-4 h-4" />
                    {enrollmentCount > 0 ? `${enrollmentCount} Pelajar Terdaftar` : 'Baru Rilis'}
                  </span>
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
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-lg">
                    {cls.instructor.name.charAt(0)}
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

              {/* Curriculum */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-2xl font-bold text-foreground">
                    Kurikulum
                  </h2>
                  {!(cls.youtubePlaylistId && cls.modules.length === 0) && (
                    <span className="text-sm text-muted-foreground">
                      {cls.moduleCount} modul
                    </span>
                  )}
                </div>

                {cls.youtubePlaylistId && cls.modules.length === 0 ? (
                  /* Playlist mode: no module/dars breakdown */
                  <div className="flex items-center gap-4 rounded-xl border bg-card px-5 py-4">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <PlaySquare className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">
                        Kelas ini berupa playlist video berkelanjutan
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Akses penuh playlist setelah kelas dibeli
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Normal mode: module/dars accordion */
                  <Accordion type="multiple" className="space-y-2">
                    {cls.modules.map((mod: any, modIdx: number) => (
                      <AccordionItem
                        key={mod.id}
                        value={mod.id}
                        className="border rounded-lg px-4 bg-card"
                      >
                        <AccordionTrigger className="hover:no-underline py-4 transition-colors duration-150">
                          <div className="flex items-center gap-3 text-left">
                            <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {mod.orderIndex}
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-foreground">
                                {mod.title}
                              </p>
                              {mod.durationMinutes != null && (
                                <p className="text-xs text-muted-foreground font-normal mt-0.5">
                                  {formatDuration(mod.durationMinutes)}
                                </p>
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-1">
                            {Array.from({ length: PLACEHOLDER_DARS_PER_MODULE }).map(
                              (_, darsIdx) => {
                                const globalDarsIndex =
                                  modIdx * PLACEHOLDER_DARS_PER_MODULE + darsIdx;
                                const isDoneDemo = globalDarsIndex < 3;

                                return (
                                  <div
                                    key={darsIdx}
                                    className="flex items-center gap-2.5 py-2 px-2 rounded-md text-sm text-muted-foreground"
                                  >
                                    {isEnrolled ? (
                                      isDoneDemo ? (
                                        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                                      ) : (
                                        <PlayCircle className="w-4 h-4 text-primary shrink-0" />
                                      )
                                    ) : (
                                      <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                                    )}
                                    <span>
                                      Pelajaran {darsIdx + 1}: {mod.title}
                                    </span>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </motion.div>
            </div>

            {/* ── Right Column: Purchase Card ── */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 rounded-xl border bg-card shadow-md overflow-hidden">
                {isEnrolled ? (
                  <>
                    {/* Progress Belajar */}
                    <div className="p-6 flex flex-col items-center gap-4 text-center">
                      <p className="text-sm font-semibold text-foreground">
                        Progress Belajar
                      </p>
                      <CircularProgress percent={75} />
                      <p className="text-xs text-muted-foreground">
                        3 dari {cls.moduleCount * PLACEHOLDER_DARS_PER_MODULE} pelajaran
                        selesai
                      </p>
                    </div>

                    <Separator />

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

                      {!user && (
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
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm px-4 py-3 flex items-center justify-between gap-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
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
        </div>
      )}
    </AppShell>
  );
}
