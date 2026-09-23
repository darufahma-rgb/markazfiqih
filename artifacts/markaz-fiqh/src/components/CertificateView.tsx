import { useState } from 'react';
import { type CertificateRequest } from '@/lib/db';
import { Loader2, Printer, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import {
  BUNDLED_CERTIFICATE_TEMPLATE,
  CERTIFICATE_FONT_FAMILY,
  DEFAULT_OVERLAY_CONFIG,
  OVERLAY_FONT_WEIGHT,
  OVERLAY_MAX_WIDTH_PCT,
  fitOverlayFontSize,
} from '@/lib/certificateOverlayDefaults';
import { CertificateOverlayFields } from '@/components/CertificateOverlayFields';

// Semua sertifikat memakai template resmi v2 yang dibundel beserta posisi,
// warna, dan font teks bawaannya. Template/posisi/font yang pernah diatur
// lewat Panel Admin (tersimpan di database) sengaja diabaikan supaya tidak
// ada lagi sertifikat yang tampil dengan desain lama.
const overlayConfig = DEFAULT_OVERLAY_CONFIG;

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
  const [isDownloading, setIsDownloading] = useState(false);

  const values = {
    nama: cert.fullName,
    kelas: cert.classTitle,
    tanggal: formatTanggal(cert.issuedAt),
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const safeName = (cert.fullName || 'peserta').replace(/[^a-zA-Z0-9]+/g, '-');
      const safeClass = (cert.classTitle || 'kelas').replace(/[^a-zA-Z0-9]+/g, '-');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth(); // 297mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // 210mm

      try {
        await Promise.all([
          document.fonts.load(`700 40px ${CERTIFICATE_FONT_FAMILY}`),
          document.fonts.load(`400 40px ${CERTIFICATE_FONT_FAMILY}`),
        ]);
      } catch {
        // fallback ke font sistem
      }

      const templateImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = BUNDLED_CERTIFICATE_TEMPLATE;
      });

      const SCALE = 3;
      const W = templateImg.naturalWidth * SCALE;
      const H = templateImg.naturalHeight * SCALE;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      ctx.drawImage(templateImg, 0, 0, W, H);

      (['nama', 'kelas', 'tanggal'] as const).forEach((field) => {
        const cfg = overlayConfig[field];
        const weight = OVERLAY_FONT_WEIGHT[field];
        const text = values[field];
        const fontSize = fitOverlayFontSize(text, cfg.fontSize, OVERLAY_MAX_WIDTH_PCT[field], weight, CERTIFICATE_FONT_FAMILY);
        ctx.save();
        ctx.font = `${weight} ${(fontSize / 100) * W}px ${CERTIFICATE_FONT_FAMILY}`;
        ctx.fillStyle = cfg.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, (cfg.left / 100) * W, (cfg.top / 100) * H);
        ctx.restore();
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const canvasRatio = W / H;
      const pageRatio = pageWidth / pageHeight;
      let rW = pageWidth, rH = pageHeight, oX = 0, oY = 0;
      if (canvasRatio > pageRatio) { rH = pageWidth / canvasRatio; oY = (pageHeight - rH) / 2; }
      else { rW = pageHeight * canvasRatio; oX = (pageWidth - rW) / 2; }
      pdf.addImage(imgData, 'PNG', oX, oY, rW, rH);

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

      <div className="w-full max-w-5xl flex flex-col items-center">
        <div
          className="relative w-full aspect-[297/210] overflow-hidden bg-white shadow-xl rounded-lg"
          style={{ containerType: 'inline-size' }}
        >
          <img
            src={BUNDLED_CERTIFICATE_TEMPLATE}
            alt="Template Sertifikat"
            className="w-full h-full object-cover block"
          />

          <CertificateOverlayFields config={overlayConfig} values={values} />
        </div>

        <div className="flex justify-center mt-3 no-print">
          <span className="rounded-full bg-muted text-muted-foreground text-xs px-3 py-1.5 inline-block">
            Verifikasi: {window.location.host}/sertifikat/{cert.id}
          </span>
        </div>
      </div>
    </div>
  );
}
