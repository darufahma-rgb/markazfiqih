export type OverlayFieldConfig = {
  left: number;
  top: number;
  fontSize: number;
  color: string;
};

export type CertificateOverlayConfig = {
  nama?: Partial<OverlayFieldConfig>;
  kelas?: Partial<OverlayFieldConfig>;
  tanggal?: Partial<OverlayFieldConfig>;
  fontUrl?: string | null;
};

// Template resmi yang ikut dibundel (public/sertifikat-template.png, 1123×794).
// Dipakai kalau kelas maupun pengaturan global belum menetapkan template sendiri.
export const BUNDLED_CERTIFICATE_TEMPLATE = '/sertifikat-template.png';

// Font yang sama dengan tulisan di template (geometric sans).
export const CERTIFICATE_FONT_FAMILY = "'Plus Jakarta Sans', sans-serif";

// Posisi default dicocokkan ke kotak di template bawaan:
// - Nama   → kotak putih  (x 218–922, y 269–366 px) → teks gelap
// - Kelas  → kotak garis  (x 350–772, y 426–463 px) di atas background merah → teks putih
// - Tanggal→ di atas garis samping "Tanggal," (x 85–230, garis y≈750 px) → teks putih
export const DEFAULT_OVERLAY_CONFIG: Record<string, OverlayFieldConfig> & {
  nama: OverlayFieldConfig;
  kelas: OverlayFieldConfig;
  tanggal: OverlayFieldConfig;
} = {
  nama:    { left: 50.8, top: 40.1, fontSize: 3.5,  color: '#241c1b' },
  kelas:   { left: 50,   top: 56,   fontSize: 1.9,  color: '#ffffff' },
  tanggal: { left: 14,   top: 91.8, fontSize: 1.45, color: '#ffffff' },
};

// Lebar maksimum teks (% lebar sertifikat) supaya tidak keluar dari kotaknya.
// Teks yang lebih panjang otomatis dikecilkan, bukan dipotong / turun baris.
export const OVERLAY_MAX_WIDTH_PCT = { nama: 58, kelas: 35, tanggal: 18 } as const;

export const OVERLAY_FONT_WEIGHT = { nama: 700, kelas: 700, tanggal: 400 } as const;

let measureCtx: CanvasRenderingContext2D | null = null;

/**
 * Ukuran font (satuan % lebar sertifikat) yang dipakai: `baseSize`, atau lebih
 * kecil kalau teksnya lebih lebar dari `maxWidthPct`. Hasilnya tidak bergantung
 * pada ukuran layar, jadi preview, halaman sertifikat, dan PDF selalu sama.
 */
export function fitOverlayFontSize(
  text: string,
  baseSize: number,
  maxWidthPct: number,
  weight: number,
  fontFamily: string,
): number {
  if (!text) return baseSize;
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return baseSize;
  measureCtx.font = `${weight} 100px ${fontFamily}`;
  const widthAt100 = measureCtx.measureText(text).width;
  if (widthAt100 <= 0) return baseSize;
  return Math.min(baseSize, (maxWidthPct * 100) / widthAt100);
}

export type MergedOverlayConfig = {
  nama: OverlayFieldConfig;
  kelas: OverlayFieldConfig;
  tanggal: OverlayFieldConfig;
  fontUrl: string | null;
};

/** Merge saved config (per-field) di atas default. fontUrl default null. */
export function mergeOverlayConfig(saved: CertificateOverlayConfig | null | undefined): MergedOverlayConfig {
  return {
    nama:    { ...DEFAULT_OVERLAY_CONFIG.nama,    ...(saved?.nama    ?? {}) },
    kelas:   { ...DEFAULT_OVERLAY_CONFIG.kelas,   ...(saved?.kelas   ?? {}) },
    tanggal: { ...DEFAULT_OVERLAY_CONFIG.tanggal, ...(saved?.tanggal ?? {}) },
    fontUrl: saved?.fontUrl ?? null,
  };
}
