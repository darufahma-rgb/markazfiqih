import { useState } from 'react';
import { Link, useParams, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Download, Loader2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { listMyEbooks, getEbookDownloadUrl } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { ShareButton } from '@/components/ShareButton';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/pages/CatalogPage';
import type { EbookCatalogItem } from '@/lib/db';

async function getEbookFromCatalog(id: string): Promise<EbookCatalogItem> {
  const { data, error } = await supabase
    .from('ebooks_catalog')
    .select('id, title, description, author, cover_image, price, discount_price')
    .eq('id', id)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    author: data.author,
    coverImage: data.cover_image,
    price: data.price,
    discountPrice: data.discount_price,
  };
}

function EbookDetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-10 py-8 flex flex-col md:flex-row gap-10">
      <Skeleton className="w-full md:w-64 shrink-0 aspect-[3/4] rounded-xl" />
      <div className="flex-1 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-12 w-48" />
      </div>
    </div>
  );
}

function EbookDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { ebookIdsInCart, addEbookToCart, isAdding } = useCart();
  const [, setLocation] = useLocation();
  const [isDownloading, setIsDownloading] = useState(false);

  const ebookQuery = useQuery({
    queryKey: ['ebook-catalog', id],
    queryFn: () => getEbookFromCatalog(id!),
    enabled: !!id,
  });

  const myEbooksQuery = useQuery({
    queryKey: ['my-ebooks', user?.id],
    queryFn: () => listMyEbooks(user!.id),
    enabled: !!user?.id,
  });

  const ebook = ebookQuery.data;
  const isOwned = myEbooksQuery.data?.some((e) => e.id === id) ?? false;
  const inCart = ebookIdsInCart.has(id ?? '');
  const hasDiscount = ebook?.discountPrice != null;

  const handleCartAction = async () => {
    if (!user) {
      setLocation(`/login?redirect=${encodeURIComponent(`/ebook/${id}`)}`);
      return;
    }
    if (inCart) {
      setLocation('/keranjang');
      return;
    }
    try {
      await addEbookToCart(id!);
      toast.success('Ebook berhasil ditambahkan ke keranjang');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menambahkan ke keranjang.');
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const url = await getEbookDownloadUrl(id!);
      window.open(url, '_blank');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuka link download.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AppShell>
      <div className="px-4 lg:px-10 pt-6">
        <Link
          href="/katalog"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Katalog
        </Link>
      </div>

      {ebookQuery.isLoading ? (
        <EbookDetailSkeleton />
      ) : !ebook ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Ebook tidak ditemukan</h2>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/katalog">Kembali ke Katalog</Link>
          </Button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-4xl mx-auto px-4 lg:px-10 py-6 pb-16 flex flex-col md:flex-row gap-10"
        >
          {/* Cover */}
          <div className="w-full md:w-64 shrink-0">
            <div className="aspect-[3/4] rounded-xl overflow-hidden bg-muted shadow-lg">
              {ebook.coverImage ? (
                <img src={ebook.coverImage} alt={ebook.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpen className="h-16 w-16 text-muted-foreground/40" />
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 flex flex-col gap-5">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/5">
                  Ebook
                </Badge>
                <ShareButton title={ebook.title} />
              </div>
              <h1 className="font-serif text-2xl lg:text-3xl font-bold text-foreground leading-snug">
                {ebook.title}
              </h1>
              {ebook.author && (
                <p className="text-muted-foreground mt-2 text-sm">oleh <span className="font-medium text-foreground">{ebook.author}</span></p>
              )}
            </div>

            {/* Price */}
            <div>
              {hasDiscount && (
                <span className="text-sm text-text-tertiary line-through block">
                  {formatPrice(ebook.price)}
                </span>
              )}
              <span className="text-3xl font-bold text-primary">
                {formatPrice(ebook.discountPrice ?? ebook.price)}
              </span>
            </div>

            {/* Description */}
            {ebook.description && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Tentang Ebook ini</h3>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {ebook.description}
                </p>
              </div>
            )}

            {/* CTA */}
            <div className="mt-auto">
              {isOwned ? (
                <Button onClick={handleDownload} disabled={isDownloading} size="lg" className="gap-2 min-w-[200px]">
                  {isDownloading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Membuka…</>
                  ) : (
                    <><Download className="h-4 w-4" /> Download Ebook</>
                  )}
                </Button>
              ) : (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }} className="inline-block">
                  <Button
                    onClick={handleCartAction}
                    disabled={isAdding}
                    size="lg"
                    className="gap-2 min-w-[200px]"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    {inCart ? 'Lihat di Keranjang' : 'Tambah ke Keranjang'}
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AppShell>
  );
}

export default function EbookDetailPage() {
  return <EbookDetailContent />;
}
