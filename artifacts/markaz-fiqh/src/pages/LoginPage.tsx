import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { FcGoogle } from 'react-icons/fc';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const [location, setLocation] = useLocation();

  // Extract redirect url if available
  const searchParams = new URLSearchParams(window.location.search);
  const redirectUrl = searchParams.get('redirect') || '/katalog';

  useEffect(() => {
    if (!isLoading && user) {
      setLocation(redirectUrl);
    }
  }, [user, isLoading, setLocation, redirectUrl]);

  if (isLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col lg:flex-row bg-background">
      {/* Visual Side */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-primary to-[hsl(var(--brand-red-hover))] flex-col justify-between p-12 text-primary-foreground relative overflow-y-auto">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 mix-blend-multiply"
          style={{
            backgroundImage: "url('/hero-pattern.png')",
            backgroundSize: '900px',
            backgroundRepeat: 'repeat',
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <img src="/logo-white.png" alt="Markaz Fiqih" className="h-8 w-auto" />
        </div>

        <div className="relative z-10 max-w-lg space-y-6">
          <h1 className="font-serif text-5xl font-bold leading-[1.15] tracking-tight">
            Ilmu Fiqih,<br />Tersusun Rapi.
          </h1>
          <p className="text-lg text-primary-foreground/80 font-medium">
            Mempelajari tuntunan agama dari sumber terpercaya dengan pendekatan kurikulum modern dan terstruktur.
          </p>
        </div>
        
        <div className="relative z-10">
          <p className="text-sm text-primary-foreground/60">
            © {new Date().getFullYear()} Markaz Fiqh. Semua Hak Dilindungi.
          </p>
        </div>
      </div>

      {/* Login Side */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-8"
        >
          <div className="text-center lg:text-left space-y-2">
            <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
              <img
                src="/logo.png"
                alt="Markaz Fiqih"
                className="h-6.5 w-auto"
              />
            </div>
            
            <h2 className="font-serif text-3xl font-bold text-foreground">Selamat Datang</h2>
            <p className="text-muted-foreground">
              Masuk ke akun Google Anda untuk melanjutkan pembelajaran.
            </p>
          </div>

          <div className="space-y-6 pt-4">
            <Button 
              size="lg" 
              variant="outline" 
              className="w-full h-12 text-base font-medium flex items-center justify-center gap-3"
              onClick={() => login(redirectUrl)}
            >
              <FcGoogle className="h-6 w-6" />
              Masuk dengan Google
            </Button>

            <p className="text-center text-xs text-muted-foreground/80 px-4">
              Anda akan diarahkan untuk menghubungkan akun secara aman dengan Database
              Kelas Markaz Fiqih (butibupkkgiujnaoietc.supabase.co).
            </p>

            <p className="text-center text-sm text-muted-foreground px-4">
              Dengan masuk, kamu setuju dengan{' '}
              <a href="#" className="underline underline-offset-4 hover:text-primary">
                syarat layanan
              </a>{' '}
              kami.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
