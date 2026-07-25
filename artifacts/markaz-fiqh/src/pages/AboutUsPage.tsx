import { motion } from 'framer-motion';
import { Instagram, Facebook, Youtube } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { getSettings } from '@/lib/db';

// ── Ikon TikTok (reused dari LandingPage) ────────────────────────────────────
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.6 5.82c-.9-.88-1.4-2.08-1.4-3.32h-3.13v13.44c0 1.6-1.3 2.9-2.9 2.9a2.9 2.9 0 0 1 0-5.8c.27 0 .53.03.78.1V9.98a6.03 6.03 0 0 0-.78-.05A6.03 6.03 0 0 0 3.15 16a6.03 6.03 0 0 0 6.02 6.02A6.03 6.03 0 0 0 15.19 16V8.66a8.16 8.16 0 0 0 4.76 1.52V7.05a4.85 4.85 0 0 1-3.35-1.23Z" />
    </svg>
  );
}

// ── Data statis ───────────────────────────────────────────────────────────────
const METHOD_REFERENCES = [
  { number: '01', text: 'Pendapat mu\u2019tamad dalam madzhab Syafi\u2019i.' },
  { number: '02', text: 'Pendapat dha\u2019if dalam madzhab Syafi\u2019i.' },
  { number: '03', text: 'Ikhtiyar para ulama madzhab Syafi\u2019i.' },
  {
    number: '04',
    text: 'Pendapat mu\u2019tabar dari madzhab-madzhab fiqih lainnya, khususnya empat madzhab.',
  },
];

const TEMATIK_CLASSES = [
  'Fiqih Islam Itu Mudah',
  'Fiqih Wudhu Mandi dan Tayamum',
  'Fiqih Najis',
  'Fiqih Alkohol',
  'Fiqih Darah Wanita',
  'Fiqih Shalat Jamaah',
  'Fiqih Shalat dan Khutbah Jumat',
  'Fiqih Shalat Ied',
  'Fiqih Safar',
  'Fiqih Zakat Fitri',
  'Fiqih Puasa',
  'Fiqih Puasa Syawwal',
  'Fiqih Tarawih',
  'Fiqih Haji Umrah',
  'Fiqih Umrah',
  'Fiqih Badal Haji Umrah',
  'Fiqih Kurban',
  'Fiqih Muamalah Kontemporer',
  'Fiqih Nikah',
  'Fiqih Talak',
  'Fiqih Maulud',
];

