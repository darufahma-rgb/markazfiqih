import { useState, type ReactNode } from 'react';
import { FloatingCartBar } from '@/components/FloatingCartBar';
import { FloatingWhatsAppButton } from '@/components/FloatingWhatsAppButton';
import { Link, useLocation } from 'wouter';
import {
  LayoutGrid,
  BookMarked,
  BookOpen,
  Settings,
  LayoutDashboard,
  LogOut,
  Package,
  Menu,
  X,
  Info,
  GraduationCap,
  Receipt,
  Home,
  PlayCircle,
  User as UserIcon,
  type LucideIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { NotificationBell } from '@/components/NotificationBell';
import { BrandLogo } from '@/components/BrandLogo';

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/katalog', label: 'Katalog', icon: LayoutGrid },
  { href: '/paket-bundle', label: 'Paket Bundle', icon: Package },
  { href: '/pengajar', label: 'Pengajar', icon: GraduationCap },
  { href: '/my-classes', label: 'Kelas Saya', icon: BookMarked },
  { href: '/ebook-saya', label: 'Ebook Saya', icon: BookOpen },
  { href: '/transaksi', label: 'Riwayat Transaksi', icon: Receipt },
  { href: '/tentang-kami', label: 'Tentang', icon: Info },
];

// ── Navigasi bawah (mobile) ──────────────────────────────────────────────
// Urutan sesuai permintaan: Beranda, Katalog, Belajar, Transaksi, Akun.
const BOTTOM_NAV: { href: string; label: string; icon: LucideIcon; match: string[] }[] = [
  { href: '/dashboard', label: 'Beranda', icon: Home, match: ['/dashboard'] },
  { href: '/katalog', label: 'Katalog', icon: LayoutGrid, match: ['/katalog', '/kelas', '/class', '/paket-bundle'] },
  { href: '/my-classes', label: 'Belajar', icon: PlayCircle, match: ['/my-classes', '/learn', '/belajar'] },
  { href: '/transaksi', label: 'Transaksi', icon: Receipt, match: ['/transaksi', '/pembayaran', '/keranjang', '/checkout'] },
  { href: '/akun', label: 'Akun', icon: UserIcon, match: ['/akun', '/ebook-saya', '/pengajar', '/tentang-kami'] },
];

function UserAvatar({ className = 'h-9 w-9', ring = 'ring-2 ring-white/20' }: { className?: string; ring?: string }) {
  const { user } = useAuth();
  const initial = user?.nickname?.[0]?.toUpperCase() ?? user?.name?.[0]?.toUpperCase() ?? 'U';
  return (
    <Avatar className={`${className} ${ring} shrink-0`}>
      <AvatarImage src={user?.avatar_url || undefined} alt={user?.nickname ?? user?.name} className="object-cover" />
      <AvatarFallback className="bg-white text-primary text-sm font-semibold">{initial}</AvatarFallback>
    </Avatar>
  );
}

