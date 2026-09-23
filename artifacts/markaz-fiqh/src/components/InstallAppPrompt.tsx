import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, EllipsisVertical, PlusSquare, Share, X, Zap, Bell, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import {
  clearInstallPrompt,
  getInstallPrompt,
  isInAppBrowser,
  isIos,
  isMobileDevice,
  isStandalone,
  subscribeInstallPrompt,
} from '@/lib/pwa';

// Pop-up "Pasang aplikasi" untuk user yang sudah login di HP.
// Muncul sekali per sesi browser (setiap kali user membuka situs dalam keadaan
// login), tidak muncul kalau situs sudah dibuka sebagai aplikasi, dan tidak
// mengganggu di halaman login / onboarding / pembayaran.

const SHOW_DELAY_MS = 1500;
const SESSION_KEY = 'mf-install-prompt-shown';
const HIDDEN_ON_PATHS = [/^\/login/, /^\/onboarding-nama/, /^\/checkout/, /^\/pembayaran\//, /^\/admin/];

function alreadyShownThisSession() {
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}

function markShownThisSession() {
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* mode privat — abaikan */ }
}

export function InstallAppPrompt() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const installPrompt = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt, () => null);

  const blockedPath = HIDDEN_ON_PATHS.some((re) => re.test(location));

  useEffect(() => {
    if (isLoading || !user || blockedPath) return;
    if (!isMobileDevice() || isStandalone() || alreadyShownThisSession()) return;
    const t = setTimeout(() => {
      markShownThisSession();
      setOpen(true);
    }, SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [user, isLoading, blockedPath]);

  // Tutup otomatis kalau user pindah ke halaman yang tidak cocok (mis. checkout)
  useEffect(() => {
    if (blockedPath) setOpen(false);
  }, [blockedPath]);

  const handleInstall = async () => {
    const prompt = getInstallPrompt();
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    // Prompt hanya bisa dipakai sekali; browser menampilkan status pemasangannya sendiri
    clearInstallPrompt();
    setOpen(false);
  };

  const ios = typeof navigator !== 'undefined' && isIos();
  const inApp = typeof navigator !== 'undefined' && isInAppBrowser();

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-app-title"
            className="relative w-full max-w-md bg-card rounded-t-3xl border-t shadow-2xl px-5 pt-3 pb-[calc(1.25rem+var(--sab))]"
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted-foreground/25" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 p-2 rounded-full text-muted-foreground hover:bg-muted"
              aria-label="Tutup"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-4">
              <img src="/icon-192.png" alt="" className="h-16 w-16 rounded-2xl shadow-md shrink-0" />
              <div className="min-w-0">
                <h2 id="install-app-title" className="font-serif text-lg font-bold leading-tight text-foreground">
                  Pasang Aplikasi Markaz Fiqih
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">Gratis · tanpa Play Store / App Store</p>
              </div>
            </div>

            <ul className="mt-5 space-y-2.5 text-sm text-foreground">
              <li className="flex items-center gap-3">
                <Smartphone className="h-4 w-4 text-primary shrink-0" /> Buka kelas langsung dari layar utama HP
              </li>
              <li className="flex items-center gap-3">
                <Zap className="h-4 w-4 text-primary shrink-0" /> Tampil layar penuh, lebih cepat tanpa bar browser
              </li>
              <li className="flex items-center gap-3">
                <Bell className="h-4 w-4 text-primary shrink-0" /> Tetap login, tinggal lanjut belajar
              </li>
            </ul>

            <div className="mt-5">
              {inApp ? (
                <Steps
                  title="Buka dulu di browser"
                  steps={[
                    <>Ketuk menu <EllipsisVertical className="inline h-4 w-4 align-text-bottom" /> atau ikon di pojok kanan atas</>,
                    <>Pilih <b>Buka di browser</b> / <b>Open in Chrome</b>{ios ? ' / Safari' : ''}</>,
                    <>Pop-up pemasangan akan muncul lagi di sana</>,
                  ]}
                />
              ) : installPrompt ? (
                <Button size="lg" className="w-full h-12 text-base gap-2" onClick={handleInstall}>
                  <Download className="h-5 w-5" /> Install Sekarang
                </Button>
              ) : ios ? (
                <Steps
                  title="Cara pasang di iPhone / iPad"
                  steps={[
                    <>Ketuk tombol <b>Bagikan</b> <Share className="inline h-4 w-4 align-text-bottom text-[#007AFF]" /> di bar Safari</>,
                    <>Gulir, pilih <b>Tambah ke Layar Utama</b> <PlusSquare className="inline h-4 w-4 align-text-bottom" /></>,
                    <>Ketuk <b>Tambah</b> di pojok kanan atas</>,
                  ]}
                />
              ) : (
                <Steps
                  title="Cara pasang di Android"
                  steps={[
                    <>Ketuk menu <EllipsisVertical className="inline h-4 w-4 align-text-bottom" /> di pojok kanan atas browser</>,
                    <>Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b></>,
                    <>Ketuk <b>Instal</b> / <b>Tambahkan</b></>,
                  ]}
                />
              )}
            </div>

            <Button variant="ghost" className="w-full mt-2 text-muted-foreground" onClick={() => setOpen(false)}>
              Nanti saja
            </Button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Steps({ title, steps }: { title: string; steps: React.ReactNode[] }) {
  return (
    <div className="rounded-2xl bg-muted/60 p-4">
      <p className="text-sm font-semibold text-foreground mb-2.5">{title}</p>
      <ol className="space-y-2.5">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-sm text-foreground">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
