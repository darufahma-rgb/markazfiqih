import type { ImgHTMLAttributes } from 'react';

/**
 * Satu-satunya tempat path file logo Markaz Fiqih didefinisikan.
 * Saat file logo baru (mis. versi satu baris / warna branding baru) sudah
 * tersedia, cukup taruh di /public lalu ganti path di sini.
 */
export const BRAND_LOGO_SRC = {
  /** Logo lengkap, warna merah — untuk background terang */
  color: '/logo.png',
  /** Logo lengkap, putih — untuk background merah/gelap */
  white: '/logo-white.png',
  /** Ikon saja, warna merah */
  icon: '/logo-icon.png',
  /** Ikon saja, putih */
  iconWhite: '/logo-icon-white.png',
} as const;

export type BrandLogoVariant = keyof typeof BRAND_LOGO_SRC;

interface BrandLogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  variant?: BrandLogoVariant;
}

export function BrandLogo({ variant = 'color', alt = 'Markaz Fiqih', ...props }: BrandLogoProps) {
  return <img src={BRAND_LOGO_SRC[variant]} alt={alt} {...props} />;
}
