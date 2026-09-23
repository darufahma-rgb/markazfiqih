import { useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { getSettings } from '@/lib/db';

function toWaUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('62')) return `https://wa.me/${digits}`;
  if (digits.startsWith('0')) return `https://wa.me/62${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
}

export function FloatingWhatsAppButton() {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    staleTime: 5 * 60 * 1000,
  });

  const phone = settings?.contactPhone;
  if (!phone) return null;

  return (
    <a
      href={toWaUrl(phone)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat admin via WhatsApp"
      className="fixed right-4 z-[44] bottom-[calc(6rem+var(--sab))] lg:bottom-6 flex items-center gap-2 rounded-full px-4 py-2.5 sm:px-4 sm:py-2.5 bg-[hsl(var(--accent))] hover:bg-[hsl(var(--brand-gold-hover))] text-white font-semibold shadow-lg transition-colors"
    >
      <MessageCircle className="w-5 h-5 shrink-0" />
      <span className="hidden sm:inline text-sm whitespace-nowrap">Chat via WhatsApp</span>
    </a>
  );
}
