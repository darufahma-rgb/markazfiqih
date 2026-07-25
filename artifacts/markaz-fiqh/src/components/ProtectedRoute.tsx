import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';
import { Navbar } from '@/components/Navbar';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, login } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--brand-red-tint))] p-4 relative overflow-hidden">
        {/* Tekstur pattern lembut di background, konsisten dengan LoginPage */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "url('/hero-pattern.png')",
            backgroundSize: '700px',
            backgroundRepeat: 'repeat',
          }}
        />

        <div className="relative bg-white rounded-[20px] shadow-xl border border-[hsl(var(--brand-gold-pale))] p-10 max-w-md w-full text-center">
          {/* Badge logo — gradient merah + tekstur pattern + ring gold tipis */}
          <div className="relative mx-auto w-20 h-20 mb-6">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary to-[hsl(var(--brand-red-hover))] shadow-lg shadow-primary/30" />
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-2xl opacity-20 mix-blend-overlay"
              style={{
                backgroundImage: "url('/hero-pattern.png')",
                backgroundSize: '200px',
                backgroundRepeat: 'repeat',
              }}
            />
            <div className="absolute -inset-1 rounded-2xl ring-1 ring-[hsl(var(--accent))]/40 pointer-events-none" />
            <img
              src="/logo.png"
              alt="Markaz Fiqih"
              className="relative w-full h-full object-contain p-4 brightness-0 invert"
            />
          </div>

          <h2 className="font-serif text-2xl font-bold text-foreground">
            Yuk, Masuk Dulu
          </h2>
          <div className="w-10 h-[3px] rounded-full bg-[hsl(var(--accent))] mx-auto mt-3 mb-4" />
          <p className="text-muted-foreground mb-8">
            Masuk sebentar untuk lanjut menjelajahi kelas-kelas fiqih pilihanmu.
          </p>

          <Button
            onClick={() => login(location)}
            className="w-full h-12 text-base shadow-md shadow-primary/20"
            size="lg"
          >
            <LogIn className="h-4 w-4 mr-2" />
            Masuk dengan Google
          </Button>

          <p className="text-xs text-muted-foreground/70 mt-4">
            Belum pernah ke sini? Akun baru otomatis dibuat saat pertama kali masuk.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
