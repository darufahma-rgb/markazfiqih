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
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { NotificationBell } from '@/components/NotificationBell';

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/katalog', label: 'Katalog', icon: LayoutGrid },
  { href: '/paket-bundle', label: 'Paket Bundle', icon: Package },
  { href: '/pengajar', label: 'Pengajar', icon: GraduationCap },
  { href: '/my-classes', label: 'Kelas Saya', icon: BookMarked },
  { href: '/ebook-saya', label: 'Ebook Saya', icon: BookOpen },
  { href: '/tentang-kami', label: 'Tentang', icon: Info },
];

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

  const initial =
    user?.nickname?.[0]?.toUpperCase() ?? user?.name?.[0]?.toUpperCase() ?? 'U';
  const displayName = user?.nickname ?? user?.name ?? 'Pengguna';

  return (
    <div className="flex flex-col h-full max-h-dvh w-full overflow-hidden bg-gradient-to-b from-primary to-[hsl(var(--brand-red-hover))]">
      <div className="h-16 flex items-center px-6 border-b border-[hsl(var(--accent))]/30 shrink-0">
        <Link href="/" className="flex items-center gap-2" onClick={onClose}>
          <img src="/logo.png" alt="Markaz Fiqih" className="h-7 w-auto brightness-0 invert" />
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
          <div className="h-9 w-9 rounded-full bg-white text-primary flex items-center justify-center text-sm font-semibold shrink-0 ring-2 ring-white/20">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{displayName}</p>
            <p className="text-xs text-white/60 truncate">{user?.email}</p>
          </div>
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
  const isAdmin = Boolean(user && (user as { role?: string }).role === 'admin');
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <AppSidebar isAdmin={isAdmin} />

      {/* Mobile top bar — visible only below lg breakpoint */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 bg-gradient-to-r from-primary to-[hsl(var(--brand-red-hover))] border-b border-white/10 shadow-md">
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
          <img src="/logo.png" alt="Markaz Fiqih" className="h-7 w-auto shrink-0 brightness-0 invert" />
        </Link>

        {/* 3. Kanan: Ikon Notifikasi */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="[&_svg]:text-white/80 [&_svg]:hover:text-white [&_button]:hover:bg-white/10">
            <NotificationBell />
          </div>
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
              className="lg:hidden fixed top-0 left-0 z-50 w-[260px] h-dvh shadow-2xl"
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
      <div className="lg:pl-[240px] pt-14 lg:pt-0 min-h-screen flex flex-col">
        {children}
      </div>

      <FloatingWhatsAppButton />
      {/* Floating cart bar — muncul di semua halaman internal saat keranjang ada isinya */}
      <FloatingCartBar />
    </div>
  );
}
