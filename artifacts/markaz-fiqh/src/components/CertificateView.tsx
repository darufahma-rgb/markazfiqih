import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSettings, type CertificateRequest } from '@/lib/db';
import { Loader2, Printer, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { mergeOverlayConfig } from '@/lib/certificateOverlayDefaults';

function formatTanggal(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

interface CertificateViewProps {
  cert: CertificateRequest;
  showPrintButton?: boolean;
}

export function CertificateView({ cert, showPrintButton = true }: CertificateViewProps) {
  const certificateRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const activeTemplate =
    cert.certificateTemplateUrl?.trim() ||
    settings?.certificateDefaultTemplateUrl?.trim() ||
    null;

  const hasTemplate = !!activeTemplate;

  const overlayConfig = mergeOverlayConfig(settings?.certificateOverlayConfig ?? null);
  const fontUrl = overlayConfig.fontUrl ?? null;
  const customFontFamily = fontUrl ? "'sertifikat-custom-font', serif" : undefined;

  const handleDownloadPdf = async () => {
    if (!certificateRef.current || !cert) return;
    setIsDownloading(true);
    try {
      const safeName = (cert.fullName || 'peserta').replace(/[^a-zA-Z0-9]+/g, '-');
      const safeClass = (cert.classTitle || 'kelas').replace(/[^a-zA-Z0-9]+/g, '-');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth(); // 297mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 210mm

      if (hasTemplate) {
        let resolvedFontFamily = 'Georgia, serif';
        if (fontUrl) {
          try {
            const ff700 = new FontFace('sertifikat-custom-font', `url(${fontUrl})`, { weight: '700' });
            const ff400 = new FontFace('sertifikat-custom-font', `url(${fontUrl})`, { weight: '400' });
            await Promise.all([ff700.load(), ff400.load()]);
            document.fonts.add(ff700);
            document.fonts.add(ff400);
            resolvedFontFamily = "'sertifikat-custom-font', serif";
          } catch {
            // fallback
          }
        }

        const templateImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = activeTemplate!;
        });

        const SCALE = 3;
        const W = templateImg.naturalWidth * SCALE;
        const H = templateImg.naturalHeight * SCALE;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d')!;

        ctx.drawImage(templateImg, 0, 0, W, H);

        const drawText = (
          text: string,
          cfg: typeof overlayConfig.nama,
          weight: '400' | '700',
        ) => {
          const x = (cfg.left / 100) * W;
          const y = (cfg.top / 100) * H;
          const px = (cfg.fontSize / 100) * W;
          ctx.save();
          ctx.font = `${weight} ${px}px ${resolvedFontFamily}`;
          ctx.fillStyle = cfg.color;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, x, y);
          ctx.restore();
        };

        drawText(cert.fullName, overlayConfig.nama, '700');
        drawText(cert.classTitle, overlayConfig.kelas, '400');
        drawText(formatTanggal(cert.issuedAt), overlayConfig.tanggal, '400');

        const imgData = canvas.toDataURL('image/png', 1.0);
        const canvasRatio = W / H;
        const pageRatio = pageWidth / pageHeight;
        let rW = pageWidth, rH = pageHeight, oX = 0, oY = 0;
        if (canvasRatio > pageRatio) { rH = pageWidth / canvasRatio; oY = (pageHeight - rH) / 2; }
        else { rW = pageHeight * canvasRatio; oX = (pageWidth - rW) / 2; }
        pdf.addImage(imgData, 'PNG', oX, oY, rW, rH);

      } else {
        await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const canvas = await html2canvas(certificateRef.current, {
          scale: 3,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
        });
        const imgData = canvas.toDataURL('image/png', 1.0);
        pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
      }

      pdf.save(`Sertifikat-${safeClass}-${safeName}.pdf`);
    } catch {
      toast.error('Gagal membuat file PDF, coba lagi.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full items-center">
      {/* CSS Khusus Print A4 Landscape */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Tombol aksi */}
      <div className="flex gap-2 justify-end w-full max-w-5xl no-print">
        {showPrintButton && (
          <Button onClick={() => window.print()} variant="outline" className="gap-2">
            <Printer className="w-4 h-4" />
            Cetak / Print
          </Button>
        )}
        <Button onClick={handleDownloadPdf} disabled={isDownloading} className="gap-2">
          {isDownloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Mengunduh...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download PDF (A4 Landscape)
            </>
          )}
        </Button>
      </div>

      {hasTemplate ? (
        /* ── Mode Template ───────────────────────────────────────────── */
        <div className="w-full max-w-5xl flex flex-col items-center">
          <div
            ref={certificateRef}
            className="relative w-full aspect-[297/210] overflow-hidden bg-white shadow-xl rounded-lg"
            style={{ containerType: 'inline-size' }}
          >
            {fontUrl && (
              <style>{`@font-face { font-family: 'sertifikat-custom-font'; src: url('${fontUrl}'); font-display: swap; }`}</style>
            )}

            <img
              src={activeTemplate!}
              alt="Template Sertifikat"
              crossOrigin="anonymous"
              className="w-full h-full object-cover block"
            />

            {/* ── Overlay: Nama ── */}
            <p
              className="absolute font-serif font-bold text-center"
              style={{
                left: `${overlayConfig.nama.left}%`,
                top: `${overlayConfig.nama.top}%`,
                transform: 'translate(-50%, -50%)',
                fontSize: `${overlayConfig.nama.fontSize}cqw`,
                color: overlayConfig.nama.color,
                maxWidth: '60%',
                wordWrap: 'break-word',
                lineHeight: 1.2,
                ...(customFontFamily ? { fontFamily: customFontFamily } : {}),
              }}
            >
              {cert.fullName}
            </p>

            {/* ── Overlay: Kelas ── */}
            <p
              className="absolute font-serif text-center"
              style={{
                left: `${overlayConfig.kelas.left}%`,
                top: `${overlayConfig.kelas.top}%`,
                transform: 'translate(-50%, -50%)',
                fontSize: `${overlayConfig.kelas.fontSize}cqw`,
                color: overlayConfig.kelas.color,
                maxWidth: '55%',
                wordWrap: 'break-word',
                lineHeight: 1.3,
                ...(customFontFamily ? { fontFamily: customFontFamily } : {}),
              }}
            >
              {cert.classTitle}
            </p>

            {/* ── Overlay: Tanggal ── */}
            <p
              className="absolute text-center"
              style={{
                left: `${overlayConfig.tanggal.left}%`,
                top: `${overlayConfig.tanggal.top}%`,
                transform: 'translate(-50%, -50%)',
                fontSize: `${overlayConfig.tanggal.fontSize}cqw`,
                color: overlayConfig.tanggal.color,
                whiteSpace: 'nowrap',
                ...(customFontFamily ? { fontFamily: customFontFamily } : {}),
              }}
            >
              {formatTanggal(cert.issuedAt)}
            </p>
          </div>

          <div className="flex justify-center mt-3 no-print">
            <span className="rounded-full bg-muted text-muted-foreground text-xs px-3 py-1.5 inline-block">
              Verifikasi: markaz-fiqih.com/sertifikat/{cert.id}
            </span>
          </div>
        </div>
      ) : (
        /* ── Mode Bawaan Standard A4 Landscape (297 x 210 mm) ─────────────────── */
        <div className="w-full max-w-5xl flex flex-col items-center">
          <div
            ref={certificateRef}
            className="relative w-full aspect-[297/210] bg-white rounded-xl overflow-hidden flex flex-col justify-between p-[4%] text-center box-border shadow-2xl border-2 border-[#c8a96e]"
            style={{
              containerType: 'inline-size',
              backgroundImage: 'url(/hero-pattern.png)',
              backgroundRepeat: 'repeat',
              backgroundSize: '240px',
            }}
          >
            {/* Overlay tipis putih */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'rgba(255,255,255,0.92)' }}
            />

            {/* Border ornamental dalam */}
            <div
              className="absolute inset-[12px] rounded-lg pointer-events-none"
              style={{ border: '1.5px solid #e8d5a3' }}
            />

            {/* Header: Logo & Title */}
            <div className="relative z-10 flex flex-col items-center gap-[1.5cqw]">
              <img
                src="/logo.png"
                alt="Markaz Fiqih"
                className="h-[6cqw] w-auto object-contain"
              />

              <div className="space-y-[0.3cqw]">
                <p className="text-[1.2cqw] font-bold uppercase tracking-[0.3em] text-[#c8a96e]">
                  Markaz Fiqih
                </p>
                <h1
                  className="font-serif font-bold text-foreground"
                  style={{ fontSize: '3.6cqw', letterSpacing: '0.12em', lineHeight: 1 }}
                >
                  SERTIFIKAT
                </h1>
                <p className="text-[1.3cqw] text-muted-foreground tracking-widest uppercase font-medium">
                  Keikutsertaan Kelas
                </p>
              </div>
            </div>

            {/* Content: Recipient & Course */}
            <div className="relative z-10 flex flex-col items-center my-[1cqw] gap-[1cqw]">
              <div className="flex items-center gap-3 w-full max-w-xs opacity-70">
                <div className="flex-1 h-px bg-[#c8a96e]" />
                <span className="text-[#c8a96e] text-[1.5cqw]">✦</span>
                <div className="flex-1 h-px bg-[#c8a96e]" />
              </div>

              <div className="space-y-[0.3cqw]">
                <p className="text-[1.3cqw] text-muted-foreground">Diberikan kepada</p>
                <p
                  className="font-serif font-bold text-foreground"
                  style={{ fontSize: '3.2cqw', lineHeight: 1.15 }}
                >
                  {cert.fullName}
                </p>
              </div>

              <div className="space-y-[0.2cqw] max-w-xl">
                <p className="text-[1.2cqw] text-muted-foreground">atas keikutsertaan dalam kelas</p>
                <p className="font-serif text-[2.2cqw] font-semibold text-foreground leading-snug">
                  {cert.classTitle}
                </p>
              </div>

              {cert.score && (
                <div className="px-4 py-1 rounded-full border border-[#c8a96e]/40 bg-[#fdf8ee]">
                  <p className="text-[1.2cqw] text-foreground">
                    Nilai Ujian / Latihan:{' '}
                    <span className="font-bold text-[#b8860b]">{cert.score}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Footer: Cert No & Date */}
            <div className="relative z-10 w-full flex items-end justify-between text-[1.2cqw] text-muted-foreground pt-[1cqw] border-t border-[#c8a96e]/30">
              <div className="text-left space-y-0.5">
                <p className="uppercase tracking-wide font-semibold text-[0.9cqw]">
                  Nomor Sertifikat
                </p>
                <p className="font-mono text-[1.3cqw] font-semibold text-foreground">
                  {cert.certificateNumber}
                </p>
              </div>

              <div className="text-center space-y-1">
                <p className="text-[1.1cqw] text-muted-foreground italic">
                  Diterbitkan melalui platform Kelas Markaz Fiqih
                </p>
              </div>

              <div className="text-right space-y-0.5">
                <p className="uppercase tracking-wide font-semibold text-[0.9cqw]">
                  Tanggal Terbit
                </p>
                <p className="text-[1.3cqw] font-semibold text-foreground">
                  {formatTanggal(cert.issuedAt)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
