import { useEffect, useState } from 'react';
import {
  CERTIFICATE_FONT_FAMILY,
  OVERLAY_FONT_WEIGHT,
  OVERLAY_MAX_WIDTH_PCT,
  fitOverlayFontSize,
  type OverlayFieldConfig,
} from '@/lib/certificateOverlayDefaults';

type Field = 'nama' | 'kelas' | 'tanggal';

/**
 * Teks Nama / Kelas / Tanggal yang ditempel di atas gambar template sertifikat.
 * Dipakai bersama oleh CertificateView dan preview di Admin → Desain Sertifikat
 * supaya tampilannya identik. Parent wajib punya `container-type: inline-size`.
 */
export function CertificateOverlayFields({
  config,
  values,
  customFontFamily,
}: {
  config: Record<Field, OverlayFieldConfig>;
  values: Record<Field, string>;
  customFontFamily?: string;
}) {
  const fontFamily = customFontFamily ?? CERTIFICATE_FONT_FAMILY;

  // Ukur ulang setelah web font selesai dimuat (ukuran huruf berbeda dari fallback)
  const [, setFontsReady] = useState(0);
  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => { if (!cancelled) setFontsReady((n) => n + 1); });
    return () => { cancelled = true; };
  }, [fontFamily]);

  return (
    <>
      {(['nama', 'kelas', 'tanggal'] as const).map((field) => {
        const cfg = config[field];
        const text = values[field];
        const weight = OVERLAY_FONT_WEIGHT[field];
        const fontSize = fitOverlayFontSize(text, cfg.fontSize, OVERLAY_MAX_WIDTH_PCT[field], weight, fontFamily);
        return (
          <p
            key={field}
            className="absolute text-center pointer-events-none whitespace-nowrap"
            style={{
              left: `${cfg.left}%`,
              top: `${cfg.top}%`,
              transform: 'translate(-50%, -50%)',
              fontSize: `${fontSize}cqw`,
              fontWeight: weight,
              fontFamily,
              color: cfg.color,
              lineHeight: 1.2,
            }}
          >
            {text}
          </p>
        );
      })}
    </>
  );
}
