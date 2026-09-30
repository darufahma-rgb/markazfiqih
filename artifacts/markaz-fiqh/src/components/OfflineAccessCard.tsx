import { useQuery } from '@tanstack/react-query';
import { MessageCircle, WifiOff } from 'lucide-react';
import { getUserPhone } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';
import { toWaUrl } from '@/components/FloatingWhatsAppButton';

// Nomor admin khusus pengajuan akses rekaman offline (dari owner) — sengaja
// tidak diambil dari Panel Admin supaya kartu ini selalu berfungsi.
const OFFLINE_ACCESS_WA_NUMBER = '6285752607520';

function buildRequestMessage({
  name,
  phone,
  email,
  classTitle,
}: {
  name: string;
  phone: string;
  email: string;
  classTitle: string;
}) {
  return [
    'FORMULIR PENGAJUAN AKSES REKAMAN OFFLINE',
    'MARKAZ FIQIH',
    '',
    `Nama: ${name}`,
    `No. WhatsApp: ${phone}`,
    `Email: ${email}`,
    `Nama Kelas: ${classTitle}`,
    '',
    'Alasan Pengajuan Akses Offline:',
    '☐ Keterbatasan internet/kuota',
    '☐ Kendala jaringan',
    '☐ Lainnya:',
    '',
    'Jelaskan alasan:',
    '',
    '',
    'Pernyataan:',
    'Saya berkomitmen bahwa rekaman yang diberikan hanya untuk kepentingan belajar pribadi. ' +
      'Saya tidak akan menyebarkan, membagikan, mengunggah ulang, memperjualbelikan, atau ' +
      'memberikan rekaman kepada pihak lain dalam bentuk apa pun.',
    '',
    'Saya menyetujui pernyataan di atas.',
  ].join('\n');
}

/**
 * Kartu bantuan "Kendala Jaringan?" — tampil permanen di semua kelas, terpisah
 * dari Fasilitas Kelas. Pembelajaran utama tetap online; ini hanya jalur
 * alternatif: tombolnya membuka WhatsApp admin dengan formulir pengajuan akses
 * rekaman offline yang sudah terisi data peserta & kelas.
 */
export function OfflineAccessCard({ classTitle, className }: { classTitle: string; className?: string }) {
  const { user } = useAuth();
  const { data: phone } = useQuery({
    queryKey: ['user-phone', user?.id],
    queryFn: () => getUserPhone(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  const message = buildRequestMessage({
    name: user?.name ?? '',
    phone: phone ?? '',
    email: user?.email ?? '',
    classTitle,
  });

  return (
    <div className={['bg-card rounded-2xl border p-5', className].filter(Boolean).join(' ')}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <WifiOff className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">Kendala Jaringan?</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Jika mengalami kesulitan mengikuti pembelajaran secara online, ajukan akses offline untuk kelas ini.
          </p>
        </div>
      </div>

      <a
        href={toWaUrl(OFFLINE_ACCESS_WA_NUMBER, message)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:border-primary hover:bg-[hsl(var(--brand-red-tint))] transition-colors"
      >
        <MessageCircle className="h-4 w-4 text-primary" />
        Ajukan Akses Offline
      </a>
    </div>
  );
}