// ── Halaman ───────────────────────────────────────────────────────────────────
export function AboutUsPage() {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    staleTime: 5 * 60 * 1000,
  });

  const adminContent = settings?.aboutUsContent?.trim();

  const socialLinks = [
    {
      label: 'Instagram',
      icon: Instagram,
      href: settings?.socialInstagram || 'https://www.instagram.com/markazfiqih',
    },
    {
      label: 'Facebook',
      icon: Facebook,
      href: settings?.socialFacebook || 'https://facebook.com/markazfiqih',
    },
    {
      label: 'TikTok',
      icon: TikTokIcon,
      href: settings?.socialTiktok || 'https://www.tiktok.com/@markazfiqih',
    },
    {
      label: 'YouTube',
      icon: Youtube,
      href: settings?.socialYoutube || '',
    },
  ] as Array<{ label: string; icon: typeof Instagram | typeof TikTokIcon; href: string }>;

  return (
    <AppShell>
        <main className="min-h-screen bg-background">
          <div className="container mx-auto px-5 sm:px-8 lg:px-16 py-16 sm:py-20 max-w-[800px]">

            {/* ── Hero ──────────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="mb-10"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--accent))] mb-2">
                Tentang Kami
              </p>
              <h1 className="font-serif text-3xl lg:text-4xl font-bold text-foreground">
                Tentang Markaz Fiqih
              </h1>
              <p className="font-serif text-lg italic text-primary mt-3">
                Pusat Rujukan Fiqih Berlandaskan Madzhab Syafi'i
              </p>
            </motion.div>

            {/* ── Deskripsi Umum ────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
            >
              {adminContent ? (
                <div className="space-y-4 text-muted-foreground leading-relaxed mb-12 whitespace-pre-line">
                  {adminContent}
                </div>
              ) : (
                <div className="space-y-4 text-muted-foreground leading-relaxed mb-12">
                  <p>
                    Markaz Fiqih adalah lembaga keilmuan yang berfokus pada edukasi, kaderisasi,
                    publikasi dan pengembangan kajian fiqih. Dirintis oleh alumni Universitas
                    Al-Azhar, Kairo, Markaz Fiqih hadir dengan cita-cita menjadi pusat rujukan
                    fiqih yang berlandaskan madzhab Syafi'i. Membawa visi: membumikan fiqih di
                    setiap lini kehidupan.
                  </p>
                  <p>
                    Markaz Fiqih terbuka bagi seluruh lapisan masyarakat, mulai dari masyarakat
                    umum, mahasiswa, santri, hingga para asatidz yang ingin memperdalam fiqih
                    secara sistematis.
                  </p>
                  <p>
                    Metode fiqih yang diusung oleh Markaz Fiqih adalah fiqih madzhab Syafi'i yang
                    bersifat solutif, artinya tetap terbuka terhadap pendapat madzhab lain selama
                    termasuk pendapat yang mu'tabar, diakui validitasnya berdasarkan kaidah
                    keilmuan Islam.
                  </p>
                  <p>
                    Dengan pendekatan ini, kami berupaya menghadirkan kajian fiqih yang ilmiah,
                    aplikatif, dan relevan dengan kebutuhan masyarakat. Sejalan dengan semangat
                    kami bahwa:{' '}
                    <em className="text-primary font-medium">Fiqih Islam Itu Mudah.</em>
                  </p>
                </div>
              )}
            </motion.div>

            {/* ── Urutan Rujukan ────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="mb-12"
            >
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em] mb-6"
                style={{ color: 'hsl(var(--accent))' }}
              >
                Urutan Rujukan
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {METHOD_REFERENCES.map((ref, idx) => (
                  <motion.div
                    key={ref.number}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: Math.min(idx * 0.05, 0.2), ease: 'easeOut' }}
                    className="flex flex-col"
                  >
                    <p
                      className="font-serif text-6xl font-bold leading-none mb-4 select-none"
                      style={{ color: 'hsl(var(--primary) / 0.12)' }}
                    >
                      {ref.number}
                    </p>
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1.5"
                      style={{ color: 'hsl(var(--accent))' }}
                    >
                      Rujukan {idx + 1}
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">{ref.text}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* ── Paragraf Penutup Metodologi ───────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="space-y-4 text-muted-foreground leading-relaxed mb-12"
            >
              <p>
                Pada prinsipnya, kami membatasi diri pada pendapat mu'tamad madzhab selama
                telah memadai untuk menjawab permasalahan yang dihadapi. Adapun rujukan
                selainnya hanya digunakan apabila terdapat kebutuhan, guna menjaga
                keteraturan dalam amal.
              </p>
              <p>
                Fokus utama Markaz Fiqih bukan melakukan tarjih antar pendapat, melainkan
                memberikan arahan dan solusi fiqih yang dapat dipertanggungjawabkan secara
                ilmiah.
              </p>
            </motion.div>

            {/* ── Section Kelas Markaz Fiqih ────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="border-t pt-10 mt-10"
            >
              <h2 className="font-serif text-2xl font-bold text-foreground">
                Kelas Markaz Fiqih
              </h2>
              <p className="text-muted-foreground mt-2 leading-relaxed">
                Kelas Markaz Fiqih dirancang untuk memenuhi kebutuhan belajar masyarakat,
                mulai dari pemula hingga penuntut ilmu yang ingin mendalami fiqih secara
                akademis. Program ini diadakan dengan harapan bisa menjadi tempat belajar
                fiqih madzhab Syafi'i yang sistematis dan terstruktur.
              </p>
              <p className="text-muted-foreground mt-2">Saat ini tersedia tiga program utama:</p>

              {/* 3 Card Program — vertikal, space-y-6 */}
              <div className="space-y-6 mt-6">

                {/* Program 1 — Fiqih Tematik */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="bg-card rounded-2xl border p-6 space-y-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--accent))]">
                    Program 1
                  </p>
                  <h3 className="font-serif text-xl font-bold text-foreground">
                    Kelas Fiqih Tematik
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Kelas Fiqih Tematik merupakan program yang membahas tema-tema fiqih
                    tertentu yang berkaitan erat dengan kehidupan sehari-hari, baik dalam
                    bidang ibadah maupun muamalah. Program ini bertujuan memberikan pemahaman
                    yang benar terhadap persoalan fiqih yang sering dihadapi masyarakat
                    berdasarkan madzhab Syafi'i, disertai penyebutan solusi dari pendapat
                    madzhab lain yang mu'tabar apabila diperlukan.
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    Hingga saat ini, telah tersedia kelas-kelas berikut:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {TEMATIK_CLASSES.map((name) => (
                      <span
                        key={name}
                        className="rounded-full border px-3 py-1 text-xs text-foreground"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </motion.div>

                {/* Program 2 — Fiqih Kitab */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.05, ease: 'easeOut' }}
                  className="bg-card rounded-2xl border p-6 space-y-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--accent))]">
                    Program 2
                  </p>
                  <h3 className="font-serif text-xl font-bold text-foreground">
                    Kelas Fiqih Kitab
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Kelas Fiqih Kitab merupakan program pembelajaran berjenjang yang disusun
                    untuk membawa peserta mempelajari fiqih madzhab Syafi'i secara sistematis,
                    dimulai dari kitab-kitab dasar hingga kitab-kitab rujukan utama. Berbeda
                    dengan Kelas Fiqih Tematik yang berorientasi pada penyelesaian persoalan
                    fiqih tertentu, program ini bertujuan membangun malakah fiqhiyyah, yaitu
                    kemampuan memahami, menganalisis, dan menguasai fiqih secara metodologis.
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    Kurikulum yang direncanakan meliputi:
                  </p>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Safinatu an-Naja</li>
                    <li>Al-Mukhtashar al-Lathif</li>
                    <li>Al-Muqaddimah al-Hadhramiyyah</li>
                    <li>Al-Yaqut an-Nafis</li>
                    <li>'Umdah as-Salik</li>
                    <li>Minhaj at-Thalibin</li>
                  </ol>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Setiap jenjang disusun untuk membangun kemampuan membaca kitab fiqih,
                    memahami struktur pendapat dalam madzhab Syafi'i, serta melatih analisis
                    permasalahan fiqih berdasarkan metodologi yang benar.
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Selain kurikulum utama, Kelas Fiqih Kitab juga dilengkapi dengan
                    kelas-kelas pendukung dalam dua bab fiqih yang seringkali dianggap sulit:
                    Haid dan Mawarits. Serta materi-materi yang penting diketahui, seperti:
                    Tarikh al-Madzhab as-Syafi'i, A'lam al-Madzhab, Kutub al-Madzhab,
                    Manhajiyyah at-Tafaqquh, Manhajiyyat al-'Amal, Manhajiyyat al-Ifta',
                    Manhajiyyah al-Bahts al-Fiqhi, Musthalah Fiqih Syafi'i, al-Qaul al-Qadim
                    wa al-Jadid, Ikhtiyarat al-A'immah (al-Muzani, Ibnu al-Mundzir, ar-Ruyani,
                    an-Nawawi, dll), Qawa'id Ushuliyyah, Qawa'id Fiqhiyyah dan lainnya.
                  </p>
                </motion.div>

                {/* Program 3 — Akademi Markaz Fiqih */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
                  className="bg-card rounded-2xl border p-6 space-y-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--accent))]">
                    Program 3
                  </p>
                  <h3 className="font-serif text-xl font-bold text-foreground">
                    Akademi Markaz Fiqih
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Akademi Markaz Fiqih merupakan program spesialisasi yang bertujuan mencetak
                    kader-kader ahli pada bidang-bidang fiqih tertentu melalui pembelajaran
                    yang lebih mendalam dan terarah. Akademi membawahi sejumlah program,
                    diantaranya:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    <li>Sekolah Mutafaqqih</li>
                    <li>
                      Sekolah Fiqih Wanita{' '}
                      <span className="text-xs italic text-[hsl(var(--accent))]">(coming soon)</span>
                    </li>
                    <li>
                      Sekolah Fiqih Haji Umrah{' '}
                      <span className="text-xs italic text-[hsl(var(--accent))]">(coming soon)</span>
                    </li>
                    <li>
                      Sekolah Fiqih Muamalat{' '}
                      <span className="text-xs italic text-[hsl(var(--accent))]">(coming soon)</span>
                    </li>
                    <li>
                      Sekolah Fiqih Wakaf{' '}
                      <span className="text-xs italic text-[hsl(var(--accent))]">(coming soon)</span>
                    </li>
                    <li>
                      Sekolah Fiqih Waris{' '}
                      <span className="text-xs italic text-[hsl(var(--accent))]">(coming soon)</span>
                    </li>
                    <li>
                      Sekolah Fiqih Pernikahan{' '}
                      <span className="text-xs italic text-[hsl(var(--accent))]">(coming soon)</span>
                    </li>
                  </ul>
                </motion.div>
              </div>
            </motion.div>

            {/* ── Paragraf Penutup ──────────────────────────────────────── */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="text-muted-foreground leading-relaxed mt-10"
            >
              Markaz Fiqih berkomitmen untuk terus menghadirkan fiqih yang mudah dipahami,
              ilmiah, dan berlandaskan kaidah keilmuan. Kami berharap dapat menjadi wasilah
              lahirnya generasi mutafaqqih yang mampu menghadirkan solusi fiqih secara bijaksana
              di tengah masyarakat, dengan cita-cita agar fiqih tidak hanya difahami dalam
              bentuk teori, melainkan juga membumi, dengan diamalkan dan diterapkan dalam setiap
              lini kehidupan.
            </motion.p>

            {/* ── Ikuti Kami ────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="border-t pt-8 mt-8 text-center"
            >
              <p className="font-serif text-lg font-bold text-foreground mb-4">Ikuti Kami</p>
              <div className="flex justify-center gap-4">
                {socialLinks.map(({ label, icon: Icon, href }) =>
                  href ? (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="flex items-center justify-center w-10 h-10 rounded-full border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                    </a>
                  ) : null,
                )}
              </div>
              <p className="font-serif text-sm italic text-primary mt-6">
                Markaz Fiqih — Membumikan Fiqih di Setiap Lini Kehidupan.
              </p>
            </motion.div>

          </div>
        </main>
      </AppShell>
  );
}
