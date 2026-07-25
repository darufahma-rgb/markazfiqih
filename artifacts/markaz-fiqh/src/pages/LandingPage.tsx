import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'wouter';
import {
  ArrowRight,
  Instagram,
  Facebook,
  Youtube,
  MessageCircle,
  MapPin,
} from 'lucide-react';

import { SEO } from '@/components/SEO';
import { Navbar } from '@/components/Navbar';
import { FloatingWhatsAppButton } from '@/components/FloatingWhatsAppButton';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { listClasses, listInstructors, listTestimonials, getSettings } from '@/lib/db';
import {
  ClassCard,
  ClassCardSkeleton,
  type ClassSummary,
} from '@/pages/CatalogPage';

// ── Helper: konversi nomor lokal ke format wa.me ─────────────────────────────
function toWaUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('62')) return `https://wa.me/${digits}`;
  if (digits.startsWith('0')) return `https://wa.me/62${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
}

// ── Ikon TikTok ──────────────────────────────────────────────────────────────
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.6 5.82c-.9-.88-1.4-2.08-1.4-3.32h-3.13v13.44c0 1.6-1.3 2.9-2.9 2.9a2.9 2.9 0 0 1 0-5.8c.27 0 .53.03.78.1V9.98a6.03 6.03 0 0 0-.78-.05A6.03 6.03 0 0 0 3.15 16a6.03 6.03 0 0 0 6.02 6.02A6.03 6.03 0 0 0 15.19 16V8.66a8.16 8.16 0 0 0 4.76 1.52V7.05a4.85 4.85 0 0 1-3.35-1.23Z" />
    </svg>
  );
}

function buildSocialLinks(settings?: {
  socialInstagram: string;
  socialFacebook: string;
  socialTiktok: string;
  socialYoutube: string;
}): Array<{ label: string; icon: typeof Instagram | typeof TikTokIcon; href: string }> {
  return [
    { label: 'Instagram', icon: Instagram, href: settings?.socialInstagram || '' },
    { label: 'Facebook', icon: Facebook, href: settings?.socialFacebook || '' },
    { label: 'TikTok', icon: TikTokIcon, href: settings?.socialTiktok || '' },
    { label: 'YouTube', icon: Youtube, href: settings?.socialYoutube || '' },
  ];
}

// ── Data galeri foto ──────────────────────────────────────────────────────────
const GALLERY_PHOTOS = [
  { src: '/gallery/foto-2.jpeg', alt: 'Kajian kitab turats' },
  { src: '/gallery/foto-5.jpeg', alt: 'Diskusi pelajar Markaz Fiqih' },
  { src: '/gallery/foto-3.jpeg', alt: 'Sesi tanya jawab bersama pengajar' },
  { src: '/gallery/foto-4.jpeg', alt: 'Suasana pembelajaran online' },
  { src: '/gallery/foto-1.jpeg', alt: 'Kegiatan belajar Markaz Fiqih' },
  { src: '/gallery/foto-6.jpeg', alt: 'Pengajar Al-Azhar Kairo' },
];

// ── Data cara belajar — 3 langkah gabungan dari 5 tahap ──────────────────────
const CURRICULUM_STAGES = [
  {
    stage: '01',
    title: 'Cari & Pilih',
    subtitle: 'Eksplorasi',
    topics: ['Jelajahi Katalog', 'Paket Bundle', 'Filter Level'],
    description:
      'Telusuri katalog kelas fiqih sesuai minat dan levelmu, dari pemula hingga kajian kitab. Temukan yang cocok, lalu tambahkan satu atau beberapa kelas sekaligus ke keranjang.',
  },
  {
    stage: '02',
    title: 'Bayar & Akses',
    subtitle: 'Pembayaran',
    topics: ['QRIS', 'Virtual Account', 'Akses Instan'],
    description:
      'Bayar lewat QRIS, e-wallet, virtual account, atau kartu, selesai dalam hitungan menit. Begitu pembayaran terverifikasi, kelas langsung terbuka otomatis di akunmu.',
  },
  {
    stage: '03',
    title: 'Belajar Fleksibel',
    subtitle: 'Pembelajaran',
    topics: ['Akses Selamanya', 'Progress Otomatis', 'Video On-Demand'],
    description:
      'Tonton materi kapan saja dan di mana saja sesuai waktumu. Progress belajar tersimpan otomatis, lanjutkan dari mana kamu berhenti tanpa kehilangan catatan.',
  },
];

// ── Tipe data bersama ─────────────────────────────────────────────────────────
type InstructorItem = { id: string; name: string; photoUrl: string; bio?: string };
type TestimonialItem = {
  id: string;
  name: string;
  role: string | null;
  content: string;
  photoUrl: string | null;
};

// ────────────────────────────────────────────────────────────────────────────
// SECTION 1: Hero — satu kolom, semua elemen center secara horizontal
// ────────────────────────────────────────────────────────────────────────────
function HeroSection({
  totalClasses: _totalClasses,
  studentCountLabel: _studentCountLabel,
}: {
  socialLinks: Array<{ label: string; icon: typeof Instagram | typeof TikTokIcon; href: string }>;
  totalClasses: number;
  studentCountLabel: string | null | undefined;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary to-[hsl(var(--brand-red-hover))] min-h-screen min-h-dvh flex flex-col justify-between pt-16 pb-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 mix-blend-multiply"
        style={{
          backgroundImage: "url('/hero-pattern.png')",
          backgroundSize: '900px',
          backgroundRepeat: 'repeat',
        }}
      />

      {/* Masjid Al-Azhar — pojok kiri bawah */}
      <img
        src="/masjid-azhar.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 w-[240px] sm:w-[300px] lg:w-[360px] select-none"
        style={{ opacity: 0.22, mixBlendMode: 'luminosity', maskImage: 'linear-gradient(to top, black 30%, transparent 85%), linear-gradient(to right, black 40%, transparent 100%)', maskComposite: 'intersect' }}
      />

      <div className="relative z-10 container mx-auto px-5 sm:px-8 lg:px-16 max-w-[1200px] flex-1 flex flex-col justify-between py-6 sm:py-8">
        {/* Top: Logo + Title + Subtitle + Buttons */}
        <div className="flex flex-col items-center text-center my-auto -mt-6 sm:-mt-10 lg:-mt-12 pt-2 sm:pt-4">

          {/* 1. Logo Markaz Fiqih */}
          <motion.img
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            src="/logo.png"
            alt="Markaz Fiqih"
            className="h-8 sm:h-10 lg:h-12 w-auto mt-2 mb-5 sm:mb-6 brightness-0 invert"
          />

          {/* 2. Ahlan wa Sahlan di & 3. Kelas Markaz Fiqih */}
          <h1 className="font-['Plus_Jakarta_Sans',sans-serif] leading-[1.1] tracking-tight max-w-4xl">
            <span
              className="block text-2xl sm:text-3xl lg:text-4xl font-semibold italic mb-1"
              style={{ color: 'hsl(var(--accent))' }}
            >
              Ahlan wa Sahlan di
            </span>
            <span className="block text-5xl sm:text-7xl lg:text-8xl font-extrabold text-white">
              Kelas Markaz Fiqih
            </span>
          </h1>

          {/* 4. Subtitle Deskripsi */}
          <p className="font-['Plus_Jakarta_Sans',sans-serif] text-white/90 text-sm sm:text-lg lg:text-xl mt-3 sm:mt-4 leading-relaxed max-w-2xl font-medium">
            Tempat Belajar Fiqih Madzhab Syafi'i Yang Sistematis dan Terstruktur
          </p>

          {/* 5. CTA Buttons */}
          <div className="mt-5 sm:mt-7 flex flex-wrap justify-center items-center gap-3 font-['Plus_Jakarta_Sans',sans-serif]">
            <motion.div
              className="inline-block"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                asChild
                size="lg"
                className="h-[48px] sm:h-[52px] px-8 text-base font-semibold rounded-[10px] text-primary-foreground hover:opacity-90 shadow-lg font-['Plus_Jakarta_Sans',sans-serif]"
                style={{ backgroundColor: 'hsl(var(--accent))' }}
              >
                <Link href="/katalog">Mulai Belajar</Link>
              </Button>
            </motion.div>
            <motion.div
              className="inline-block"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="h-[48px] sm:h-[52px] px-7 text-base font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-[10px] border border-white/25 font-['Plus_Jakarta_Sans',sans-serif]"
              >
                <Link href="/katalog">
                  Lihat Kelas Tersedia
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </div>

        {/* 6. Markaz Fiqih Header & 7. "Membumikan Fiqih di Setiap Lini Kehidupan" */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="pt-4 sm:pt-6 border-t border-white/15 w-full max-w-2xl mx-auto text-center mt-4 font-['Plus_Jakarta_Sans',sans-serif]"
        >
          <p className="text-xs uppercase tracking-widest text-white/80 font-bold mb-1 font-['Plus_Jakarta_Sans',sans-serif]">
            Markaz Fiqih
          </p>
          <blockquote className="font-['Plus_Jakarta_Sans',sans-serif] italic text-white/95 text-sm sm:text-base leading-relaxed font-medium">
            &ldquo;Membumikan Fiqih di Setiap Lini Kehidupan&rdquo;
          </blockquote>
        </motion.div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SECTION 2: Kurikulum — format baru sesuai prompt
// Label + headline besar + 3-kolom grid (menggantikan layout timeline)
// ────────────────────────────────────────────────────────────────────────────
function CurriculumSection() {
  return (
    <section className="bg-background py-16 sm:py-24">
      <div className="container mx-auto px-5 sm:px-8 lg:px-16 max-w-[1200px]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
        <p className="text-xs font-semibold tracking-wider uppercase mb-4"
          style={{ color: 'hsl(var(--accent))' }}>
          Cara Belajar
        </p>

        <h2 className="font-serif text-4xl sm:text-5xl font-bold text-foreground max-w-2xl leading-tight">
          Dari cari kelas sampai mulai belajar,{' '}
          <span className="text-primary">cuma butuh 3 langkah.</span>
        </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-14">
          {CURRICULUM_STAGES.map((stage, idx) => (
            <motion.div
              key={stage.stage}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: Math.min(idx * 0.05, 0.3), ease: 'easeOut' }}
              className="flex flex-col"
            >
              {/* Nomor dekoratif */}
              <p
                className="font-serif text-6xl font-bold leading-none mb-5 select-none"
                style={{ color: 'hsl(var(--primary) / 0.12)' }}
              >
                {stage.stage}
              </p>
              {/* Label subtahap */}
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2"
                style={{ color: 'hsl(var(--accent))' }}>
                {stage.subtitle}
              </p>
              <h3 className="font-serif text-xl font-bold text-foreground mb-3 leading-snug">
                {stage.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                {stage.description}
              </p>
              {/* Tag topik */}
              <div className="flex flex-wrap gap-2 mt-5">
                {stage.topics.map((topic) => (
                  <span
                    key={topic}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-12">
          <motion.div
            className="inline-block"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            <Button
              asChild
              variant="outline"
              className="h-[44px] px-6 text-sm font-semibold rounded-[10px] border-2 border-[hsl(var(--accent))] text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/5"
            >
              <Link href="/katalog">
                Lihat Semua Kelas
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SECTION 3: Tentang Markaz Fiqih — pengajar utama + galeri foto
// ────────────────────────────────────────────────────────────────────────────
function AsymmetricStatsSection() {

  return (
    <section className="bg-muted/30 border-y border-border">
      <div className="container mx-auto px-5 sm:px-8 lg:px-16 py-16 sm:py-20 max-w-[1200px]">

        {/* Header — tidak diubah */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mb-10 max-w-2xl"
        >
          <p className="text-xs font-semibold tracking-wider uppercase mb-4"
            style={{ color: 'hsl(var(--accent))' }}>
            Tentang Markaz Fiqih
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground leading-tight">
            Pusat Rujukan Fiqih{' '}
            <span className="text-primary">Berlandaskan Madzhab Syafi'i.</span>
          </h2>
          <p className="text-muted-foreground text-base mt-4 leading-relaxed">
            Markaz Fiqih adalah lembaga keilmuan independen yang berfokus pada edukasi,
            publikasi, kaderisasi dan pengembangan kajian fiqih. Dirintis
            oleh pelajar Indonesia yang menempuh studi langsung di Al-Azhar, Kairo, kami
            hadir agar siapa pun bisa mempelajari fiqih dengan metode yang tepat dan terstruktur.
          </p>
        </motion.div>

        {/* Galeri foto — satu grid asimetris 3×3, foto-1 besar pojok kiri */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="grid grid-cols-3 gap-3"
          style={{ gridTemplateRows: '200px 200px 180px' }}
        >
          {/* Foto 1 — 2 kolom × 2 baris */}
          <div className="col-span-2 row-span-2 rounded-2xl overflow-hidden group">
            <img src={GALLERY_PHOTOS[0].src} alt={GALLERY_PHOTOS[0].alt} loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          </div>
          {/* Foto 2 — kolom kanan baris 1 */}
          <div className="rounded-2xl overflow-hidden group">
            <img src={GALLERY_PHOTOS[1].src} alt={GALLERY_PHOTOS[1].alt} loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          </div>
          {/* Foto 3 — kolom kanan baris 2 */}
          <div className="rounded-2xl overflow-hidden group">
            <img src={GALLERY_PHOTOS[2].src} alt={GALLERY_PHOTOS[2].alt} loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          </div>
          {/* Foto 4, 5, 6 — baris bawah penuh */}
          {GALLERY_PHOTOS.slice(3, 6).map((photo) => (
            <div key={photo.src} className="rounded-2xl overflow-hidden group">
              <img src={photo.src} alt={photo.alt} loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SECTION 3b: Metode Keilmuan — prinsip dasar + urutan rujukan 4 tingkat
// ────────────────────────────────────────────────────────────────────────────
const METHOD_REFERENCES = [
  {
    number: '01',
    text: 'Pendapat mu\u2019tamad dalam madzhab Syafi\u2019i',
  },
  {
    number: '02',
    text: 'Pendapat dha\u2019if dalam madzhab Syafi\u2019i',
  },
  {
    number: '03',
    text: 'Ikhtiyar para ulama madzhab Syafi\u2019i',
  },
  {
    number: '04',
    text: 'Pendapat mu\u2019tabar dari madzhab-madzhab fiqih lainnya (khususnya empat madzhab)',
  },
];

function MethodologySection() {
  return (
    <section className="bg-background border-b border-border">
      <div className="container mx-auto px-5 sm:px-8 lg:px-16 py-16 sm:py-20 max-w-[1200px]">
        {/* Blok teks — full width di atas, lebar dibatasi */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="max-w-2xl"
        >
          <p
            className="text-xs font-semibold tracking-wider uppercase mb-4"
            style={{ color: 'hsl(var(--accent))' }}
          >
            Metode Keilmuan
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground leading-tight">
            Madzhab Syafi'i{' '}
            <span className="text-primary">Yang Solutif</span>
          </h2>
          <p className="text-muted-foreground text-base mt-4 leading-relaxed">
            Markaz Fiqih berpijak pada fiqih madzhab Syafi&rsquo;i yang solutif, dengan
            tetap terbuka terhadap pendapat madzhab lain selama termasuk pendapat yang
            mu&rsquo;tabar, diakui validitasnya sesuai kaidah ilmu.
          </p>
        </motion.div>

        {/* Label kecil di atas grid — sisi kiri, sebelum 4 card dimulai */}
        <p
          className="text-[10px] font-bold uppercase tracking-[0.18em] mt-10"
          style={{ color: 'hsl(var(--accent))' }}
        >
          Urutan Rujukan
        </p>

        {/* Grid 4 card urutan rujukan — sejajar horizontal di bawah teks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mt-10">
          {METHOD_REFERENCES.map((ref, idx) => (
            <motion.div
              key={ref.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: Math.min(idx * 0.05, 0.3), ease: 'easeOut' }}
              className="flex flex-col"
            >
              {/* Nomor dekoratif — sama seperti CurriculumSection */}
              <p
                className="font-serif text-6xl font-bold leading-none mb-5 select-none"
                style={{ color: 'hsl(var(--primary) / 0.12)' }}
              >
                {ref.number}
              </p>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2"
                style={{ color: 'hsl(var(--accent))' }}
              >
                Rujukan {idx + 1}
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                {ref.text}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SECTION 4: Pengajar — grid merata, foto bulat + ring gold
// ────────────────────────────────────────────────────────────────────────────
function InstructorsSection({
  instructors,
  isLoading,
}: {
  instructors: InstructorItem[];
  isLoading: boolean;
}) {
  return (
    <section className="bg-background border-b border-border">
      <div className="container mx-auto px-5 sm:px-8 lg:px-16 py-16 sm:py-20 max-w-[1200px]">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mb-14 text-center"
        >
          <p className="text-xs font-semibold tracking-wider uppercase mb-4"
            style={{ color: 'hsl(var(--accent))' }}>
            Pengajar
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground leading-tight">
            Belajar dari mereka yang menimba ilmu kepada para ulama.
          </h2>
        </motion.div>

        {/* Skeleton loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center gap-4">
                <div className="w-40 h-40 rounded-full bg-muted animate-pulse" />
                <div className="w-36 h-4 rounded bg-muted animate-pulse" />
                <div className="w-24 h-3 rounded bg-muted animate-pulse" />
                <div className="w-48 h-10 rounded bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* Grid pengajar */}
        {!isLoading && instructors.length > 0 && (
          <div className={[
            'grid gap-10',
            instructors.length === 1
              ? 'grid-cols-1 max-w-xs mx-auto'
              : instructors.length === 2
              ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
          ].join(' ')}>
            {instructors.map((instructor, idx) => {
              const initials = instructor.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();
              return (
                <motion.div
                  key={instructor.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: Math.min(idx * 0.05, 0.3), ease: 'easeOut' }}
                  className="flex flex-col items-center text-center gap-4"
                >
                  {/* Foto bulat dengan ring gold */}
                  <div
                    className="relative rounded-full shrink-0"
                    style={{
                      padding: '4px',
                      background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--accent) / 0.4))',
                    }}
                  >
                    <div className="rounded-full overflow-hidden w-36 h-36 bg-muted">
                      {instructor.photoUrl ? (
                        <img
                          src={instructor.photoUrl}
                          alt={instructor.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          style={{ objectPosition: '50% 20%' }}
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{
                            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-red-hover)))',
                          }}
                        >
                          <span className="font-serif text-3xl font-bold text-white/60 select-none">
                            {initials}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Nama */}
                  <div>
                    <p className="font-semibold text-base text-foreground leading-snug">
                      {instructor.name}
                    </p>
                    {/* Kredensial / label Al-Azhar */}
                    <p className="text-sm mt-1 font-medium"
                      style={{ color: 'hsl(var(--accent))' }}>
                      Al-Azhar · Kairo, Mesir
                    </p>
                  </div>

                  {/* Bio */}
                  {instructor.bio && (
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">
                      {instructor.bio}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {!isLoading && instructors.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">Pengajar segera hadir.</p>
        )}
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SECTION 5: Kelas Pilihan — tidak diubah strukturnya
// ────────────────────────────────────────────────────────────────────────────
function FeaturedClassesSection({
  classes,
  isLoading,
}: {
  classes: ClassSummary[];
  isLoading: boolean;
}) {
  return (
    <section className="bg-muted/20">
      <div className="container mx-auto px-5 sm:px-8 lg:px-16 py-16 sm:py-20 max-w-[1200px]">

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex items-end justify-between mb-8 gap-4"
        >
          <div>
            <p
              className="text-[11px] font-bold tracking-[0.2em] uppercase mb-3"
              style={{ color: 'hsl(var(--accent))' }}
            >
              Kelas Tersedia
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground leading-tight">
              Mulai Hari Ini
            </h2>
          </div>
          <motion.div
            className="inline-block hidden sm:block"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="shrink-0 text-sm text-[hsl(var(--accent))] hover:text-[hsl(var(--brand-gold-hover))] hover:bg-[hsl(var(--accent))]/5 font-medium flex"
            >
              <Link href="/katalog">
                Lihat semua
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </motion.div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {isLoading && Array.from({ length: 4 }).map((_, i) => <ClassCardSkeleton key={i} />)}
          {!isLoading && classes.map((cls, idx) => (
            <ClassCard key={cls.id} cls={cls} index={idx} enrolledClassIds={new Set()} />
          ))}
        </div>

        {!isLoading && classes.length === 0 && (
          <p className="text-center text-muted-foreground py-10">
            Belum ada kelas yang dipublikasikan saat ini.
          </p>
        )}

        <div className="flex justify-center mt-10 sm:hidden">
          <motion.div
            className="inline-block"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-[44px] px-6 text-sm font-semibold rounded-[10px] border-2 border-[hsl(var(--accent))] text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/5"
            >
              <Link href="/katalog">
                Lihat Semua Kelas
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SECTION 6: Testimoni — grid 4 card ringkas (prompt: slice(0,4))
// Style: quote icon kecil, border tipis, shadow halus + hover lift
// ────────────────────────────────────────────────────────────────────────────
function TestimonialsSection({
  testimonials,
}: {
  testimonials: TestimonialItem[];
}) {
  if (testimonials.length === 0) return null;

  return (
    <section className="bg-[hsl(var(--brand-red-tint))] border-y border-[hsl(var(--brand-red-border))]">
      <div className="container mx-auto px-5 sm:px-8 lg:px-16 py-16 sm:py-20 max-w-[1200px]">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mb-10"
        >
          <p className="text-xs font-semibold tracking-wider uppercase mb-4"
            style={{ color: 'hsl(var(--primary))' }}>
            Kata Mereka
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-foreground leading-tight">
            Kata Mereka yang Sudah{' '}
            <span className="text-primary">Belajar.</span>
          </h2>
        </motion.div>

        {/* Grid 4 card ringkas: 4 kolom desktop, 2 tablet, 1 mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {testimonials.map((t, idx) => {
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: Math.min(idx * 0.05, 0.3), ease: 'easeOut' }}
                className="rounded-2xl bg-white border border-border p-5 flex flex-col shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                {/* Quote mark kecil */}
                <span
                  className="font-serif font-bold leading-none select-none block mb-2"
                  style={{ fontSize: '2rem', lineHeight: 1, color: 'hsl(var(--accent) / 0.35)' }}
                  aria-hidden="true"
                >
                  &ldquo;
                </span>

                {/* Konten testimoni */}
                <p className="text-sm text-foreground leading-relaxed flex-1">
                  {t.content}
                </p>

                {/* Footer: nama + role (tanpa foto/avatar) */}
                <div className="mt-5 pt-4 border-t border-border">
                  <p className="text-xs font-semibold text-foreground leading-tight truncate">{t.name}</p>
                  {t.role && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{t.role}</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SECTION 7: CTA + Footer — digabung jadi satu section footer yang koheren
// ────────────────────────────────────────────────────────────────────────────
function ContactSection({
  socialLinks,
  contactPhone,
}: {
  socialLinks: Array<{ label: string; icon: typeof Instagram | typeof TikTokIcon; href: string }>;
  contactPhone: string | null;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary to-[hsl(var(--brand-red-hover))]">
      {/* Pattern — identik dengan Hero section (hero-pattern.png) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 mix-blend-multiply"
        style={{
          backgroundImage: "url('/hero-pattern.png')",
          backgroundSize: '900px',
          backgroundRepeat: 'repeat',
        }}
      />

      {/* Logo watermark — pojok kanan-bawah, utuh dalam batas section */}
      <img
        src="/logo.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-4 right-4 w-48 h-48 sm:w-56 sm:h-56 object-contain opacity-[0.07] select-none"
      />

      <div className="relative z-10 container mx-auto px-5 sm:px-8 lg:px-16 max-w-[1200px]">
        {/* Bagian atas — CTA ringkas + tombol WA + ikon sosmed */}
        <div className="py-12 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-md">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white leading-tight mb-2">
              Mau mulai atau masih bingung?
            </h2>
            <p className="text-white/70 text-sm leading-relaxed">
              Chat langsung dengan kami, atau ikuti media sosial untuk info kelas terbaru.
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {contactPhone && (
              <motion.a
                href={toWaUrl(contactPhone)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 h-[48px] px-7 rounded-[10px] bg-[hsl(var(--accent))] text-white text-sm font-semibold hover:bg-[hsl(var(--brand-gold-hover))] shadow-lg transition-colors duration-150 shrink-0"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                Chat via WhatsApp
              </motion.a>
            )}
            <div className="flex items-center gap-3">
              {socialLinks.map(({ label, icon: Icon, href }) => (
                <motion.a
                  key={label}
                  href={href || '#'}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-9 w-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-colors duration-150"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                >
                  <Icon className="h-4 w-4" />
                </motion.a>
              ))}
            </div>
          </div>
        </div>

        {/* Bagian bawah — identitas & copyright, dipisahkan garis tipis */}
        <div className="border-t border-white/10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <img
            src="/logo.png"
            alt="Markaz Fiqih"
            loading="lazy"
            className="h-6 w-auto brightness-0 invert"
          />
          <p className="text-xs text-white/60">
            © {new Date().getFullYear()} Markaz Fiqih. Seluruh hak cipta dilindungi.
          </p>
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Halaman Landing — root
// ────────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, setLocation] = useLocation();

  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: () => listClasses() });
  const instructorsQuery = useQuery({ queryKey: ['instructors'], queryFn: listInstructors });
  const testimonialsQuery = useQuery({ queryKey: ['testimonials'], queryFn: listTestimonials });
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: getSettings });

  const allClasses: ClassSummary[] = Array.isArray(classesQuery.data) ? classesQuery.data : [];
  const rawInstructors = Array.isArray(instructorsQuery.data) ? instructorsQuery.data : [];
  const instructors: InstructorItem[] = rawInstructors.map((inst) => ({
    ...inst,
    bio: inst.bio ?? undefined,
  }));
  // Prompt: slice(0, 4) untuk testimoni
  const allTestimonials: TestimonialItem[] = Array.isArray(testimonialsQuery.data)
    ? testimonialsQuery.data
    : [];
  const testimonials = allTestimonials.slice(0, 4);
  const settings = settingsQuery.data;

  const featuredClasses = useMemo(() => allClasses.slice(0, 4), [allClasses]);
  const socialLinks = useMemo(() => buildSocialLinks(settings ?? undefined), [settings]);

  // Untuk section tentang: pengajar pertama sebagai featured
  const featuredInstructor = instructors[0] ?? null;

  useEffect(() => {
    if (!isAuthLoading && user) {
      setLocation('/dashboard');
    }
  }, [isAuthLoading, user, setLocation]);

  if (isAuthLoading || user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        <SEO />
        {/* 1. Hero — copy lebih personal, badge kredibilitas dari data nyata */}
        <HeroSection
          socialLinks={socialLinks}
          totalClasses={allClasses.length}
          studentCountLabel={settings?.studentCountLabel}
        />

        {/* 2. Kurikulum — format baru: label + headline besar + 3-kolom grid */}
        <CurriculumSection />

        {/* 3. Kelas Pilihan */}
        <FeaturedClassesSection
          classes={featuredClasses}
          isLoading={classesQuery.isLoading}
        />

        {/* 4. Pengajar — 1 featured besar + sisanya list kecil */}
        {(instructorsQuery.isLoading || instructors.length > 0) && (
          <InstructorsSection
            instructors={instructors}
            isLoading={instructorsQuery.isLoading}
          />
        )}

        {/* 5. Tentang Markaz Fiqih — galeri foto */}
        <AsymmetricStatsSection />

        {/* 5b. Metode Keilmuan — prinsip dasar + urutan rujukan */}
        <MethodologySection />

        {/* 6. Testimoni — grid 4 card */}
        <TestimonialsSection testimonials={testimonials} />

        {/* 7. CTA + Footer — digabung jadi satu section */}
        <ContactSection
          socialLinks={socialLinks}
          contactPhone={settings?.contactPhone ?? null}
        />
      </main>
      <FloatingWhatsAppButton />
    </div>
  );
}
