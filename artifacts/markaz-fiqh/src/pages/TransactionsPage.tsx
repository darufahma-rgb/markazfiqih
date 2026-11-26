import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Receipt } from 'lucide-react';

import { SEO } from '@/components/SEO';
import { AppShell } from '@/components/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/pages/CatalogPage';
import { listMyTransactions, type MyTransaction } from '@/lib/db';

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  paid: { label: 'Lunas', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending: { label: 'Menunggu Pembayaran', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  failed: { label: 'Gagal', className: 'bg-red-50 text-red-700 border-red-200' },
  expired: { label: 'Kedaluwarsa', className: 'bg-muted text-muted-foreground border-border' },
  cancelled: { label: 'Dibatalkan', className: 'bg-muted text-muted-foreground border-border' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TransactionCard({ trx }: { trx: MyTransaction }) {
  const status = STATUS_LABEL[trx.status] ?? { label: trx.status, className: 'bg-muted text-muted-foreground border-border' };
  const kindLabel = { kelas: 'Kelas', paket: 'Paket', ebook: 'E-Book' } as const;

  return (
    <Link
      href={`/pembayaran/${trx.id}`}
      className="block rounded-xl border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{formatDate(trx.createdAt)}</p>
          <p className="text-[11px] text-muted-foreground/70 font-mono truncate">#{trx.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <Badge variant="outline" className={`shrink-0 text-[11px] ${status.className}`}>
          {status.label}
        </Badge>
      </div>

      <ul className="mt-3 space-y-1.5">
        {trx.items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1.5">
                {kindLabel[item.kind]}
              </span>
              <span className="text-foreground">{item.title}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">{formatPrice(item.price)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 pt-3 border-t flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="flex items-center gap-1 font-bold text-foreground">
          {formatPrice(trx.totalAmount)}
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </span>
      </div>
    </Link>
  );
}

export default function TransactionsPage() {
  const { user } = useAuth();
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['my-transactions', user?.id],
    queryFn: () => listMyTransactions(user!.id),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  return (
    <AppShell>
      <SEO title="Riwayat Transaksi" description="Riwayat pembelian kelas, paket, dan e-book kamu." />
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl py-6 lg:py-10">
        <div className="mb-5">
          <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground">Riwayat Transaksi</h1>
          <p className="text-sm text-muted-foreground mt-1">Semua pembelian kelas, paket, dan e-book kamu.</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-xl border bg-card px-6 py-12 text-center space-y-3">
            <Receipt className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <p className="font-semibold text-foreground">Belum ada transaksi</p>
            <p className="text-sm text-muted-foreground">Kelas yang kamu beli akan tercatat di sini.</p>
            <Button asChild size="sm">
              <Link href="/katalog">Lihat Katalog</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((trx) => (
              <TransactionCard key={trx.id} trx={trx} />
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
