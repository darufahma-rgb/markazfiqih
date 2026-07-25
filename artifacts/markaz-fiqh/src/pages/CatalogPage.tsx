import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Link, useSearch, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';

import {
  Search,
  ShoppingCart,
  Check,
  ArrowRight,
  CheckCircle2,
  BookOpen,
  Download,
} from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';

import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useQuery } from '@tanstack/react-query';
import { listClasses, listInstructors, listEnrollments, listClassRatings, getSettings, listEbooksCatalog, listMyEbooks } from '@/lib/db';
import type { EbookCatalogItem } from '@/lib/db';
import { StarRating } from '@/components/StarRating';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/AppShell';

function formatPrice(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDuration(totalMinutes: number | null): string | null {
  if (totalMinutes == null) return null;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0) return `${hours} jam${mins > 0 ? ` ${mins} menit` : ''}`;
  return `${totalMinutes} menit`;
}

export { formatPrice, formatDuration };


// ── Header ───────────────────────────────────────────────────────────────
function CatalogHeader() {
  const { user } = useAuth();
  const { count } = useCart();
  return (
    <div className="flex items-center justify-between px-4 lg:px-10 pt-6 lg:pt-8 pb-2">
      <h1 className="font-serif text-xl lg:text-[32px] font-bold text-foreground leading-tight">
        Jelajahi Kelas
      </h1>
      <div className="flex items-center gap-3">
        {user && (
          <Link
            href="/keranjang"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-friendly"
            aria-label="Keranjang"
          >
            <ShoppingCart className="h-5 w-5" />
            <AnimatePresence>
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                  className="absolute -top-1 -right-1 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[hsl(var(--accent))] px-1 text-[10px] font-bold leading-none text-white"
                >
                  {count > 9 ? '9+' : count}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        )}
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
          <NotificationBell />
        </motion.div>
        <Avatar className="h-9 w-9 border border-border">
          {user ? (
            <>
              <AvatarImage src={user.avatar_url} alt={user.name} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {user.name.split(' ').map((n) => n[0]).join('').substring(0, 2)}
              </AvatarFallback>
            </>
          ) : (
            <AvatarFallback className="bg-muted text-muted-foreground">?</AvatarFallback>
          )}
        </Avatar>
      </div>
    </div>
  );
}

