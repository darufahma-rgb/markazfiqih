import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { type User as SupabaseUser, type Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { checkAdminInvite } from '@/lib/db';

export type User = {
  id: string;
  name: string;
  email: string;
  /** Foto yang ditampilkan: foto unggahan sendiri kalau ada, kalau tidak foto Google. */
  avatar_url: string;
  /** Foto unggahan sendiri (null kalau belum pernah unggah). */
  customAvatarUrl: string | null;
  /** Foto bawaan akun Google. */
  googleAvatarUrl?: string;
  nickname: string | null;
  isAdmin: boolean;
};

export type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (redirect?: string) => void;
  logout: () => void;
  setNickname: (nickname: string) => void;
  /** Perbarui data profil di state lokal setelah disimpan ke database. */
  updateLocalProfile: (patch: { nickname?: string | null; customAvatarUrl?: string | null }) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ── Cache user di localStorage ───────────────────────────────────────────────
// Supaya pengguna yang sudah pernah login langsung masuk tanpa jeda loading:
// saat aplikasi dibuka, kalau sesi Supabase masih tersimpan di browser, kita
// pakai data user terakhir dari cache dulu, lalu memverifikasinya di
// belakang layar. Kalau ternyata sesi sudah tidak berlaku, user di-logout.
const USER_CACHE_KEY = 'mf_user_cache_v1';

export function hasStoredSupabaseSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && /^sb-.*-auth-token$/.test(key)) return true;
    }
  } catch {
    /* localStorage tidak tersedia */
  }
  return false;
}

function readCachedUser(): User | null {
  try {
    if (!hasStoredSupabaseSession()) return null;
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as User;
    return parsed && typeof parsed.id === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null) {
  try {
    if (user) localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_CACHE_KEY);
  } catch {
    /* abaikan */
  }
}

type ProfileRow = { nickname: string | null; isAdmin: boolean; customAvatarUrl: string | null };
let profileAvatarColAvailable = true;

async function fetchUserProfile(userId: string): Promise<ProfileRow> {
  const empty: ProfileRow = { nickname: null, isAdmin: false, customAvatarUrl: null };
  try {
    const cols = profileAvatarColAvailable ? 'nickname, is_admin, custom_avatar_url' : 'nickname, is_admin';
    let { data, error } = await supabase.from('user_profiles').select(cols).eq('user_id', userId).maybeSingle();
    if (error && profileAvatarColAvailable && /custom_avatar_url/.test(error.message ?? '')) {
      // SQL Revisi Batch 2 belum dijalankan — kolom foto profil belum ada.
      profileAvatarColAvailable = false;
      ({ data, error } = await supabase.from('user_profiles').select('nickname, is_admin').eq('user_id', userId).maybeSingle());
    }
    if (error) return empty;
    const row = data as any;
    return {
      nickname: row?.nickname ?? null,
      isAdmin: row?.is_admin ?? false,
      customAvatarUrl: row?.custom_avatar_url ?? null,
    };
  } catch {
    return empty;
  }
}

