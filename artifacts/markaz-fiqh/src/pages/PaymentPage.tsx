import { useEffect, useState } from 'react';
import { Link, useRoute, useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Loader2, XCircle, ExternalLink } from 'lucide-react';

import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/pages/CatalogPage';
import { getInvoice } from '@/lib/db';
import { getPaymentStatus } from '@/lib/payments';

// ─────────────────────────────────────────────────────────────────────────────
// Halaman status pembayaran: /pembayaran/:invoiceId
//
// Dua peran sekaligus:
//   1. Tujuan redirect dari Mayar setelah user membayar (redirectUrl).
//   2. Struk pesanan yang bisa dibuka lagi kapan saja.
//
// Selama status masih 'pending', halaman ini menanyakan ulang tiap 4 detik.
// Server ikut mengecek ke Mayar, jadi webhook yang telat tidak bikin user
// terjebak di layar menunggu.
// ─────────────────────────────────────────────────────────────────────────────

function PaymentContent({ invoiceId }: { invoiceId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [waitedTooLong, setWaitedTooLong] = useState(false);

  const { data: status, isLoading } = useQuery({
    queryKey: ['payment-status', invoiceId],
    queryFn: () => getPaymentStatus(invoiceId),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 4000 : false),
  });

  const { data: invoice } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => getInvoice(invoiceId),
    enabled: status?.status === 'paid',
  });

  // Segarkan seluruh cache "milik user" begitu pembayaran masuk — bukan cuma
  // ['enrollments'] (dipakai Kelas Saya/Dashboard), tapi juga
  // ['enrolled-class-ids'] yang dipakai Katalog, Detail Kelas, Bundle, dan
  // Keranjang untuk menentukan status "sudah dimiliki", dan ['my-ebooks']
  // untuk pembelian e-book. Sebelumnya key ini tidak pernah disegarkan di
  // sini, jadi halaman-halaman itu tetap menampilkan "belum dimiliki" sampai
  // di-refresh manual walau pembayaran sudah masuk.
  useEffect(() => {
    if (status?.status !== 'paid' || !user) return;

    const refreshOwnedData = () => {
      queryClient.invalidateQueries({ queryKey: ['cart', user.id] });
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['enrolled-class-ids'] });
      queryClient.invalidateQueries({ queryKey: ['my-ebooks'] });
    };

    refreshOwnedData();

    // fulfillInvoice() menulis invoices.status='paid' DULU, baru membuat baris
    // enrollments/ebook_purchases sesudahnya (lihat _shared/fulfillment.ts).
    // Kalau transisi ini dipicu webhook Mayar (bukan polling kita sendiri),
    // ada jendela singkat di mana status sudah 'paid' tapi baris akses belum
    // tertulis — refetch pertama bisa menangkap data lama lalu terkunci
    // "fresh" selama staleTime. Ulangi sekali lagi setelah jeda untuk
    // menutup jendela balap itu.
    const retryId = setTimeout(refreshOwnedData, 2500);
    return () => clearTimeout(retryId);
  }, [status?.status, user, queryClient]);

  useEffect(() => {
    if (status?.status !== 'pending') return;
    const id = setTimeout(() => setWaitedTooLong(true), 90_000);
    return () => clearTimeout(id);
  }, [status?.status]);

  if (isLoading) {
    return (
      <main className="container mx-auto max-w-md px-4 py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50 mx-auto" />
      </main>
    );
  }

  // ── Lunas ─────────────────────────────────────────────────────────────────
  if (status?.status === 'paid') {
    return (
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="container mx-auto max-w-lg px-4 py-16 text-center"
      >
        <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-6" />
        <h1 className="font-serif text-2xl font-bold text-foreground mb-2">Pembayaran berhasil</h1>
        <p className="text-muted-foreground mb-8">
          Kelas kamu sudah terbuka. Selamat belajar.
        </p>

        <div className="rounded-xl border bg-card p-5 text-left space-y-3 mb-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Pesanan {invoiceId.slice(0, 8).toUpperCase()}
          </p>
          {invoice?.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-foreground line-clamp-1">{item.title}</span>
              <span className="text-muted-foreground shrink-0">{formatPrice(item.price)}</span>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between text-sm font-bold">
            <span>Total dibayar</span>
            <span className="text-primary">{formatPrice(status.totalAmount)}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg">
            <Link href="/my-classes">Mulai belajar</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/katalog">Lihat kelas lain</Link>
          </Button>
        </div>
      </motion.main>
    );
  }

  // ── Gagal / kedaluwarsa ───────────────────────────────────────────────────
  if (status?.status === 'failed') {
    return (
      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="container mx-auto max-w-md px-4 py-20 text-center"
      >
        <XCircle className="h-12 w-12 text-destructive/70 mx-auto mb-6" />
        <h1 className="font-serif text-2xl font-bold text-foreground mb-2">
          {status.reason === 'expired' ? 'Tagihan kedaluwarsa' : 'Pembayaran tidak selesai'}
        </h1>
        <p className="text-muted-foreground mb-8">
          {status.reason === 'expired'
            ? 'Batas waktu pembayaran sudah lewat. Buat tagihan baru dari keranjang.'
            : 'Dana kamu tidak terpotong. Silakan ulangi dari keranjang.'}
        </p>
        <Button size="lg" onClick={() => setLocation('/keranjang')}>
          Kembali ke keranjang
        </Button>
      </motion.main>
    );
  }

  // ── Menunggu ──────────────────────────────────────────────────────────────
  return (
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="container mx-auto max-w-md px-4 py-20 text-center"
    >
      <Clock className="h-12 w-12 text-primary/50 mx-auto mb-6" />
      <h1 className="font-serif text-2xl font-bold text-foreground mb-2">Menunggu pembayaran</h1>
      <p className="text-muted-foreground mb-2">
        Halaman ini berpindah sendiri begitu pembayaran kamu masuk. Tidak perlu menyegarkan.
      </p>
      <p className="text-sm text-text-tertiary mb-8">
        Total {formatPrice(status?.totalAmount ?? 0)}
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {status?.paymentUrl && (
          <Button asChild size="lg">
            <a href={status.paymentUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Lanjutkan pembayaran
            </a>
          </Button>
        )}
        <Button asChild size="lg" variant="outline">
          <Link href="/keranjang">Kembali ke keranjang</Link>
        </Button>
      </div>

      {waitedTooLong && (
        <p className="mt-8 text-xs text-muted-foreground leading-relaxed">
          Sudah bayar tapi status belum berubah? Bank kadang butuh beberapa menit. Simpan bukti
          transfer kamu — kalau lewat 15 menit masih begini, hubungi admin dengan menyebut kode
          pesanan <span className="font-mono font-semibold">{invoiceId.slice(0, 8).toUpperCase()}</span>.
        </p>
      )}
    </motion.main>
  );
}

export default function PaymentPage() {
  const [, params] = useRoute('/pembayaran/:invoiceId');
  const invoiceId = params?.invoiceId;

  return (
    <ProtectedRoute>
      <AppShell>
        {invoiceId ? (
          <PaymentContent invoiceId={invoiceId} />
        ) : (
          <main className="container mx-auto max-w-md px-4 py-24 text-center">
            <p className="text-muted-foreground">Pesanan tidak ditemukan.</p>
          </main>
        )}
      </AppShell>
    </ProtectedRoute>
  );
}
