import { Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/data/mockClasses';

export function FloatingCartBar() {
  const { count, subtotal } = useCart();
  const [location] = useLocation();

  // Kondisi tampil: ada item di keranjang, DAN bukan halaman keranjang itu sendiri.
  // Kondisi ini ada DI DALAM AnimatePresence supaya exit animation benar-benar berjalan
  // saat keranjang dikosongkan (jika return null dilakukan sebelum AnimatePresence,
  // animasi keluar tidak pernah terpicu).
  const CART_BAR_PATHS = ['/katalog', '/paket-bundle'];
  const visible = count > 0 && CART_BAR_PATHS.includes(location);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="floating-cart"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          // z-[45]: di bawah mobile drawer (z-50) sehingga drawer selalu muncul di atas
          // bottom-20 pada mobile: memberi ruang di atas sticky buy bar ClassDetailPage (z-40, bottom-0)
          // lg:bottom-4 lg:left-[calc(50%+120px)]: center visual terhadap area konten (sidebar 240px)
          className="fixed bottom-[calc(5rem+var(--sab))] lg:bottom-4 left-1/2 -translate-x-1/2 z-[45] w-[calc(100%-2rem)] max-w-md lg:left-[calc(50%+120px)] lg:translate-x-[-50%]"
        >
          <Link href="/keranjang">
            <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-primary to-[hsl(var(--brand-red-hover))] text-white rounded-2xl shadow-xl px-5 py-3.5 cursor-pointer hover:shadow-2xl transition-shadow">
              <div className="flex items-center gap-3">
                {/* Ikon keranjang dengan badge jumlah item */}
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15 shrink-0">
                  <ShoppingCart className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[hsl(var(--accent))] px-1 text-[11px] font-bold leading-none text-white">
                    {count}
                  </span>
                </div>

                {/* Teks ringkasan */}
                <div className="text-left">
                  <p className="text-xs text-white/70 leading-none mb-0.5">
                    {count} item di keranjang
                  </p>
                  <p className="text-sm font-bold leading-none">{formatPrice(subtotal)}</p>
                </div>
              </div>

              {/* Panah ke kanan */}
              <ArrowRight className="h-5 w-5 shrink-0" />
            </div>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
