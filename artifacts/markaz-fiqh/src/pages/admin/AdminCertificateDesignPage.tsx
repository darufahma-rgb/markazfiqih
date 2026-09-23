import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings } from '@/lib/db';
import { toast } from 'sonner';
import {
  BUNDLED_CERTIFICATE_TEMPLATE,
  DEFAULT_OVERLAY_CONFIG,
  mergeOverlayConfig,
  type OverlayFieldConfig,
  type CertificateOverlayConfig,
  type MergedOverlayConfig,
} from '@/lib/certificateOverlayDefaults';
import { FontUploadField } from '@/components/FontUploadField';
import { CertificateOverlayFields } from '@/components/CertificateOverlayFields';

// State shape = MergedOverlayConfig (termasuk fontUrl)
type PageConfig = MergedOverlayConfig;

function formatTanggalPreview(): string {
  return new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

interface FieldControlsProps {
  label: string;
  field: 'nama' | 'kelas' | 'tanggal';
  config: PageConfig;
  onNumChange: (field: 'nama' | 'kelas' | 'tanggal', key: keyof OverlayFieldConfig, value: number) => void;
  onColorChange: (field: 'nama' | 'kelas' | 'tanggal', color: string) => void;
}

function FieldControls({ label, field, config, onNumChange, onColorChange }: FieldControlsProps) {
  const val = config[field];
  return (
    <div className="space-y-3">
      <h3 className="font-medium text-sm">{label}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Posisi Horizontal (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={val.left}
            onChange={(e) => onNumChange(field, 'left', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Posisi Vertikal (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={val.top}
            onChange={(e) => onNumChange(field, 'top', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Ukuran Teks (cqw)</Label>
          <Input
            type="number"
            min={0.5}
            max={8}
            step={0.1}
            value={val.fontSize}
            onChange={(e) => onNumChange(field, 'fontSize', parseFloat(e.target.value) || 1)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Warna Teks</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={val.color}
              onChange={(e) => onColorChange(field, e.target.value)}
              className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent p-0.5"
            />
            <span className="text-xs font-mono text-muted-foreground">{val.color}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function defaultConfig(): PageConfig {
  return mergeOverlayConfig(null);
}

export default function AdminCertificateDesignPage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  });

  const [config, setConfig] = useState<PageConfig>(defaultConfig);

  // Inisialisasi dari settings saat data tersedia
  useEffect(() => {
    if (settings) {
      setConfig(mergeOverlayConfig(settings.certificateOverlayConfig as CertificateOverlayConfig | null));
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (cfg: PageConfig) =>
      updateSettings({ certificateOverlayConfig: cfg }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Pengaturan tampilan sertifikat berhasil disimpan.');
    },
    onError: () => {
      toast.error('Gagal menyimpan pengaturan, coba lagi.');
    },
  });

  function handleNumChange(
    field: 'nama' | 'kelas' | 'tanggal',
    key: keyof OverlayFieldConfig,
    value: number
  ) {
    setConfig((prev) => ({
      ...prev,
      [field]: { ...prev[field], [key]: value },
    }));
  }

  function handleColorChange(field: 'nama' | 'kelas' | 'tanggal', color: string) {
    setConfig((prev) => ({
      ...prev,
      [field]: { ...prev[field], color },
    }));
  }

  function handleFontChange(url: string | null) {
    setConfig((prev) => ({ ...prev, fontUrl: url }));
  }

  function handleReset() {
    setConfig(defaultConfig());
  }

  // Sama dengan urutan di CertificateView: template default → template bawaan
  const templateUrl = settings?.certificateDefaultTemplateUrl?.trim() || BUNDLED_CERTIFICATE_TEMPLATE;
  const todayStr = formatTanggalPreview();
  const customFontFamily = config.fontUrl ? "'sertifikat-custom-font', serif" : undefined;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        <div>
          <h2 className="text-xl font-serif font-semibold">Pengaturan Tampilan Sertifikat</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Atur posisi, ukuran, warna, dan font teks pada template sertifikat. Preview berubah langsung saat kamu mengubah nilai.
          </p>
        </div>

        {/* Preview live */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview Langsung</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div
                className="relative w-full"
                style={{ containerType: 'inline-size' }}
              >
                {/* Inject @font-face identik dengan CertificateView */}
                {config.fontUrl && (
                  <style>{`@font-face { font-family: 'sertifikat-custom-font'; src: url('${config.fontUrl}'); font-display: swap; }`}</style>
                )}

                <img
                  src={templateUrl}
                  alt="Template Sertifikat"
                  crossOrigin="anonymous"
                  className="w-full h-auto block"
                />

                <CertificateOverlayFields
                  config={config}
                  values={{ nama: 'Nama Peserta Contoh', kelas: 'Nama Kelas Contoh', tanggal: todayStr }}
                  customFontFamily={customFontFamily}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Font kustom */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Font Sertifikat (opsional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <FontUploadField value={config.fontUrl} onChange={handleFontChange} />
            <p className="text-xs text-muted-foreground">
              Upload font kustom (.ttf/.otf/.woff/.woff2) untuk teks Nama, Kelas, dan Tanggal di sertifikat.
              Kosongkan untuk memakai font bawaan situs.
            </p>
          </CardContent>
        </Card>

        {/* Kontrol per-field */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pengaturan Posisi, Ukuran & Warna</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 divide-y divide-border">
            <div className="pt-0">
              <FieldControls
                label="Nama"
                field="nama"
                config={config}
                onNumChange={handleNumChange}
                onColorChange={handleColorChange}
              />
            </div>
            <div className="pt-6">
              <FieldControls
                label="Kelas"
                field="kelas"
                config={config}
                onNumChange={handleNumChange}
                onColorChange={handleColorChange}
              />
            </div>
            <div className="pt-6">
              <FieldControls
                label="Tanggal"
                field="tanggal"
                config={config}
                onNumChange={handleNumChange}
                onColorChange={handleColorChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tombol aksi */}
        <div className="flex gap-3">
          <Button
            onClick={() => mutation.mutate(config)}
            disabled={mutation.isPending}
            className="gap-2"
          >
            {mutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Simpan Pengaturan
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={mutation.isPending}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset ke Default
          </Button>
        </div>

        {/* Info nilai default */}
        <Card className="bg-muted/40">
          <CardContent className="pt-4 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Nilai default:</p>
            {Object.entries(DEFAULT_OVERLAY_CONFIG).map(([field, val]) => (
              <p key={field}>
                <span className="font-mono capitalize">{field}</span>:{' '}
                left={val.left}%, top={val.top}%, fontSize={val.fontSize}cqw, color={val.color}
              </p>
            ))}
            <p>fontUrl: <span className="font-mono">null</span> (font-serif bawaan)</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