function MobileBottomNav() {
  const [location] = useLocation();
  return (
    <nav
      aria-label="Navigasi utama"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm pb-[var(--sab)] shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
    >
      <div className="grid grid-cols-5 h-14">
        {BOTTOM_NAV.map(({ href, label, icon: Icon, match }) => {
          const isActive = match.some((m) => location === m || location.startsWith(m + '/'));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span
                className={`flex items-center justify-center h-7 w-12 rounded-full transition-colors ${
                  isActive ? 'bg-primary/10' : ''
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.4 : 2} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ── Sidebar content (shared between desktop fixed sidebar & mobile drawer) ──
function SidebarContent({
  isAdmin,
  onClose,
}: {
  isAdmin: boolean;
  onClose?: () => void;
}) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const displayName = user?.nickname ?? user?.name ?? 'Pengguna';

  return (
    <div className="flex flex-col h-full max-h-dvh w-full overflow-hidden bg-gradient-to-b from-primary to-[hsl(var(--brand-red-hover))]">
      <div className="h-16 flex items-center px-6 border-b border-[hsl(var(--accent))]/30 shrink-0">
        <Link href="/" className="flex items-center gap-2" onClick={onClose}>
          <BrandLogo variant="white" alt="Markaz Fiqih" className="h-7 w-auto" />
        </Link>
      </div>

      {/* Area menu + widget progress bisa di-scroll sendiri di layar pendek
          (mis. iPad / Tablet 768-1024px), supaya blok akun di bawah selalu
          terlihat dan tidak pernah terdorong keluar viewport. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <nav className="flex flex-col gap-1 px-3 py-4">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-white/50 mb-2">
            Menu Utama
          </p>
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = location === href || location.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={
                  isActive
                    ? 'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold text-primary bg-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] border-l-2 border-[hsl(var(--accent))]'
                    : 'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 hover:scale-[1.02] transition-friendly'
                }
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-[hsl(var(--accent))]' : ''}`} />
                {label}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              href="/admin"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 hover:scale-[1.02] transition-friendly"
            >
              <Settings className="h-4 w-4" />
              Panel Admin
            </Link>
          )}
        </nav>
      </div>

      {/* Pinned Bottom Account / Logout Box */}
      <div className="border-t border-white/20 p-3.5 shrink-0 bg-black/10">
        <div className="flex items-center gap-3">
          <Link
            href="/akun"
            onClick={onClose}
            className="flex flex-1 min-w-0 items-center gap-3 rounded-md -m-1 p-1 hover:bg-white/10 transition-colors"
            title="Atur foto & nama"
          >
            <UserAvatar />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{displayName}</p>
              <p className="text-xs text-white/60 truncate">{user?.email}</p>
            </div>
          </Link>
          <motion.button
            onClick={() => { logout(); onClose?.(); }}
            className="shrink-0 p-2 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-friendly"
            title="Keluar"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            <LogOut className="h-4 w-4 hover:scale-110 transition-transform duration-150" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ── Desktop sidebar (fixed, hidden on mobile) ────────────────────────────
export function AppSidebar({ isAdmin }: { isAdmin: boolean }) {
  return (
    <aside className="hidden lg:flex fixed top-0 bottom-0 left-0 w-[240px] h-dvh max-h-dvh flex-col border-r border-white/10 z-40 overflow-hidden">
      <SidebarContent isAdmin={isAdmin} />
    </aside>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────
export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    // --bnav: tinggi navigasi bawah di mobile (0 di desktop). Dipakai elemen
    // melayang lain (keranjang, WhatsApp, bar beli) supaya tidak tertutup.
    <div className="min-h-screen bg-background [--bnav:calc(3.5rem+var(--sab))] lg:[--bnav:0px]">
      {/* Desktop sidebar */}
      <AppSidebar isAdmin={isAdmin} />

      {/* Mobile top bar — visible only below lg breakpoint */}
      <div className="lg:hidden fixed top-[var(--sat)] left-0 right-0 z-40 h-14 flex items-center justify-between px-4 bg-gradient-to-r from-primary to-[hsl(var(--brand-red-hover))] border-b border-white/10 shadow-md">
        {/* 1. Kiri: Ikon Hamburger */}
        <motion.button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-friendly shrink-0"
          aria-label="Buka menu navigasi"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.15 }}
        >
          <Menu className="h-6 w-6" />
        </motion.button>

        {/* 2. Tengah: Logo Saja (Proporsional & Presisi) */}
        <Link
          href="/"
          className="absolute left-1/2 -translate-x-1/2 flex items-center transition-opacity hover:opacity-90"
        >
          <BrandLogo variant="white" alt="Markaz Fiqih" className="h-7 w-auto shrink-0" />
        </Link>

        {/* 3. Kanan: Ikon Notifikasi + foto profil (buka halaman Akun) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="[&_svg]:text-white/80 [&_svg]:hover:text-white [&_button]:hover:bg-white/10">
            <NotificationBell />
          </div>
          <Link href="/akun" aria-label="Akun saya">
            <UserAvatar className="h-8 w-8" ring="ring-2 ring-white/40" />
          </Link>
        </div>
      </div>

      {/* Desktop floating notification bell — top-right of main content, visible on all AppShell pages */}
      <div className="hidden lg:flex fixed top-4 right-6 z-30">
        <NotificationBell />
      </div>

      {/* Mobile drawer overlay + panel */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Dark overlay — click to close */}
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer panel — slides in from left */}
            <motion.div
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="lg:hidden fixed top-[var(--sat)] left-0 z-50 w-[260px] h-[calc(100dvh-var(--sat))] pb-[var(--sab)] shadow-2xl"
            >
              {/* Close button: ikon aksi — whileHover/whileTap */}
              <motion.button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-3 z-10 p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-friendly"
                aria-label="Tutup menu"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
              >
                <X className="h-5 w-5" />
              </motion.button>

              <SidebarContent
                isAdmin={isAdmin}
                onClose={() => setMobileOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content — offset by top bar height on mobile, by sidebar width on desktop */}
      <div className="lg:pl-[240px] pt-14 lg:pt-0 pb-[var(--bnav)] min-h-screen flex flex-col">
        {children}
      </div>

      <MobileBottomNav />

      <FloatingWhatsAppButton />
      {/* Floating cart bar — muncul di semua halaman internal saat keranjang ada isinya */}
      <FloatingCartBar />
    </div>
  );
}
