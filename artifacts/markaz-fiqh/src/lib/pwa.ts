// ── PWA: service worker + prompt "Install aplikasi" ───────────────────────────
// `beforeinstallprompt` (Chrome/Edge/Samsung Internet di Android) bisa terpicu
// sebelum React selesai mount, jadi event-nya ditangkap sedini mungkin lewat
// initPwa() di main.tsx lalu disimpan di sini.

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function initPwa() {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Cegah mini-infobar bawaan Chrome; kita tampilkan pop-up sendiri
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });

  // Service worker hanya di build produksi — di dev server bisa bikin file basi
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => { /* tidak kritis */ });
    });
  }
}

export function getInstallPrompt() {
  return deferredPrompt;
}

export function clearInstallPrompt() {
  deferredPrompt = null;
  notify();
}

export function subscribeInstallPrompt(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Sudah dibuka sebagai aplikasi (dari ikon di layar utama)? */
export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isMobileDevice() {
  const ua = navigator.userAgent;
  // iPadOS 13+ mengaku sebagai Mac — kenali lewat layar sentuh
  const isIpad = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /Android|iPhone|iPad|iPod/i.test(ua) || isIpad;
}

export function isIos() {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/** Browser bawaan aplikasi lain (WhatsApp, Instagram, Facebook, dll.) tidak bisa install PWA */
export function isInAppBrowser() {
  return /FBAN|FBAV|Instagram|Line\/|WhatsApp|TikTok|musical_ly|; wv\)/i.test(navigator.userAgent);
}
