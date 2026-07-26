import { useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Download, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { listMyEbooks, getEbookDownloadUrl } from '@/lib/db';
import { SEO } from '@/components/SEO';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice } from '@/pages/CatalogPage';

// ── Skeleton card ─────────────────────────────────────────────────────────────
function EbookCardSkeleton() {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card overflow-hidden">
      <Skeleton className="aspect-[3/4] w-full" />
      <div className="p-4 flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-10 w-full mt-2" />
      </div>
    </div>
  );
}

// ── Individual ebook card ─────────────────────────────────────────────────────
function MyEbookCard({ ebook }: { ebook: { id: string; title: string; author: string | null; coverImage: string | null; price: number; discountPrice: number | null } }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const url = await getEbookDownloadUrl(ebook.id);
      window.open(url, '_blank');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuka link download.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col rounded-lg border border-border bg-card overflow-hidden shadow-sm hover:shadow-lg transition-shadow"
    >
      {/* Cover */}
      <div className="aspect-[3/4] overflow-hidden bg-muted">
        {ebook.coverImage ? (
          <img
            src={ebook.coverImage}
            alt={ebook.title}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 px-4 pt-4 pb-3 gap-1.5">
        <h4 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 min-h-[2.5rem]">
          {ebook.title}
        </h4>
        {ebook.author && (
          <p className="text-xs text-muted-foreground">{ebook.author}</p>
        )}
        <p className="text-sm font-bold text-foreground mt-auto pt-2">
          {formatPrice(ebook.discountPrice ?? ebook.price)}
        </p>
      </div>

      {/* Download button */}
      <Button
        onClick={handleDownload}
        disabled={isDownloading}
        className="m-3 mt-0 gap-2"
      >
        {isDownloading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Membuka…
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Download Ebook
          </>
        )}
      </Button>
    </motion.div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyEbooks() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
      <h2 className="text-lg font-semibold text-foreground mb-2">Belum ada ebook</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        Ebook yang kamu beli akan muncul di sini. Yuk jelajahi katalog ebook kami!
      </p>
      <Button asChild>
        <a href="/katalog?category=ebook">Jelajahi Ebook</a>
      </Button>
    </motion.div>
  );
}

// ── Page content ──────────────────────────────────────────────────────────────
function MyEbooksContent() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const ebooksQuery = useQuery({
    queryKey: ['my-ebooks', user?.id],
    queryFn: () => listMyEbooks(user!.id),
    enabled: !!user?.id,
  });

  const ebooks = ebooksQuery.data ?? [];
  const filtered = (search.trim()
    ? ebooks.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()))
    : ebooks
  )
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title, 'id', { sensitivity: 'base' }));

  return (
    <AppShell>
      <SEO title="Ebook Saya" description="Daftar ebook digital fiqih yang kamu miliki di Kelas Markaz Fiqih." />
      <div className="px-4 lg:px-10 pt-6 lg:pt-8 pb-2">
        <h1 className="font-serif text-xl lg:text-[32px] font-bold text-foreground leading-tight">
          Ebook Saya
        </h1>
      </div>

      <main className="px-4 lg:px-10 py-6 lg:py-8 max-w-[1400px]">
        {/* Search */}
        {!ebooksQuery.isLoading && ebooks.length > 0 && (
          <div className="relative max-w-sm mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="search"
              placeholder="Cari ebook…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-11 w-full rounded-sm border border-input bg-background pl-10 pr-4 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        )}

        {/* Grid */}
        {ebooksQuery.isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
            {Array.from({ length: 5 }).map((_, i) => <EbookCardSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyEbooks />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
            {filtered.map((ebook) => (
              <MyEbookCard key={ebook.id} ebook={ebook} />
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}

export default function MyEbooksPage() {
  return (
    <ProtectedRoute>
      <MyEbooksContent />
    </ProtectedRoute>
  );
}
