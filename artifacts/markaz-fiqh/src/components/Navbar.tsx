import React, { useState } from 'react';
import { Link } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BookOpen, ShoppingCart, Menu, X } from 'lucide-react';

interface NavbarProps {
  variant?: 'default' | 'dark';
}

const NAV_LINKS = [
  { href: '/katalog', label: 'Katalog' },
  { href: '/paket-bundle', label: 'Paket Bundle' },
  { href: '/my-classes', label: 'Kelas Saya' },
];

export function Navbar({ variant = 'default' }: NavbarProps) {
  const { user, logout, isLoading } = useAuth();
  const { count } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isDark = variant === 'dark';

  // Added duration-150 for consistent short transition on link text
  const linkClass = isDark
    ? 'text-sm font-medium text-white/70 hover:text-[hsl(var(--accent))] transition-colors duration-150'
    : 'text-sm font-medium text-white/80 hover:text-white transition-colors duration-150';

  return (
    <header
      className={
        isDark
          ? 'sticky top-0 z-50 w-full bg-[#0a0908]'
          : 'sticky top-0 z-50 w-full bg-gradient-to-r from-primary to-[hsl(var(--brand-red-hover))]'
      }
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex h-16 items-center justify-between">
          {/* Kiri: hamburger (mobile) + logo */}
          <div className="flex items-center gap-1">
            {/* Hamburger — hanya tampil di mobile, di KIRI sesuai posisi sidebar */}
            <motion.button
              className="md:hidden flex items-center justify-center h-9 w-9 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-friendly"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15 }}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </motion.button>

            <Link href="/" className="flex items-center transition-opacity hover:opacity-90">
              <img
                src="/logo.png"
                alt="Markaz Fiqih"
                className="h-8 w-auto brightness-0 invert"
              />
            </Link>
          </div>

          {/* Menu desktop — center absolut (tersembunyi di mobile) */}
          <nav className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className={linkClass}>
                {label}
              </Link>
            ))}
          </nav>

          {/* Kanan: cart + avatar/masuk */}
          <div className="flex items-center gap-2 sm:gap-4">
            {!isLoading && user && (
              <Link
                href="/keranjang"
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-friendly"
                aria-label="Keranjang"
              >
                {/* Icon klik: hover:scale-110 */}
                <ShoppingCart className="h-5 w-5 hover:scale-110 transition-transform duration-150" />
                <AnimatePresence>
                  {count > 0 && (
                    <motion.span
                      key={count}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                      className="absolute -top-1 -right-1 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[hsl(var(--brand-gold))] px-1 text-[10px] font-bold leading-none text-white"
                    >
                      {count > 9 ? '9+' : count}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            )}

            {!isLoading && (
              user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full hover:bg-white/10">
                      <Avatar className="h-9 w-9 border border-white/20">
                        <AvatarImage src={user.avatar_url} alt={user.name} />
                        <AvatarFallback className="bg-white text-primary">
                          {user.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/my-classes" className="cursor-pointer">Kelas Saya</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={() => logout()}>
                      Keluar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                isDark ? (
                  // Tombol "Masuk" (dark variant) — bungkus motion.div untuk whileHover/whileTap
                  <motion.div
                    className="inline-block"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Button
                      asChild
                      className="font-medium bg-[hsl(var(--accent))] text-white hover:bg-[hsl(var(--brand-gold-hover))]"
                    >
                      <Link href="/login">Masuk</Link>
                    </Button>
                  </motion.div>
                ) : (
                  // Tombol "Masuk" (default variant) — bungkus motion.div untuk whileHover/whileTap
                  <motion.div
                    className="inline-block"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Button asChild className="font-medium bg-white text-primary hover:bg-white/90">
                      <Link href="/login">Masuk</Link>
                    </Button>
                  </motion.div>
                )
              )
            )}

          </div>
        </div>
      </div>

      {/* Mobile menu dropdown — slide down */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className={`md:hidden overflow-hidden border-t ${isDark ? 'border-white/10 bg-[#0a0908]' : 'border-white/10 bg-gradient-to-b from-[hsl(var(--brand-red-hover))] to-primary/95'}`}
          >
            <nav className="flex flex-col px-4 py-3 gap-1">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-md text-sm font-medium ${
                    isDark
                      ? 'text-white/70 hover:text-[hsl(var(--accent))] hover:bg-white/5'
                      : 'text-white/85 hover:text-white hover:bg-white/10'
                  } transition-colors duration-150`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