async function buildUser(supabaseUser: SupabaseUser, _session: Session): Promise<User> {
  const { nickname, isAdmin, customAvatarUrl } = await fetchUserProfile(supabaseUser.id);
  const googleAvatar = supabaseUser.user_metadata?.avatar_url ?? '';
  return {
    id: supabaseUser.id,
    name: supabaseUser.user_metadata?.full_name ?? supabaseUser.email ?? 'Pengguna',
    email: supabaseUser.email ?? '',
    avatar_url: customAvatarUrl || googleAvatar,
    customAvatarUrl,
    googleAvatarUrl: googleAvatar,
    nickname,
    isAdmin,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Mulai dari cache (kalau ada) → halaman terlindungi langsung tampil tanpa spinner.
  const [initialCachedUser] = useState<User | null>(() => readCachedUser());
  const [user, setUserState] = useState<User | null>(initialCachedUser);
  const [isLoading, setIsLoading] = useState(!initialCachedUser);
  const [, setLocation] = useLocation();

  const setUser = (next: User | null | ((prev: User | null) => User | null)) => {
    setUserState((prev) => {
      const value = typeof next === 'function' ? (next as (p: User | null) => User | null)(prev) : next;
      writeCachedUser(value);
      return value;
    });
  };

  useEffect(() => {
    let mounted = true;
    let settled = false;

    const settleLoading = () => {
      if (mounted && !settled) {
        settled = true;
        setIsLoading(false);
      }
    };

    // Jangan panggil getSession() — di supabase-js v2, getSession() memakai
    // Web Locks API untuk baca sesi dari storage. Pada tab/device baru (cold
    // start), lock ini bisa deadlock selamanya dan memblokir onAuthStateChange
    // juga. Cukup andalkan onAuthStateChange dengan event INITIAL_SESSION yang
    // sudah menjadi cara resmi supabase-js v2 untuk mendapat sesi awal.

    // Safety net: kalau onAuthStateChange tidak juga menembak dalam 3 detik
    // (mis. Supabase down / network error), jangan biarkan spinner nyangkut.
    const timeoutId = setTimeout(() => {
      if (!settled) {
        console.warn('AuthContext: sesi tidak selesai dalam 3 detik, anggap belum login.');
        settleLoading();
      }
    }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (session?.user) {
          // buildUser diberi timeout 5 detik agar fetchUserProfile yang lambat
          // tidak bisa menahan settleLoading() selamanya.
          let appUser: User;
          try {
            appUser = await Promise.race([
              buildUser(session.user, session),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('buildUser timeout')), 5000),
              ),
            ]);
          } catch {
            // Fallback: tetap login tapi tanpa data profil tambahan.
            // fetchUserProfile akan dicoba ulang di render berikutnya.
            appUser =
              initialCachedUser && initialCachedUser.id === session.user.id
                ? initialCachedUser
                : {
                    id: session.user.id,
                    name: session.user.user_metadata?.full_name ?? session.user.email ?? 'Pengguna',
                    email: session.user.email ?? '',
                    avatar_url: session.user.user_metadata?.avatar_url ?? '',
                    customAvatarUrl: null,
                    googleAvatarUrl: session.user.user_metadata?.avatar_url ?? '',
                    nickname: null,
                    isAdmin: false,
                  };
          }
          if (mounted) setUser(appUser);
          settleLoading();

          // Sync Google / OAuth user profile to user_profiles table so Admin Users list retrieves them
          if (session?.user) {
            supabase
              .from('user_profiles')
              .upsert(
                {
                  user_id: session.user.id,
                  email: session.user.email,
                  full_name: session.user.user_metadata?.full_name ?? session.user.email,
                  avatar_url: session.user.user_metadata?.avatar_url ?? null,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id', ignoreDuplicates: false },
              )
              .then(({ error }) => {
                if (error) console.warn('user_profiles sync note:', error.message);
              });
          }

          // Hanya saat SIGNED_IN (login pertama sesi ini), bukan setiap kali
          // auth state berubah, supaya tidak dipanggil berulang-ulang untuk
          // user yang sudah lama login.
          if (event === 'SIGNED_IN') {
            try {
              const { promoted } = await checkAdminInvite();
              if (promoted && mounted) {
                const refreshed = await buildUser(session.user, session);
                if (mounted) setUser(refreshed);
              }
            } catch (error) {
              console.error('Gagal memeriksa undangan admin:', error);
            }
          }
        } else {
          if (mounted) setUser(null);
          settleLoading();
        }
      },
    );

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const login = (redirect?: string) => {
    const destination = redirect && redirect !== '/' ? redirect : '/katalog';
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login?redirect=${encodeURIComponent(destination)}`,
      },
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setLocation('/');
  };

  const setNickname = (nickname: string) => {
    setUser((prev) => (prev ? { ...prev, nickname } : prev));
    if (user?.id) {
      supabase
        .from('user_profiles')
        .upsert(
          { user_id: user.id, nickname, updated_at: new Date().toISOString() },
          { onConflict: 'user_id', ignoreDuplicates: false },
        )
        .then(({ error }) => {
          if (error) console.error('Gagal simpan nickname:', error);
        });
    }
  };

  const updateLocalProfile = (patch: { nickname?: string | null; customAvatarUrl?: string | null }) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      if (patch.nickname !== undefined) next.nickname = patch.nickname;
      if (patch.customAvatarUrl !== undefined) {
        next.customAvatarUrl = patch.customAvatarUrl;
        // Kembali ke foto Google kalau foto sendiri dihapus.
        next.avatar_url = patch.customAvatarUrl || prev.googleAvatarUrl || '';
      }
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, setNickname, updateLocalProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
