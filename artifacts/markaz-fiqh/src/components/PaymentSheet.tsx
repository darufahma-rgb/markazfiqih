import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Loader2, ShieldCheck, ExternalLink, CheckCircle2, X, WifiOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getPaymentStatus, type PaymentStatus } from '@/lib/payments';
import { formatPrice } from '@/pages/CatalogPage';

// ─────────────────────────────────────────────────────────────────────────────
// Panel pembayaran. User tidak pernah meninggalkan situs: halaman metode
// pembayaran Mayar tampil di dalam panel ini, dengan rangka, warna, dan status
// milik kita sendiri.
//
// Kalau timeout terlewati, panel menampilkan pesan koneksi lambat + tombol
// "Buka di jendela terpisah" — iframe tetap berusaha memuat di belakang.
// Kalau iframe akhirnya selesai, pesan disembunyikan otomatis.
//
// Atur lewat env: VITE_MAYAR_EMBED=false → langsung pakai mode jendela
// (dengan tombol yang harus diklik user — tidak auto-open).
// ─────────────────────────────────────────────────────────────────────────────

const EMBED_ENABLED = import.meta.env.VITE_MAYAR_EMBED !== 'false';
const IFRAME_TIMEOUT_MS = 25_000;

type Props = {
  invoiceId: string;
  paymentUrl: string;
  totalAmount: number;
  expiresAt: string | null;
  onPaid: (status: PaymentStatus) => void;
  onClose: () => void;
};

function useCountdown(expiresAt: string | null): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (ms <= 0) return setLabel('00:00:00');
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setLabel([h, m, s].map((n) => String(n).padStart(2, '0')).join(':'));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return label;
}

export function PaymentSheet({
  invoiceId,
  paymentUrl,
  totalAmount,
  expiresAt,
  onPaid,
  onClose,
}: Props) {
  // 'embed'  → iframe di dalam panel
  // 'window' → jendela terpisah, panel menunggu status
  const [mode, setMode] = useState<'embed' | 'window'>(EMBED_ENABLED ? 'embed' : 'window');
  const [frameReady, setFrameReady] = useState(false);
  const [slowConn, setSlowConn] = useState(false); // timeout terlewati, koneksi lambat
  const startedAtRef = useRef(Date.now());
  const popupRef = useRef<Window | null>(null);
  const countdown = useCountdown(expiresAt);

  // Polling status. Server ikut menanyakan ke Mayar tiap kali dipanggil,
  // jadi ini bekerja walaupun webhook belum sampai.
  const { data: status } = useQuery({
    queryKey: ['payment-status', invoiceId],
    queryFn: () => getPaymentStatus(invoiceId),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 4000 : false),
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (status?.status === 'paid') {
      popupRef.current?.close();
      onPaid(status);
    }
  }, [status, onPaid]);

  // Timeout: setelah IFRAME_TIMEOUT_MS tampilkan pesan koneksi lambat,
  // tapi JANGAN pindah ke mode window dan JANGAN auto-open popup.
  useEffect(() => {
    if (mode !== 'embed') return;
    const id = setTimeout(() => {
      if (!frameReady) {
        console.info('[PaymentSheet] iframe timeout: batas tunggu terlewati, koneksi mungkin lambat');
        setSlowConn(true);
      }
    }, IFRAME_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [mode, frameReady]);

  const openWindow = () => {
    console.info('[PaymentSheet] user memilih buka di jendela terpisah');
    popupRef.current = window.open(paymentUrl, 'mayar-payment', 'width=480,height=760,noopener');
    // popup diblokir browser — tidak redirect paksa, cukup biarkan user coba lagi
    if (!popupRef.current) {
      console.info('[PaymentSheet] popup diblokir browser — tidak ada redirect paksa');
    }
  };

  const handleOpenWindow = () => {
    setMode('window');
    openWindow();
  };

  const handleFrameLoad = () => {
    const elapsed = Date.now() - startedAtRef.current;
    console.info(`[PaymentSheet] iframe berhasil dimuat dalam ${elapsed} ms`);
    setFrameReady(true);
    setSlowConn(false); // kalau lambat lalu akhirnya muat, sembunyikan pesan
  };

  const isPaid = status?.status === 'paid';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full sm:max-w-md bg-card rounded-t-2xl sm:rounded-2xl border shadow-xl overflow-hidden flex flex-col max-h-[92vh] pb-[var(--sab)] sm:pb-0"
        role="dialog"
        aria-modal="true"
        aria-label="Pembayaran"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b bg-muted/30">
          <div>
            <p className="font-serif text-lg font-bold text-foreground leading-tight">
              Selesaikan pembayaran
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Total <span className="font-semibold text-foreground">{formatPrice(totalAmount)}</span>
              {countdown && <span className="text-text-tertiary"> · sisa waktu {countdown}</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Isi */}
        <div className="relative flex-1 min-h-[420px] bg-background">
          {isPaid ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <CheckCircle2 className="h-10 w-10 text-success mb-3" />
              <p className="font-serif text-xl font-bold text-foreground">Pembayaran diterima</p>
              <p className="text-sm text-muted-foreground mt-1">Membuka kelas kamu…</p>
            </div>
          ) : mode === 'embed' ? (
            <>
              {/* Overlay loading / pesan koneksi lambat — tampil selama iframe belum siap */}
              {!frameReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center z-10 bg-background">
                  {slowConn ? (
                    <>
                      <WifiOff className="h-7 w-7 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-foreground">
                          Metode pembayaran lama dimuat.
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                          Koneksi kamu mungkin sedang lambat. Halaman pembayaran masih dicoba
                          dimuat di belakang.
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={handleOpenWindow}>
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Buka di jendela terpisah
                      </Button>
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
                      <p className="text-sm text-muted-foreground">Menyiapkan metode pembayaran…</p>
                    </>
                  )}
                </div>
              )}
              {/* iframe tetap terpasang — terus berusaha memuat walau timeout */}
              <iframe
                src={paymentUrl}
                title="Pembayaran"
                onLoad={handleFrameLoad}
                allow="payment *"
                className="w-full h-[480px] border-0"
              />
            </>
          ) : (
            /* Mode jendela terpisah */
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 gap-4">
              {popupRef.current ? (
                <>
                  <Loader2 className="h-7 w-7 animate-spin text-primary/60" />
                  <div>
                    <p className="font-semibold text-foreground">Menunggu pembayaran</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      Selesaikan pembayaran di jendela yang terbuka. Halaman ini akan berpindah
                      sendiri begitu pembayaran masuk.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={openWindow}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Buka lagi jendela pembayaran
                  </Button>
                </>
              ) : (
                /* VITE_MAYAR_EMBED=false → belum ada popup, minta user klik */
                <>
                  <ExternalLink className="h-7 w-7 text-primary/60" />
                  <div>
                    <p className="font-semibold text-foreground">Buka halaman pembayaran</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      Klik tombol di bawah untuk membuka jendela pembayaran. Halaman ini akan
                      berpindah sendiri begitu pembayaran masuk.
                    </p>
                  </div>
                  <Button size="sm" onClick={openWindow}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Buka jendela pembayaran
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t bg-muted/30 flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Transaksi dienkripsi &amp; diproses Mayar
          </p>
          {mode === 'embed' && !isPaid && (
            <button
              onClick={handleOpenWindow}
              className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 shrink-0"
            >
              Buka di jendela terpisah
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
