import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayCircle,
  BookOpen,
  Clock,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  GraduationCap,
  Trophy,
  TrendingUp,
  Loader2,
  Search,
} from 'lucide-react';

import { SEO } from '@/components/SEO';
import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { listEnrollments, type EnrollmentItem } from '@/lib/db';

// ── Helpers ───────────────────────────────────────────────────────────────────
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
        <div className="absolute top-3 left-3">
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
        <div className="absolute top-3 right-3">
          <Badge className="bg-[hsl(var(--accent))] text-white text-[11px] flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Dimiliki
          </Badge>
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

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center text-center py-24 px-4"
    >
      <GraduationCap className="w-20 h-20 text-primary/40 mx-auto mb-8" />
      <h2 className="font-serif text-2xl font-bold text-foreground mb-3">
        Kamu Belum Memiliki Kelas
      </h2>
      <p className="text-muted-foreground max-w-sm leading-relaxed mb-8">
        Mulai perjalanan menuntut ilmu fiqih dengan memilih kelas yang sesuai kebutuhanmu.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <motion.div className="inline-block" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
          <Button asChild size="lg" className="gap-2">
            <Link href="/katalog">
              <Sparkles className="w-4 h-4" />
              Jelajahi Katalog
            </Link>
          </Button>
        </motion.div>
        <motion.div className="inline-block" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
          <Button asChild variant="outline" size="lg">
            <Link href="/katalog">Lihat Semua Kelas</Link>
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}

const CLASS_FILTERS = ['Semua', 'Fiqih Kitab', 'Fiqih Tematik', 'Akademi'];
const CATEGORY_ORDER = CLASS_FILTERS.filter((f) => f !== 'Semua');

// ── Section per Kategori (Grouping) ────────────────────────────────────────────
function CategorySection({
  category,
  items,
}: {
  category: string;
  items: EnrollmentItem[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-bold text-foreground">{category}</h2>
        <span className="text-sm text-muted-foreground">{items.length} kelas</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {items.map((enrollment, idx) => (
            <KelasCard key={enrollment.id} enrollment={enrollment} index={idx} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Halaman Utama ─────────────────────────────────────────────────────────────
function MyClassesContent() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState('Semua');
  const [search, setSearch] = useState('');

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['enrollments', user?.id],
    queryFn: () => listEnrollments(user!.id),
    enabled: !!user?.id,
  });

  const urlParams = new URLSearchParams(window.location.search);
  const showEmpty = urlParams.get('demo') === 'empty';
  const classesToShow = showEmpty ? [] : enrollments;

  // Terapkan filter pencarian judul sebelum filter kategori dan grouping.
  const q = search.trim().toLowerCase();
  const searched = q
    ? classesToShow.filter((e) => e.class.title.toLowerCase().includes(q))
    : classesToShow;

  // Saat filter kategori spesifik dipilih, tampilkan list flat kategori tsb saja
  // — diurutkan A-Z berdasarkan judul.
  const filteredClasses = useMemo(
    () =>
      (activeFilter === 'Semua'
        ? searched
        : searched.filter((e) => e.class.category === activeFilter)
      )
        .slice()
        .sort((a, b) => a.class.title.localeCompare(b.class.title, 'id', { sensitivity: 'base' })),
    [searched, activeFilter, search],
  );

  // Saat filter "Semua" aktif, kelompokkan kelas berdasarkan kategori —
  // hanya tampilkan heading kategori yang benar-benar punya kelas, dan
  // urutkan kelas A-Z di dalam tiap kelompok.
  const groupedByCategory = useMemo(() => {
    if (activeFilter !== 'Semua') return null;
    const groups = new Map<string, EnrollmentItem[]>();
    for (const e of searched) {
      const cat = e.class.category || 'Lainnya';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(e);
    }
    const knownKeys = CATEGORY_ORDER.filter((k) => groups.has(k));
    const restKeys = [...groups.keys()].filter((k) => !CATEGORY_ORDER.includes(k)).sort();
    return [...knownKeys, ...restKeys].map((category) => ({
      category,
      items: groups
        .get(category)!
        .slice()
        .sort((a, b) => a.class.title.localeCompare(b.class.title, 'id', { sensitivity: 'base' })),
    }));
  }, [searched, activeFilter, search]);

  return (
    <AppShell>
      <SEO title="Kelas Saya" />
      {/* Page header */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl pt-6 lg:pt-8 pb-2">
        <h1 className="font-serif text-3xl lg:text-4xl font-bold text-foreground">Kelas Saya</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Daftar kelas fiqih yang sedang dan telah Anda pelajari.
        </p>
      </div>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl py-6 lg:py-8 space-y-6">

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Cari di kelas saya..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-sm"
          />
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CLASS_FILTERS.map((filter) => (
            <motion.div key={filter} className="inline-block" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
              <Button
                size="sm"
                variant={activeFilter === filter ? 'default' : 'outline'}
                className="rounded-full"
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </Button>
            </motion.div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : classesToShow.length === 0 ? (
          <EmptyState />
        ) : searched.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20 gap-4">
            <BookOpen className="w-12 h-12 text-muted-foreground/40" />
            <p className="text-muted-foreground">
              Tidak ada kelas yang cocok dengan pencarianmu.
            </p>
            <Button size="sm" variant="outline" onClick={() => setSearch('')}>
              Reset Pencarian
            </Button>
          </div>
        ) : activeFilter === 'Semua' ? (
          <div className="space-y-10">
            {groupedByCategory!.map(({ category, items }) => (
              <CategorySection key={category} category={category} items={items} />
            ))}
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <BookOpen className="w-12 h-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">
              Belum ada kelas yang kamu miliki di kategori "{activeFilter}".
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl font-bold text-foreground">{activeFilter}</h2>
              <span className="text-sm text-muted-foreground">
                {filteredClasses.length} kelas
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredClasses.map((enrollment, idx) => (
                  <KelasCard key={enrollment.id} enrollment={enrollment} index={idx} />
                ))}
              </AnimatePresence>
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

export default function MyClassesPage() {
  return (
    <ProtectedRoute>
      <MyClassesContent />
    </ProtectedRoute>
  );
}
