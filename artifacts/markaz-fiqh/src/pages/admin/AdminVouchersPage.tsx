import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SEO } from '@/components/SEO';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Loader2, Ticket, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatPrice } from '@/pages/CatalogPage';
import {
  listAllVouchersForAdmin,
  createVoucher,
  updateVoucherActive,
  deleteVoucher,
  checkVoucherHasInvoices,
  listClasses,
  type AdminVoucher,
} from '@/lib/db';

// ─── Form state ───────────────────────────────────────────────────────────────
type VoucherFormState = {
  classId: string;
  code: string;
  discountPercent: string;
  maxUses: string;
};

const EMPTY_FORM: VoucherFormState = {
  classId: '',
  code: '',
  discountPercent: '',
  maxUses: '',
};

const isFkError = (msg: string) =>
  msg.includes('invoices_voucher_id_fkey') ||
  msg.includes('foreign key') ||
  msg.includes('violates');

// ─── Komponen utama ───────────────────────────────────────────────────────────
export default function AdminVouchersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<VoucherFormState>(EMPTY_FORM);
  const [formWarning, setFormWarning] = useState<string | null>(null);

  // hapus normal
  const [deleteTarget, setDeleteTarget] = useState<AdminVoucher | null>(null);
  // hapus diblokir FK → tunjukkan dialog ramah
  const [blockedVoucher, setBlockedVoucher] = useState<AdminVoucher | null>(null);
  // loading per baris saat mengecek invoice sebelum konfirmasi hapus
  const [checkingId, setCheckingId] = useState<string | null>(null);

  // ─── Queries ───────────────────────────────────────────────────────────────
  const vouchersQuery = useQuery({
    queryKey: ['vouchers', 'admin'],
    queryFn: listAllVouchersForAdmin,
  });

  const classesQuery = useQuery({
    queryKey: ['classes', 'admin-all'],
    queryFn: () => listClasses({ includeAll: true }),
  });

  const vouchers = vouchersQuery.data ?? [];
  const classes = classesQuery.data ?? [];

  const invalidateVouchers = () => {
    queryClient.invalidateQueries({ queryKey: ['vouchers', 'admin'] });
  };

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createVoucher>[0]) => createVoucher(payload),
    onSuccess: () => {
      invalidateVouchers();
      toast({ title: 'Kode akses khusus berhasil dibuat' });
      setDialogOpen(false);
    },
    onError: (err: Error) => {
      const msg = err?.message ?? '';
      if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('23505')) {
        toast({
          title: 'Kode sudah dipakai',
          description: 'Kode akses khusus ini sudah ada untuk kelas yang dipilih. Gunakan kode lain.',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Gagal membuat kode akses khusus', description: msg, variant: 'destructive' });
      }
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateVoucherActive(id, isActive),
    onSuccess: () => invalidateVouchers(),
    onError: (err: Error) => {
      toast({ title: 'Gagal mengubah status kode', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVoucher(id),
    onSuccess: () => {
      invalidateVouchers();
      toast({ title: 'Kode akses khusus berhasil dihapus' });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      const msg = err?.message ?? '';
      // Fallback: FK error lolos dari pre-check (race condition) → tunjukkan dialog ramah
      if (isFkError(msg) && deleteTarget) {
        setBlockedVoucher(deleteTarget);
      } else {
        toast({ title: 'Gagal menghapus kode akses khusus', description: msg, variant: 'destructive' });
      }
      setDeleteTarget(null);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => updateVoucherActive(id, false),
    onSuccess: () => {
      invalidateVouchers();
      toast({ title: 'Kode berhasil dinonaktifkan — tidak akan bisa dipakai untuk pembelian baru.' });
      setBlockedVoucher(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal menonaktifkan kode', description: err.message, variant: 'destructive' });
    },
  });

  // ─── Handler tombol hapus (dengan pre-check invoice) ───────────────────────
  async function handleDeleteClick(v: AdminVoucher) {
    setCheckingId(v.id);
    try {
      // Sinyal cepat: sudah pernah dipakai berdasarkan used_count,
      // tapi tetap cek invoices karena pending/expired juga memblokir.
      const hasInvoices = await checkVoucherHasInvoices(v.id);
      if (hasInvoices) {
        setBlockedVoucher(v);
      } else {
        setDeleteTarget(v);
      }
    } catch {
      // Kalau cek gagal, lanjutkan konfirmasi hapus biasa — fallback FK ada di onError
      setDeleteTarget(v);
    } finally {
      setCheckingId(null);
    }
  }

  // ─── Form helpers ──────────────────────────────────────────────────────────
  function openCreateDialog() {
    setForm(EMPTY_FORM);
    setFormWarning(null);
    setDialogOpen(true);
  }

  function handleCodeChange(value: string) {
    setForm((p) => ({ ...p, code: value.toUpperCase() }));
  }

  function handleClassChange(classId: string) {
    setForm((p) => ({ ...p, classId }));
    setFormWarning(null);
  }

  function handleDiscountPercentChange(value: string) {
    setForm((p) => ({ ...p, discountPercent: value }));
    const percent = Number(value);
    if (!isNaN(percent) && (percent < 0 || percent > 100)) {
      setFormWarning('Persentase diskon harus di antara 0% s.d. 100%.');
    } else {
      setFormWarning(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.classId) {
      toast({ title: 'Pilih kelas atau Semua Kelas', variant: 'destructive' });
      return;
    }
    if (!form.code.trim()) {
      toast({ title: 'Kode akses khusus wajib diisi', variant: 'destructive' });
      return;
    }
    const discountPercent = Number(form.discountPercent);
    if (isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      toast({ title: 'Persentase diskon harus berupa angka antara 0% s.d. 100%', variant: 'destructive' });
      return;
    }
    const maxUses = form.maxUses.trim() ? Number(form.maxUses) : null;
    if (maxUses !== null && (isNaN(maxUses) || maxUses < 1)) {
      toast({ title: 'Batas pemakaian harus berupa angka ≥ 1, atau kosongkan untuk tanpa batas', variant: 'destructive' });
      return;
    }
    createMutation.mutate({ classId: form.classId, code: form.code, discountPercent, maxUses });
  }

  const isSaving = createMutation.isPending;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <SEO title="Akses Khusus" />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl font-bold text-foreground">Akses Khusus</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Kelola kode akses khusus per kelas — satu kode berlaku untuk satu kelas satuan.
            </p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Buat Kode
          </Button>
        </div>

        {/* Tabel */}
        <Card>
          <CardContent className="pt-6">
            {vouchersQuery.isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Memuat data akses khusus...
              </div>
            ) : vouchersQuery.isError ? (
              <div className="text-center text-sm text-destructive py-8">
                Gagal memuat data akses khusus dari server.
              </div>
            ) : vouchers.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Ticket className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Belum ada kode akses khusus. Klik "Buat Kode" untuk membuat yang pertama.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead>Harga Akses Khusus</TableHead>
                      <TableHead>Pemakaian</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Dibuat</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vouchers.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <span className="font-mono text-sm font-semibold tracking-wider">{v.code}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-foreground line-clamp-1 max-w-[200px]">{v.className}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{formatPrice(v.discountPrice)}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {v.usedCount} / {v.maxUses ?? '∞'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={v.isActive}
                              onCheckedChange={(checked) =>
                                toggleActiveMutation.mutate({ id: v.id, isActive: checked })
                              }
                              disabled={toggleActiveMutation.isPending}
                              aria-label={v.isActive ? 'Nonaktifkan kode' : 'Aktifkan kode'}
                            />
                            <Badge variant={v.isActive ? 'success' : 'neutral'}>
                              {v.isActive ? 'Aktif' : 'Nonaktif'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {new Date(v.createdAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteClick(v)}
                            disabled={checkingId === v.id}
                            aria-label="Hapus kode"
                          >
                            {checkingId === v.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Dialog Form Buat Kode Akses Khusus ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Buat Kode Akses Khusus</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Pilih Kelas */}
              <div className="space-y-2">
                <Label htmlFor="voucher-class">Pilih Kelas</Label>
                {classesQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Memuat daftar kelas...
                  </div>
                ) : (
                  <Select value={form.classId} onValueChange={handleClassChange}>
                    <SelectTrigger id="voucher-class">
                      <SelectValue placeholder="Pilih kelas atau Semua Kelas" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64 overflow-y-auto">
                      <SelectItem value="ALL_CLASSES" className="font-semibold text-primary">
                        ⭐ Semua Kelas (Berlaku untuk seluruh kelas)
                      </SelectItem>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                          {c.status === 'draft' && (
                            <span className="ml-1 text-xs text-muted-foreground">(Draft)</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">
                  Pilih "Semua Kelas" untuk membuat kode yang otomatis berlaku di seluruh kelas platform.
                </p>
              </div>

              {/* Kode Akses Khusus */}
              <div className="space-y-2">
                <Label htmlFor="voucher-code">Kode Akses Khusus</Label>
                <Input
                  id="voucher-code"
                  placeholder="Contoh: RAMADAN25 atau FIQIH100"
                  value={form.code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  className="uppercase font-mono"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Kode akan otomatis disimpan dalam huruf kapital.
                </p>
              </div>

              {/* Persentase Diskon / Potongan Harga (%) */}
              <div className="space-y-2">
                <Label htmlFor="voucher-percent">Persentase Diskon (%) / Potongan Harga (%)</Label>
                <Input
                  id="voucher-percent"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="20"
                  value={form.discountPercent}
                  onChange={(e) => handleDiscountPercentChange(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Nilai yang dimasukkan adalah persentase potongan harga (0% - 100%), bukan harga akhir produk/kelas. Isi 100% untuk gratis 100%.
                </p>
                {formWarning && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3 text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p className="text-xs">{formWarning}</p>
                  </div>
                )}
              </div>

              {/* Batas Pemakaian */}
              <div className="space-y-2">
                <Label htmlFor="voucher-max-uses">Batas Pemakaian (opsional)</Label>
                <Input
                  id="voucher-max-uses"
                  type="number"
                  min={1}
                  placeholder="Kosongkan untuk tanpa batas"
                  value={form.maxUses}
                  onChange={(e) => setForm((p) => ({ ...p, maxUses: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Buat Kode
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog Konfirmasi Hapus (kupon belum pernah dipakai) ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kode Akses Khusus?</AlertDialogTitle>
            <AlertDialogDescription>
              Kode <strong className="font-mono">{deleteTarget?.code}</strong> untuk kelas{' '}
              <strong>"{deleteTarget?.className}"</strong> akan dihapus secara permanen.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog Kode Dipakai di Transaksi — tidak bisa dihapus permanen ── */}
      <Dialog open={!!blockedVoucher} onOpenChange={(open) => !open && setBlockedVoucher(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0" />
              Kode tidak bisa dihapus permanen
            </DialogTitle>
            <DialogDescription className="leading-relaxed pt-1">
              Kode <strong className="font-mono">{blockedVoucher?.code}</strong> sudah tercatat di
              transaksi, jadi tidak bisa dihapus permanen supaya riwayat pembelian tetap utuh.
              {blockedVoucher?.isActive ? (
                <span className="block mt-2">
                  Kamu bisa <strong>menonaktifkannya</strong> — kode langsung berhenti berlaku
                  untuk pembelian baru, tapi riwayat transaksi tetap terjaga.
                </span>
              ) : (
                <span className="block mt-2">
                  Kode ini sudah <strong>nonaktif</strong> dan tidak bisa dipakai untuk pembelian
                  baru.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setBlockedVoucher(null)}>
              Tutup
            </Button>
            {blockedVoucher?.isActive && (
              <Button
                onClick={() => blockedVoucher && deactivateMutation.mutate(blockedVoucher.id)}
                disabled={deactivateMutation.isPending}
              >
                {deactivateMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Nonaktifkan kode
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
