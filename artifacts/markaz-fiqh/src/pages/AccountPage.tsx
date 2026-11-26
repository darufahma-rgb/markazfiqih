import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import {
  BookOpen,
  Camera,
  ChevronRight,
  GraduationCap,
  Info,
  Loader2,
  LogOut,
  Package,
  Receipt,
  Settings,
  User as UserIcon,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { SEO } from '@/components/SEO';
import { AppShell } from '@/components/AppShell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { updateMyProfile, uploadMyAvatar } from '@/lib/db';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const MENU: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/transaksi', label: 'Riwayat Transaksi', icon: Receipt },
  { href: '/ebook-saya', label: 'Ebook Saya', icon: BookOpen },
  { href: '/paket-bundle', label: 'Paket Bundle', icon: Package },
  { href: '/pengajar', label: 'Pengajar', icon: GraduationCap },
  { href: '/tentang-kami', label: 'Tentang', icon: Info },
];

export default function AccountPage() {
  const { user, logout, updateLocalProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.nickname ?? user?.name ?? '');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeCustomAvatar, setRemoveCustomAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!user) return null;

  const shownAvatar = previewUrl ?? (removeCustomAvatar ? '' : user.avatar_url);
  const initial = (displayName || user.name || 'U').trim().charAt(0).toUpperCase();
  const hasCustomAvatar = !!user.customAvatarUrl && !removeCustomAvatar;
  const isDirty =
    displayName.trim() !== (user.nickname ?? user.name ?? '') || !!pendingFile || removeCustomAvatar;

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Format foto harus JPG, PNG, atau WebP.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('Ukuran foto maksimal 2 MB.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setPendingFile(file);
    setRemoveCustomAvatar(false);
  };

  const handleRemovePhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
    setRemoveCustomAvatar(true);
  };

  const handleSave = async () => {
    const name = displayName.trim();
    if (!name) {
      toast.error('Nama tampilan tidak boleh kosong.');
      return;
    }
    setIsSaving(true);
    try {
      let customAvatarUrl: string | null | undefined;
      if (pendingFile) customAvatarUrl = await uploadMyAvatar(user.id, pendingFile);
      else if (removeCustomAvatar) customAvatarUrl = null;

      await updateMyProfile(user.id, { nickname: name, customAvatarUrl });

      updateLocalProfile({ nickname: name, ...(customAvatarUrl !== undefined ? { customAvatarUrl } : {}) });
      setPendingFile(null);
      setRemoveCustomAvatar(false);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      toast.success('Profil berhasil disimpan.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan profil.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell>
      <SEO title="Akun" description="Atur foto profil dan nama tampilan akunmu." />
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 max-w-2xl py-6 lg:py-10 space-y-5">
        <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground">Akun</h1>

        {/* Profil */}
        <section className="rounded-2xl border bg-card p-5 space-y-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Profil Pengguna</p>
            <h2 className="text-lg font-semibold text-foreground">Atur foto dan nama</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ditampilkan di ruang belajar dan dashboard akunmu.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 ring-2 ring-border">
              <AvatarImage src={shownAvatar} alt={displayName} className="object-cover" />
              <AvatarFallback className="bg-muted text-muted-foreground text-2xl font-semibold">
                {initial || <UserIcon className="h-8 w-8" />}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
              >
                <Camera className="h-4 w-4" />
                Unggah foto baru
              </Button>
              <p className="text-[11px] text-muted-foreground">JPG, PNG, atau WebP. Maks 2 MB, disarankan persegi.</p>
              {(hasCustomAvatar || pendingFile) && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="text-xs font-medium text-destructive hover:underline"
                  disabled={isSaving}
                >
                  Hapus foto
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_TYPES.join(',')}
                className="hidden"
                onChange={handlePickFile}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="display-name">Nama tampilan</Label>
            <Input
              id="display-name"
              value={displayName}
              maxLength={60}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-1 text-sm">
            <p className="text-xs text-muted-foreground">Email (akun Google)</p>
            <p className="font-medium text-foreground break-all">{user.email}</p>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={!isDirty || isSaving} className="gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan perubahan
            </Button>
          </div>
        </section>

        {/* Menu lainnya */}
        <section className="rounded-2xl border bg-card divide-y overflow-hidden">
          {MENU.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              <Icon className="h-4 w-4 text-primary" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
          {user.isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              <Settings className="h-4 w-4 text-primary" />
              <span className="flex-1">Panel Admin</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          )}
          <button
            type="button"
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-5 py-3.5 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="flex-1 text-left">Keluar</span>
          </button>
        </section>
      </main>
    </AppShell>
  );
}
