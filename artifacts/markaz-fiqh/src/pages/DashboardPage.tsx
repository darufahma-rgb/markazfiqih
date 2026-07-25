import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'wouter';
import {
  PlayCircle,
  BookOpen,
  Clock,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  Trophy,
  TrendingUp,
  Loader2,
} from 'lucide-react';

import { SEO } from '@/components/SEO';
import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { listEnrollments, listActiveDashboardMessages, getActiveDashboardBoard, type EnrollmentItem } from '@/lib/db';

// ── Dashboard Board Card ──────────────────────────────────────────────────────
function DashboardBoardCard() {
  const { data: board } = useQuery({
    queryKey: ['dashboard-board'],
    queryFn: getActiveDashboardBoard,
  });

  if (!board) return null;

  return (
    <div className="rounded-2xl border bg-card p-5 mb-6 text-center">
      <p className="font-serif text-base font-bold text-foreground mb-1">{board.title}</p>
      {board.content && (
        <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{board.content}</p>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 4 && h <= 10) return 'Selamat Pagi';
  if (h >= 11 && h <= 14) return 'Selamat Siang';
  if (h >= 15 && h <= 17) return 'Selamat Sore';
  return 'Selamat Malam';
}

const MOTIVASI_FALLBACK = 'Semoga ilmu yang dipelajari hari ini berkah.';

function formatTanggal(d: Date): string {
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatJam(d: Date): string {
  return d.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatDuration(min: number | null) {
  if (!min) return '-';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} jam ${m > 0 ? m + ' mnt' : ''}` : `${m} mnt`;
}

// ── KelasCard ─────────────────────────────────────────────────────────────────
function KelasCard({ enrollment, index }: { enrollment: EnrollmentItem; index: number }) {
  const cls = enrollment.class;
  const { totalDarsCount, completedDarsCount, totalDurationMinutes } = cls;
  const pct = totalDarsCount > 0 ? Math.round((completedDarsCount / totalDarsCount) * 100) : 0;
  const isComplete = totalDarsCount > 0 ? pct === 100 : enrollment.isCompleted;
  const learnUrl = `/learn/${cls.id}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col rounded-lg border bg-card shadow-sm hover:shadow-lg transition-friendly overflow-hidden"
    >
      {/* Cover */}
      <div className="relative aspect-video overflow-hidden bg-muted">
        <img
          src={cls.coverImage}
          alt={cls.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 right-3">
          {isComplete ? (
            <Badge className="bg-success-pale0 hover:bg-success-pale0 text-white gap-1 shadow">
              <Trophy className="w-3 h-3" />
              Tuntas
            </Badge>
          ) : pct > 0 ? (
            <Badge className="bg-primary hover:bg-primary text-white gap-1 shadow">
              <TrendingUp className="w-3 h-3" />
              Sedang Belajar
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 shadow">
              <BookOpen className="w-3 h-3" />
              Belum Dimulai
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5 gap-4">
        <p className="text-xs text-muted-foreground font-medium truncate">
          {cls.instructor.name}
        </p>

        <h3 className="font-serif text-lg font-bold text-foreground leading-snug line-clamp-2">
          {cls.title}
        </h3>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            {cls.moduleCount} modul · {totalDarsCount} pelajaran
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {formatDuration(totalDurationMinutes)}
          </span>
        </div>

        {/* Progress Tracker */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground text-xs">
              {completedDarsCount} dari {totalDarsCount} pelajaran selesai
            </span>
            <span
              className={`font-bold text-sm ${
                isComplete ? 'text-success' : pct > 0 ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {pct}% Selesai
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${isComplete ? 'bg-success-pale0' : 'bg-primary'}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: index * 0.1 + 0.2 }}
            />
          </div>
        </div>

        {/* CTA */}
        <div className="mt-auto pt-1">
          {isComplete ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 rounded-lg bg-success-pale border border-success-pale py-2.5 px-3">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                <span className="text-sm font-semibold text-success">
                  Semua pelajaran selesai! 🎉
                </span>
              </div>
              <motion.div className="w-full" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
                <Button asChild variant="outline" className="w-full gap-2 text-sm">
                  <Link href={learnUrl}>
                    <RotateCcw className="w-4 h-4" />
                    Tonton Ulang
                  </Link>
                </Button>
              </motion.div>
            </div>
          ) : pct > 0 ? (
            <motion.div className="w-full" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
              <Button asChild className="w-full gap-2 text-sm">
                <Link href={learnUrl}>
                  <PlayCircle className="w-4 h-4" />
                  Lanjutkan Belajar
                </Link>
              </Button>
            </motion.div>
          ) : (
            <motion.div className="w-full" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
              <Button asChild className="w-full gap-2 text-sm" variant="default">
                <Link href={learnUrl}>
                  <Sparkles className="w-4 h-4" />
                  Mulai Belajar
                </Link>
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Summary Stats Bar ─────────────────────────────────────────────────────────
function StatsSummary({ enrollments }: { enrollments: EnrollmentItem[] }) {
  const totalOwned = enrollments.length;
  const totalCompleted = enrollments.filter(
    (e) =>
      (e.class.totalDarsCount > 0 && e.class.completedDarsCount === e.class.totalDarsCount) ||
      (e.class.totalDarsCount === 0 && e.isCompleted),
  ).length;
  // Kelas video tunggal (totalDarsCount = 0) ikut disertakan: dianggap
  const totalDarsAcross = enrollments.reduce(
    (s, e) => s + (e.class.totalDarsCount > 0 ? e.class.totalDarsCount : 1),
    0,
  );
  const totalDoneDars = enrollments.reduce(
    (s, e) =>
      s + (e.class.totalDarsCount > 0 ? e.class.completedDarsCount : e.isCompleted ? 1 : 0),
    0,
  );
  const overallPct =
    totalDarsAcross > 0 ? Math.round((totalDoneDars / totalDarsAcross) * 100) : 0;
  const totalMinutes = enrollments.reduce((s, e) => s + (e.class.totalDurationMinutes ?? 0), 0);
  const totalJam = totalMinutes > 0
    ? totalMinutes >= 60
      ? `${Math.floor(totalMinutes / 60)} jam`
      : `${totalMinutes} mnt`
    : '-';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 rounded-xl border bg-card p-3.5 sm:p-4 shadow-sm">
      {[
        { label: 'Kelas Dimiliki',        value: totalOwned,        icon: BookOpen,    color: 'text-primary'    },
        { label: 'Kelas Tuntas',          value: totalCompleted,    icon: Trophy,      color: 'text-success'    },
        { label: 'Progress Keseluruhan',  value: `${overallPct}%`,  icon: TrendingUp,  color: 'text-brand-gold' },
        { label: 'Total Waktu Konten',    value: totalJam,          icon: Clock,       color: 'text-muted-foreground' },
      ].map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="text-center space-y-0.5">
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 mx-auto ${color}`} />
          <p className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</p>
          <p className="text-[11px] sm:text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Sidebar Progress Belajar ──────────────────────────────────────────────────
function ProgressSidebar({ enrollments }: { enrollments: EnrollmentItem[] }) {
  if (enrollments.length === 0) return null;

  return (
    <aside className="hidden lg:block sticky top-20 self-start">
      <div className="bg-card rounded-[14px] border p-5 shadow-sm">
        <p className="font-serif font-semibold mb-4">Progress Belajar</p>
        <div className="space-y-4">
          {enrollments.map((enrollment) => {
            const { totalDarsCount, completedDarsCount } = enrollment.class;
            const pct =
              totalDarsCount > 0
                ? Math.round((completedDarsCount / totalDarsCount) * 100)
                : enrollment.isCompleted ? 100 : 0;
            return (
              <div key={enrollment.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{enrollment.class.title}</p>
                  <span className="text-xs font-semibold text-muted-foreground shrink-0">
                    {pct}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
                  <motion.div
                    className={`h-full rounded-full ${pct === 100 ? 'bg-success' : 'bg-[hsl(var(--accent))]'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

// ── Halaman Utama ─────────────────────────────────────────────────────────────
function DashboardContent() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['enrollments', user?.id],
    queryFn: () => listEnrollments(user!.id),
    enabled: !!user?.id,
  });

  const { data: dashboardMessages = [] } = useQuery({
    queryKey: ['dashboard-messages'],
    queryFn: listActiveDashboardMessages,
    staleTime: 5 * 60 * 1000,
  });

  const motivasi = useMemo(() => {
    if (dashboardMessages.length === 0) return MOTIVASI_FALLBACK;
    return dashboardMessages[Math.floor(Math.random() * dashboardMessages.length)].message;
  }, [dashboardMessages]);

  const search = new URLSearchParams(window.location.search);
  const showEmpty = search.get('demo') === 'empty';
  const classesToShow = showEmpty ? [] : enrollments;

  const allInProgressEnrollments = classesToShow.filter((e) => {
    if (e.class.totalDarsCount === 0) return !e.isCompleted;
    const pct = Math.round((e.class.completedDarsCount / e.class.totalDarsCount) * 100);
    return pct < 100;
  });
  const inProgressEnrollments = allInProgressEnrollments.slice(0, 3);
  const hasMoreInProgress = allInProgressEnrollments.length > inProgressEnrollments.length;

  return (
    <AppShell>
      <SEO title="Dashboard — Kelas Markaz Fiqih" description="Dashboard area pembelajaran siswa Kelas Markaz Fiqih." />
      {/* Page header */}
      <div className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 pb-1 shrink-0">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--accent))] mb-1">
              {getGreeting()}
            </p>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground leading-tight">
              Assalamu'alaikum,{' '}
              {user?.nickname ?? user?.name?.split(' ')[0] ?? 'Sahabat'}!
            </h1>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">{motivasi}</p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0 pt-0.5 pr-12 lg:pr-14">
            <p className="text-xs text-muted-foreground">{formatTanggal(now)}</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">{formatJam(now)}</p>
          </div>
        </motion.div>
      </div>
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl py-3 sm:py-5 lg:py-6">
        <DashboardBoardCard />

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : classesToShow.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center text-center py-16 px-4 rounded-xl border bg-card"
          >
            <BookOpen className="w-10 h-10 text-primary/40 mx-auto mb-4" />
            <p className="text-base font-semibold text-foreground mb-1.5">
              Kamu belum memulai kelas apapun
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mb-5">
              Yuk mulai perjalanan belajarmu dari katalog kelas kami.
            </p>
            <motion.div className="inline-block" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
              <Button asChild size="default" className="gap-2">
                <Link href="/katalog">
                  <Sparkles className="w-4 h-4" />
                  Jelajahi Katalog
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        ) : (
          <div className="space-y-4 sm:space-y-5">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <StatsSummary enrollments={enrollments} />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
              <div className="space-y-4">
                {/* Lanjutkan Belajar */}
                {inProgressEnrollments.length > 0 && (
                  <div className="space-y-3">
                    <h2 className="font-serif text-lg sm:text-xl font-bold">Lanjutkan Belajar</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <AnimatePresence>
                        {inProgressEnrollments.map((enrollment, idx) => (
                          <KelasCard key={enrollment.id} enrollment={enrollment} index={idx} />
                        ))}
                      </AnimatePresence>
                    </div>
                    {hasMoreInProgress && (
                      <div className="flex justify-center sm:justify-start pt-1">
                        <motion.div className="inline-block" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
                          <Button asChild variant="outline" size="sm">
                            <Link href="/my-classes">Lihat Semua Kelas Saya</Link>
                          </Button>
                        </motion.div>
                      </div>
                    )}
                  </div>
                )}

                {/* Ajakan tambah kelas */}
                <div className="rounded-xl border-2 border-dashed bg-muted/20 flex flex-col sm:flex-row items-center gap-3.5 p-4 sm:p-5">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <p className="font-semibold text-foreground text-xs sm:text-sm">Tambah kelas baru</p>
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                      Masih banyak ilmu fiqih yang bisa dipelajari, temukan kelas lainnya di
                      katalog.
                    </p>
                  </div>
                  <motion.div className="inline-block shrink-0" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/katalog">Lihat Katalog</Link>
                    </Button>
                  </motion.div>
                </div>
              </div>

              <ProgressSidebar enrollments={enrollments} />
            </div>
          </div>
        )}
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © 2026 Markaz Fiqh. Semua Hak Dilindungi.
      </footer>
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