// ── Instructor section ───────────────────────────────────────────────────
export function InstructorSection({
  instructors,
  isLoading,
  selectedInstructorId,
  onSelect,
}: {
  instructors: Array<{ id: string; name: string; photoUrl: string; classCount: number }>;
  isLoading: boolean;
  selectedInstructorId: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (!isLoading && instructors.length === 0) return null;

  return (
    <motion.section
      className="mb-8"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <h3 className="text-xl font-semibold text-foreground mb-4">Pengajar</h3>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 shrink-0 w-24">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))
          : instructors.map((instructor) => (
              <motion.button
                key={instructor.id}
                type="button"
                onClick={() =>
                  onSelect(selectedInstructorId === instructor.id ? null : instructor.id)
                }
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className={`flex flex-col items-center gap-2 shrink-0 w-24 p-2 rounded-lg transition-colors ${
                  selectedInstructorId === instructor.id
                    ? 'bg-[hsl(var(--accent))]/5 ring-1 ring-[hsl(var(--accent))]/40'
                    : 'hover:bg-muted'
                }`}
              >
                <Avatar className="h-12 w-12 border border-border">
                  <AvatarImage src={instructor.photoUrl} alt={instructor.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {instructor.name.split(' ').map((n) => n[0]).join('').substring(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm font-semibold text-foreground text-center leading-tight line-clamp-2">
                  {instructor.name}
                </p>
                <p className="text-xs text-muted-foreground">{instructor.classCount} Kelas</p>
              </motion.button>
            ))}
      </div>
    </motion.section>
  );
}

// ── Class card ───────────────────────────────────────────────────────────
export type ClassSummary = {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  basePrice: number;
  discountPrice: number | null;
  status: 'draft' | 'published';
  level: 'pemula' | 'menengah' | 'lanjutan' | null;
  category: string | null;
  instructor: { id: string; name: string; photoUrl: string };
  moduleCount: number;
  meetingCount: number | null;
  totalDurationMinutes: number | null;
  displayOrder?: number | null;
};

// Bullet checkmark row — reused inside ClassCard checklist
function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-foreground/80">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
        <Check className="h-2.5 w-2.5" />
      </span>
      <span className="truncate">{children}</span>
    </div>
  );
}

export function ClassCard({ cls, index, enrolledClassIds = new Set<string>(), ratingsMap = {} }: { cls: ClassSummary; index: number; enrolledClassIds?: Set<string>; ratingsMap?: Record<string, { averageRating: number; totalReviews: number }> }) {
  const classRating = ratingsMap[cls.id];
  const hasDiscount = cls.discountPrice != null;
  const durationLabel = formatDuration(cls.totalDurationMinutes);
  const { user } = useAuth();
  const { classIdsInCart, addToCart, isAdding } = useCart();
  const [, setLocation] = useLocation();
  const inCart = classIdsInCart.has(cls.id);

  const handleCartAction = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      setLocation(`/login?redirect=${encodeURIComponent('/katalog')}`);
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      exit={{ opacity: 0, scale: 0.97 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.3) }}
      layout
      className="h-full"
    >
      {/*
       * Card container: group for hover effects; button is a sibling of Link,
       * NOT nested inside it, to produce valid HTML (no interactive-in-interactive).
       */}
      <div className="group h-full flex flex-col rounded-lg border border-border bg-card overflow-hidden shadow-sm hover:shadow-lg transition-friendly">

        {/* Clickable area — image + content — navigates to class detail */}
        <Link href={`/class/${cls.id}`} className="flex flex-col flex-1">

          {/* Cover image */}
          <div className="relative aspect-video overflow-hidden bg-muted">
            <img
              src={cls.coverImage}
              alt={cls.title}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />

            {enrolledClassIds.has(cls.id) && (
              <div className="absolute top-3 right-3">
                <Badge className="bg-[hsl(var(--accent))] text-white text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Dimiliki
                </Badge>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-col flex-1 px-4 pt-4 pb-3 gap-2">
            {/* Title */}
            <h4 className="text-base font-semibold text-foreground leading-snug line-clamp-2 min-h-[2.75rem] group-hover:text-primary transition-colors">
              {cls.title}
            </h4>

            {/* Rating */}
            {classRating && classRating.totalReviews > 0 && (
              <div className="flex items-center gap-1.5">
                <StarRating rating={classRating.averageRating} size="sm" />
                <span className="text-xs text-muted-foreground font-medium">
                  {classRating.averageRating} ({classRating.totalReviews})
                </span>
              </div>
            )}

            {/* Separator */}
            <div className="border-t border-border" />

            {/* Checkmark detail list
                • moduleCount > 0  → modul-based: tampilkan modul + durasi (jika > 0)
                • meetingCount > 0 → playlist: tampilkan pertemuan + "Akses Selamanya"
                • keduanya 0/null  → tampilkan pengajar saja, sembunyikan baris kosong
            */}
            <div className="flex flex-col gap-1.5">
              {/* Baris 1: Pengajar — selalu tampil */}
              <CheckItem>{cls.instructor.name}</CheckItem>

              {cls.moduleCount > 0 ? (
                <>
                  {/* Kelas berbasis modul/dars */}
                  <CheckItem>{cls.moduleCount} Modul</CheckItem>
                  {(cls.totalDurationMinutes ?? 0) > 0 && (
                    <CheckItem>{durationLabel}</CheckItem>
                  )}
                </>
              ) : (cls.meetingCount ?? 0) > 0 ? (
                <>
                  {/* Kelas berbasis playlist YouTube */}
                  <CheckItem>{cls.meetingCount} Pertemuan</CheckItem>
                  <CheckItem>Akses Selamanya</CheckItem>
                </>
              ) : null}
            </div>

            {/* Price */}
            <div className="mt-auto pt-2">
              {hasDiscount ? (
                <>
                  <span className="text-[13px] text-text-tertiary line-through leading-tight block">
                    {formatPrice(cls.basePrice)}
                  </span>
                  <span className="text-lg font-bold text-primary leading-tight">
                    {formatPrice(cls.discountPrice!)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[13px] leading-tight invisible select-none block">&nbsp;</span>
                  <span className="text-lg font-bold text-foreground leading-tight">
                    {formatPrice(cls.basePrice)}
                  </span>
                </>
              )}
            </div>
          </div>
        </Link>

        {/* Full-width footer — sibling of Link, NOT nested inside it */}
        {enrolledClassIds.has(cls.id) ? (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
            <Link
              href={`/learn/${cls.id}`}
              className="w-full py-3 px-4 bg-[hsl(var(--accent))] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[hsl(var(--brand-gold-hover))] transition-colors"
            >
              Lanjutkan Belajar
              <ArrowRight className="h-4 w-4 shrink-0" />
            </Link>
          </motion.div>
        ) : (
          <motion.button
            onClick={handleCartAction}
            disabled={isAdding}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="w-full py-3 px-4 bg-gradient-to-r from-primary to-[hsl(var(--brand-red-hover))] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {inCart ? 'Lihat di Keranjang' : 'Tambah ke Keranjang'}
            <ArrowRight className="h-4 w-4 shrink-0" />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export function ClassCardSkeleton() {
  return (
    <div className="h-full flex flex-col rounded-lg border border-border bg-card overflow-hidden">
      {/* Cover image skeleton */}
      <Skeleton className="aspect-video w-full" />

      {/* Content skeleton */}
      <div className="px-4 pt-4 pb-3 flex flex-col gap-2.5 flex-1">
        {/* Title */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />

        {/* Separator */}
        <div className="border-t border-border" />

        {/* Checkmark list */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full shrink-0" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full shrink-0" />
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full shrink-0" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>

        {/* Price */}
        <div className="mt-auto pt-2">
          <Skeleton className="h-3 w-20 mb-1" />
          <Skeleton className="h-6 w-28" />
        </div>
      </div>

      {/* Footer button skeleton */}
      <Skeleton className="w-full h-11 rounded-none" />
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────
function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <motion.div
      key="empty"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="col-span-full flex flex-col items-center justify-center py-20 text-center"
    >
      <Search className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
      <p className="text-base text-muted-foreground max-w-sm">
        Belum ada kelas yang cocok dengan pencarianmu
      </p>
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }} className="inline-block mt-4">
        <Button variant="ghost" size="sm" onClick={onReset}>
          Reset Filter
        </Button>
      </motion.div>
    </motion.div>
  );
}

const DEFAULT_CATEGORY_ORDER = ['Fiqih Kitab', 'Fiqih Tematik', 'Akademi'];

const CATALOG_CATEGORY_FILTERS = [
  { label: 'Semua', value: 'all' },
  { label: 'Fiqih Kitab', value: 'Fiqih Kitab' },
  { label: 'Fiqih Tematik', value: 'Fiqih Tematik' },
  { label: 'Akademi', value: 'Akademi' },
  { label: 'Ebook', value: 'ebook' },
];

// ── Ebook card ────────────────────────────────────────────────────────────────
function EbookCard({
  ebook,
  index,
  ownedEbookIds,
}: {
  ebook: EbookCatalogItem;
  index: number;
  ownedEbookIds: Set<string>;
}) {
  const { user } = useAuth();
  const { ebookIdsInCart, addEbookToCart, isAdding } = useCart();
  const [, setLocation] = useLocation();
  const inCart = ebookIdsInCart.has(ebook.id);
  const isOwned = ownedEbookIds.has(ebook.id);
  const hasDiscount = ebook.discountPrice != null;

  const handleCartAction = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      setLocation(`/login?redirect=${encodeURIComponent('/katalog')}`);
      return;
    }
    if (isOwned) {
      setLocation('/ebook-saya');
      return;
    }
    if (inCart) {
      setLocation('/keranjang');
      return;
    }
    try {
      await addEbookToCart(ebook.id);
      toast.success('Ebook berhasil ditambahkan ke keranjang');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menambahkan ke keranjang.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      exit={{ opacity: 0, scale: 0.97 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.3) }}
      layout
      className="h-full"
    >
      <div className="group h-full flex flex-col rounded-lg border border-border bg-card overflow-hidden shadow-sm hover:shadow-lg transition-friendly">
        {/* Clickable area — navigasi ke detail ebook */}
        <Link href={`/ebook/${ebook.id}`} className="flex flex-col flex-1">
          {/* Cover */}
          <div className="relative aspect-video overflow-hidden bg-muted">
            {ebook.coverImage ? (
              <img
                src={ebook.coverImage}
                alt={ebook.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BookOpen className="h-10 w-10 text-muted-foreground/40" />
              </div>
            )}
            {isOwned && (
              <div className="absolute top-3 right-3">
                <Badge className="bg-[hsl(var(--accent))] text-white text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Dimiliki
                </Badge>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-col flex-1 px-4 pt-4 pb-3 gap-2">
            <h4 className="text-base font-semibold text-foreground leading-snug line-clamp-2 min-h-[2.75rem] group-hover:text-primary transition-colors">
              {ebook.title}
            </h4>

            <div className="border-t border-border" />

            {/* Author row — menggantikan info level/durasi pada kelas */}
            <div className="flex items-center gap-2 text-sm text-foreground/80">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                <BookOpen className="h-2.5 w-2.5" />
              </span>
              <span className="truncate">{ebook.author ?? 'Markaz Fiqih'}</span>
            </div>

            {/* Price */}
            <div className="mt-auto pt-2">
              {hasDiscount ? (
                <>
                  <span className="text-[13px] text-text-tertiary line-through leading-tight block">
                    {formatPrice(ebook.price)}
                  </span>
                  <span className="text-lg font-bold text-primary leading-tight">
                    {formatPrice(ebook.discountPrice!)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[13px] leading-tight invisible select-none block">&nbsp;</span>
                  <span className="text-lg font-bold text-foreground leading-tight">
                    {formatPrice(ebook.price)}
                  </span>
                </>
              )}
            </div>
          </div>
        </Link>

        {/* Footer button */}
        {isOwned ? (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
            <button
              onClick={handleCartAction}
              className="w-full py-3 px-4 bg-[hsl(var(--accent))] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[hsl(var(--brand-gold-hover))] transition-colors"
            >
              <Download className="h-4 w-4 shrink-0" />
              Baca / Download
            </button>
          </motion.div>
        ) : (
          <motion.button
            onClick={handleCartAction}
            disabled={isAdding}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="w-full py-3 px-4 bg-gradient-to-r from-primary to-[hsl(var(--brand-red-hover))] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {inCart ? 'Lihat di Keranjang' : 'Tambah ke Keranjang'}
            <ArrowRight className="h-4 w-4 shrink-0" />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

// ── Section per Kategori (Grouping saat "Semua Kategori" aktif) ────────────
function CategorySection({
  category,
  classes,
  enrolledClassIds,
  ratingsMap,
}: {
  category: string;
  classes: ClassSummary[];
  enrolledClassIds: Set<string>;
  ratingsMap: Record<string, { averageRating: number; totalReviews: number }>;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">{category}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {classes.map((cls, idx) => (
          <ClassCard key={cls.id} cls={cls} index={idx} enrolledClassIds={enrolledClassIds} ratingsMap={ratingsMap} />
        ))}
      </div>
    </div>
  );
}

// ── Halaman Katalog ───────────────────────────────────────────────────────
function CatalogContent() {
  const searchParamsString = useSearch();
  const initialCategory = useMemo(() => {
    const params = new URLSearchParams(searchParamsString);
    return params.get('category') ?? 'all';
  }, [searchParamsString]);

  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<'all' | 'pemula' | 'menengah' | 'lanjutan'>('all');
  const [category, setCategory] = useState<'all' | string>(initialCategory);
  const [sort, setSort] = useState<'alphabetical' | 'newest' | 'price_asc' | 'price_desc' | 'popular' | 'manual'>('alphabetical');
  const [selectedInstructorId, setSelectedInstructorId] = useState<string | null>(null);

  const { user } = useAuth();

  const isEbookTab = category === 'ebook';

  // ── Ebook queries (hanya aktif saat tab Ebook dipilih) ──────────────────
  const ebooksQuery = useQuery({
    queryKey: ['ebooks-catalog', search],
    queryFn: listEbooksCatalog,
    enabled: isEbookTab,
    staleTime: 5 * 60 * 1000,
  });

  const myEbooksQuery = useQuery({
    queryKey: ['my-ebooks', user?.id],
    queryFn: () => listMyEbooks(user!.id),
    enabled: isEbookTab && !!user?.id,
  });

  const ownedEbookIds = new Set((myEbooksQuery.data ?? []).map((e) => e.id));

  // Filter ebook by search (client-side, data kecil)
  const ebookList = (ebooksQuery.data ?? []).filter((e) =>
    search.trim() ? e.title.toLowerCase().includes(search.toLowerCase()) : true,
  );

  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const CATEGORY_ORDER = settingsQuery.data?.catalogCategoryOrder?.length
    ? settingsQuery.data.catalogCategoryOrder
    : DEFAULT_CATEGORY_ORDER;

  const enrolledClassIdsQuery = useQuery({
    queryKey: ['enrolled-class-ids', user?.id],
    queryFn: async () => {
      const enrollments = await listEnrollments(user!.id);
      return new Set(enrollments.map((e) => e.class.id));
    },
    enabled: !!user?.id,
  });
  const enrolledClassIds = enrolledClassIdsQuery.data ?? new Set<string>();

  const classesQuery = useQuery({
    queryKey: ['classes', search, level, category, selectedInstructorId],
    queryFn: () => listClasses({
      search: search || undefined,
      level: level === 'all' ? undefined : level,
      category: category === 'all' ? undefined : category,
      instructorId: selectedInstructorId ?? undefined,
    }),
  });
  const instructorsQuery = useQuery({
    queryKey: ['instructors'],
    queryFn: listInstructors,
  });

  const ratingsQuery = useQuery({
    queryKey: ['class-ratings'],
    queryFn: listClassRatings,
    staleTime: 5 * 60 * 1000,
  });
  const ratingsMap = ratingsQuery.data ?? {};

  const classes = (classesQuery.data ?? []) as ClassSummary[];
  const rawInstructors = instructorsQuery.data ?? [];
  const instructors = rawInstructors.map((inst) => ({
    ...inst,
    classCount: classes.filter((cls) => cls.instructor?.id === inst.id).length,
  }));

  const sortedClasses = useMemo(() => {
    const arr = [...classes];
    switch (sort) {
      case 'alphabetical':
        arr.sort((a, b) => a.title.localeCompare(b.title, 'id'));
        break;
      case 'manual':
        arr.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
        break;
      case 'price_asc':
        arr.sort((a, b) => (a.discountPrice ?? a.basePrice) - (b.discountPrice ?? b.basePrice));
        break;
      case 'price_desc':
        arr.sort((a, b) => (b.discountPrice ?? b.basePrice) - (a.discountPrice ?? a.basePrice));
        break;
      case 'popular':
        arr.sort((a, b) => b.moduleCount - a.moduleCount);
        break;
      case 'newest':
      default:
        break; // sudah diurutkan by created_at DESC dari Supabase
    }
    const notOwned = arr.filter((c) => !enrolledClassIds.has(c.id));
    const owned = arr.filter((c) => enrolledClassIds.has(c.id));
    return [...notOwned, ...owned];
  }, [classes, sort, enrolledClassIds]);

  const isLoading = classesQuery.isLoading;
  const isEmpty = !isLoading && classes.length === 0;

  // Saat "Semua Kategori" aktif, kelompokkan kelas berdasarkan kategori —
  // hanya tampilkan heading kategori yang benar-benar punya kelas.
  const groupedByCategory = useMemo(() => {
    if (category !== 'all') return null;
    const groups = new Map<string, ClassSummary[]>();
    for (const cls of sortedClasses) {
      const cat = cls.category || 'Lainnya';
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(cls);
    }
    const knownKeys = CATEGORY_ORDER.filter((k) => groups.has(k));
    const restKeys = [...groups.keys()].filter((k) => !CATEGORY_ORDER.includes(k)).sort();
    return [...knownKeys, ...restKeys].map((cat) => ({ category: cat, classes: groups.get(cat)! }));
  }, [sortedClasses, category, CATEGORY_ORDER]);

  const handleReset = () => {
    setSearch('');
    setLevel('all');
    setCategory('all');
    setSort('alphabetical');
    setSelectedInstructorId(null);
  };

  const hasActiveFilters = useMemo(
    () => Boolean(search || level !== 'all' || category !== 'all' || selectedInstructorId),
    [search, level, category, selectedInstructorId],
  );

  return (
    <AppShell>
      <CatalogHeader />
      <main className="px-4 lg:px-10 py-6 lg:py-8 max-w-[1400px]">

        {/* Search + filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Cari kelas fiqih..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-sm"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {/* Filter Level disembunyikan saat tab Ebook aktif — ebook tidak punya level */}
            {!isEbookTab && (
              <Select value={level} onValueChange={(v) => setLevel(v as typeof level)}>
                <SelectTrigger className="h-9 w-auto min-w-[110px] rounded-full px-4 text-[13px] border-secondary-border bg-secondary">
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Level</SelectItem>
                  <SelectItem value="pemula">Pemula</SelectItem>
                  <SelectItem value="menengah">Menengah</SelectItem>
                  <SelectItem value="lanjutan">Lanjutan</SelectItem>
                </SelectContent>
              </Select>
            )}

            {!isEbookTab && (
              <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                <SelectTrigger className="h-9 w-auto min-w-[110px] rounded-full px-4 text-[13px] border-secondary-border bg-secondary">
                  <SelectValue placeholder="Urutkan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alphabetical">A-Z</SelectItem>
                  <SelectItem value="newest">Terbaru</SelectItem>
                  <SelectItem value="price_asc">Terhemat</SelectItem>
                  <SelectItem value="price_desc">Termahal</SelectItem>
                  <SelectItem value="popular">Terpopuler</SelectItem>
                  <SelectItem value="manual">Urutan Admin</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Category pill filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATALOG_CATEGORY_FILTERS.map((f) => (
            <motion.div key={f.value} className="inline-block" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
              <Button
                size="sm"
                variant={category === f.value ? 'default' : 'outline'}
                className="rounded-full"
                onClick={() => setCategory(f.value)}
              >
                {f.label}
              </Button>
            </motion.div>
          ))}
        </div>

        {/* Instruktur hanya ditampilkan saat tab kelas aktif */}
        {!isEbookTab && (
          <InstructorSection
            instructors={instructors}
            isLoading={instructorsQuery.isLoading}
            selectedInstructorId={selectedInstructorId}
            onSelect={setSelectedInstructorId}
          />
        )}

        {/* ── Ebook grid (tab Ebook aktif) ─────────────────────────────── */}
        {isEbookTab && (
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <h2 className="text-xl font-semibold text-foreground mb-4">Semua Ebook</h2>
            {ebooksQuery.isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {Array.from({ length: 4 }).map((_, i) => <ClassCardSkeleton key={i} />)}
              </div>
            ) : ebookList.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <BookOpen className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-base text-muted-foreground max-w-sm">
                  {search ? 'Tidak ada ebook yang cocok dengan pencarianmu' : 'Belum ada ebook yang tersedia'}
                </p>
                {search && (
                  <Button variant="ghost" size="sm" onClick={() => setSearch('')} className="mt-4">
                    Reset Pencarian
                  </Button>
                )}
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {ebookList.map((ebook, idx) => (
                  <EbookCard key={ebook.id} ebook={ebook} index={idx} ownedEbookIds={ownedEbookIds} />
                ))}
              </div>
            )}
          </motion.section>
        )}

        {/* ── Class grid (tab kelas aktif) ──────────────────────────────── */}
        {!isEbookTab && (
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {isLoading ? (
            <>
              <h2 className="text-xl font-semibold text-foreground mb-4">Semua Kelas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {Array.from({ length: 8 }).map((_, i) => <ClassCardSkeleton key={i} />)}
              </div>
            </>
          ) : isEmpty ? (
            <>
              <h2 className="text-xl font-semibold text-foreground mb-4">Semua Kelas</h2>
              <EmptyState
                onReset={hasActiveFilters ? handleReset : () => window.location.reload()}
              />
            </>
          ) : groupedByCategory ? (
            <div className="space-y-10">
              {groupedByCategory.map(({ category: cat, classes: catClasses }) => (
                <CategorySection
                  key={cat}
                  category={cat}
                  classes={catClasses}
                  enrolledClassIds={enrolledClassIds}
                  ratingsMap={ratingsMap}
                />
              ))}
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-foreground mb-4">{category}</h2>
              <AnimatePresence mode="popLayout">
                <motion.div
                  layout
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
                >
                  {sortedClasses.map((cls, idx) => (
                    <ClassCard key={cls.id} cls={cls} index={idx} enrolledClassIds={enrolledClassIds} ratingsMap={ratingsMap} />
                  ))}
                </motion.div>
              </AnimatePresence>
            </>
          )}
        </motion.section>
        )}
      </main>
    </AppShell>
  );
}

export default function CatalogPage() {
  return <CatalogContent />;
}
