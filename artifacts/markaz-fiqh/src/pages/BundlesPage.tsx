import { toast } from 'sonner';
import { Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Package2, ShoppingCart, Tag, ArrowRight } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { listBundles, listEnrollments } from '@/lib/db';
import type { BundleItem } from '@/lib/db';
import { formatPrice } from '@/pages/CatalogPage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShareButton } from '@/components/ShareButton';
import { Skeleton } from '@/components/ui/skeleton';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { SEO } from '@/components/SEO';
import { AppShell } from '@/components/AppShell';

// ── Header ────────────────────────────────────────────────────────────────────

function BundlesHeader() {
  const { user } = useAuth();
  const { count } = useCart();
  return (
    <div className="flex items-center justify-between px-4 lg:px-10 pt-6 lg:pt-8 pb-2">
      <div>
        <h1 className="font-serif text-xl lg:text-[32px] font-bold text-foreground leading-tight">
          Paket Bundle
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Beli beberapa kelas sekaligus dengan harga lebih hemat
        </p>
      </div>
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
                className="absolute -top-1 -right-1 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground"
              >
                {count > 9 ? '9+' : count}
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      )}
    </div>
  );
}

// ── Kartu Bundle ──────────────────────────────────────────────────────────────

function BundleCard({
  bundle,
  index,
  enrolledClassIds,
}: {
  bundle: BundleItem;
  index: number;
  enrolledClassIds: Set<string>;
}) {
  const { user } = useAuth();
  const { bundleIdsInCart, addBundleToCart, isAdding } = useCart();
  const [, setLocation] = useLocation();

  const inCart = bundleIdsInCart.has(bundle.id);
  const hemat = bundle.normalPrice - bundle.bundlePrice;
  const persen = Math.round((hemat / bundle.normalPrice) * 100);
  const hasOwnedClass = bundle.classes.some((cls) => enrolledClassIds.has(cls.id));

  const handleCartAction = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      setLocation(`/login?redirect=${encodeURIComponent('/paket-bundle')}`);
      return;
    }
    if (inCart) {
      setLocation('/keranjang');
      return;
    }
    try {
      await addBundleToCart(bundle.id);
      toast.success('Paket bundle berhasil ditambahkan ke keranjang');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Gagal menambahkan ke keranjang. Coba lagi.',
      );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.3) }}
      layout
      className="h-full"
    >
      <div className="h-full flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
        {/* Cover image */}
        <div className="aspect-video rounded-t-xl overflow-hidden bg-muted">
          {bundle.coverImage ? (
            <img
              src={bundle.coverImage}
              alt={bundle.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
              <Package2 className="w-10 h-10 text-primary/30" />
            </div>
          )}
        </div>

        {/* Header kartu */}
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <Package2 className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-serif text-lg font-bold text-foreground leading-tight">
                {bundle.title}
              </h3>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {persen > 0 && (
                <Badge className="shrink-0 bg-green-100 text-green-700 border-green-200 text-[11px] font-semibold">
                  Hemat {persen}%
                </Badge>
              )}
              <ShareButton title={bundle.title} url={`${window.location.origin}/paket-bundle`} />
            </div>
          </div>
          {bundle.description && (
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {bundle.description}
            </p>
          )}
        </div>

        {/* Daftar kelas — chip grid, natural height, no flex-1 */}
        <div className="px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">
            {bundle.classes.length} Kelas di dalamnya
          </p>
          <div className="flex flex-wrap gap-1.5">
            {bundle.classes.map((cls) => (
              <span
                key={cls.id}
                className="inline-flex items-center px-2.5 py-1 rounded-full bg-white border border-border text-xs font-medium text-foreground/80"
              >
                {cls.title}
              </span>
            ))}
          </div>
        </div>

        {/* Harga — mt-auto mendorong ke bawah card, sebelum footer button */}
        <div className="mt-auto px-5 pb-3 pt-3 border-t border-border">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(bundle.normalPrice)}
            </span>
          </div>
          <span className="text-xl font-bold text-primary leading-tight">
            {formatPrice(bundle.bundlePrice)}
          </span>
        </div>

        {/* Full-width gradient footer button — konsisten dengan ClassCard */}
        <motion.button
          onClick={handleCartAction}
          disabled={isAdding || hasOwnedClass}
          whileHover={{ scale: hasOwnedClass ? 1 : 1.02 }}
          whileTap={{ scale: hasOwnedClass ? 1 : 0.98 }}
          transition={{ duration: 0.15 }}
          className="w-full py-3 px-4 bg-gradient-to-r from-primary to-[hsl(var(--brand-red-hover))] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {inCart ? 'Lihat di Keranjang' : 'Tambah ke Keranjang'}
          <ArrowRight className="h-4 w-4 shrink-0" />
        </motion.button>
        {hasOwnedClass && (
          <p className="text-[11px] text-muted-foreground text-center px-4 py-2 leading-relaxed">
            Kamu sudah memiliki beberapa kelas dalam paket ini, hubungi admin untuk info lebih lanjut.
          </p>
        )}
      </div>
    </motion.div>
  );
}

function BundleCardSkeleton() {
  return (
    <div className="h-full flex flex-col rounded-xl border border-border bg-card overflow-hidden">
      <div className="aspect-video bg-muted animate-pulse rounded-t-xl" />
      <div className="px-5 pt-5 pb-4 border-b border-border space-y-2">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-3 w-full" />
      </div>
      <div className="flex-1 px-5 py-4 space-y-2">
        <Skeleton className="h-3 w-28 mb-3" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
      {/* Price skeleton */}
      <div className="px-5 pb-3 pt-3 border-t border-border space-y-1">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-6 w-28" />
      </div>
      {/* Footer button skeleton */}
      <Skeleton className="w-full h-11 rounded-none" />
    </div>
  );
}

function EmptyBundles() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="col-span-full flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Package2 className="w-7 h-7 text-muted-foreground" />
      </div>
      <p className="text-base text-muted-foreground max-w-sm">
        Belum ada paket bundle yang tersedia saat ini.
      </p>
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }} className="inline-block mt-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/katalog">Lihat Kelas Individual</Link>
        </Button>
      </motion.div>
    </motion.div>
  );
}

// ── Konten Halaman ────────────────────────────────────────────────────────────

function BundlesContent() {
  const { user } = useAuth();
  const bundlesQuery = useQuery({
    queryKey: ['bundles'],
    queryFn: listBundles,
  });
  const enrolledClassIdsQuery = useQuery({
    queryKey: ['enrolled-class-ids', user?.id],
    queryFn: async () => {
      const enrollments = await listEnrollments(user!.id);
      return new Set(enrollments.map((e) => e.class.id));
    },
    enabled: !!user?.id,
  });

  const bundles = bundlesQuery.data ?? [];
  const isLoading = bundlesQuery.isLoading;
  const enrolledClassIds = enrolledClassIdsQuery.data ?? new Set<string>();

  return (
    <AppShell>
      <SEO title="Paket Bundle" />
      <BundlesHeader />
      <main className="px-6 lg:px-10 py-8 max-w-[1400px]">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {isLoading && Array.from({ length: 3 }).map((_, i) => <BundleCardSkeleton key={i} />)}

          {!isLoading && bundles.length === 0 && <EmptyBundles />}

          {!isLoading &&
            bundles.map((bundle, idx) => (
              <BundleCard key={bundle.id} bundle={bundle} index={idx} enrolledClassIds={enrolledClassIds} />
            ))}
        </div>
      </main>
    </AppShell>
  );
}

export default function BundlesPage() {
  return <BundlesContent />;
}
