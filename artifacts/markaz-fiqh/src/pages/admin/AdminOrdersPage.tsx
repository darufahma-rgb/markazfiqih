import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SEO } from '@/components/SEO';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Download, Calendar, Phone, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { formatPrice } from '@/data/mockClasses';
import { listAllInvoicesForAdmin, type AdminInvoiceItem } from '@/lib/db';
import * as XLSX from 'xlsx';

type InvoiceStatus = 'pending' | 'paid' | 'failed';
type DisplayStatus = 'pending' | 'success' | 'failed';
type DateFilterType = 'all' | 'date' | 'month' | 'range';

const TABS: { value: DisplayStatus | 'all'; label: string }[] = [
  { value: 'pending', label: 'Tertunda' },
  { value: 'success', label: 'Berhasil' },
  { value: 'failed', label: 'Gagal' },
  { value: 'all', label: 'Semua Status' },
];

const STATUS_BADGE: Record<DisplayStatus, { label: string; variant: 'neutral' | 'success' | 'destructive' }> = {
  pending: { label: 'Tertunda', variant: 'neutral' },
  success: { label: 'Berhasil', variant: 'success' },
  failed: { label: 'Gagal', variant: 'destructive' },
};

function toDisplayStatus(status: InvoiceStatus): DisplayStatus {
  return status === 'paid' ? 'success' : status;
}

function formatOrderDate(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export default function AdminOrdersPage() {
  const [statusFilter, setStatusFilter] = useState<DisplayStatus | 'all'>('success');
  const [search, setSearch] = useState('');
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('all');
  const [specificDate, setSpecificDate] = useState('');
  const [specificMonth, setSpecificMonth] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: invoices = [], isLoading, isError } = useQuery({
    queryKey: ['admin', 'invoices'],
    queryFn: listAllInvoicesForAdmin,
  });

  // Filter Data berdasarkan Status, Search, dan Filter Tanggal
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // 1. Filter Status
      if (statusFilter !== 'all' && toDisplayStatus(inv.status) !== statusFilter) {
        return false;
      }

      // 2. Filter Search (Invoice ID, User ID, Nickname, Phone, Item Title)
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const itemTitles = inv.items.map((i) => i.title).join(' ').toLowerCase();
        const matchId = inv.id.toLowerCase().includes(q);
        const matchUser = inv.userId.toLowerCase().includes(q);
        const matchNickname = (inv.userNickname ?? '').toLowerCase().includes(q);
        const matchPhone = (inv.userPhone ?? '').toLowerCase().includes(q);
        const matchItems = itemTitles.includes(q);

        if (!matchId && !matchUser && !matchNickname && !matchPhone && !matchItems) {
          return false;
        }
      }

      // 3. Filter Tanggal
      if (dateFilterType !== 'all') {
        const orderDate = new Date(inv.createdAt);

        if (dateFilterType === 'date' && specificDate) {
          const target = new Date(specificDate);
          if (
            orderDate.getFullYear() !== target.getFullYear() ||
            orderDate.getMonth() !== target.getMonth() ||
            orderDate.getDate() !== target.getDate()
          ) {
            return false;
          }
        } else if (dateFilterType === 'month' && specificMonth) {
          const [yearStr, monthStr] = specificMonth.split('-');
          if (
            orderDate.getFullYear() !== parseInt(yearStr, 10) ||
            orderDate.getMonth() + 1 !== parseInt(monthStr, 10)
          ) {
            return false;
          }
        } else if (dateFilterType === 'range') {
          if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (orderDate < start) return false;
          }
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (orderDate > end) return false;
          }
        }
      }

      return true;
    });
  }, [invoices, statusFilter, search, dateFilterType, specificDate, specificMonth, startDate, endDate]);

  const pendingCount = useMemo(
    () => invoices.filter((inv) => inv.status === 'pending').length,
    [invoices],
  );

  const totalCount = filteredInvoices.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const safePage = Math.min(page, totalPages);

  const pagedInvoices = useMemo(() => {
    return filteredInvoices.slice((safePage - 1) * pageSize, safePage * pageSize);
  }, [filteredInvoices, safePage, pageSize]);

  // Handler Export ke Excel (.xlsx)
  const handleExportExcel = () => {
    if (filteredInvoices.length === 0) return;

    const excelData = filteredInvoices.map((inv) => {
      const displayStatus = toDisplayStatus(inv.status);
      const itemsLabel = inv.items.map((i) => i.title).join(', ') || '-';
      return {
        'ID Invoice': inv.id,
        'Tanggal Pesanan': formatOrderDate(inv.createdAt),
        'Pengguna / Email': inv.userNickname ?? inv.userId,
        'Nomor WhatsApp': inv.userPhone ?? '-',
        'Daftar Item / Kelas': itemsLabel,
        'Total Pembayaran (Rp)': inv.totalAmount,
        'Status Pembayaran': STATUS_BADGE[displayStatus].label,
        'Tanggal Lunas': inv.paidAt ? formatOrderDate(inv.paidAt) : '-',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Pesanan');

    // Auto-fit column width
    const colWidths = [
      { wch: 36 }, // ID Invoice
      { wch: 22 }, // Tanggal
      { wch: 25 }, // User
      { wch: 18 }, // WA
      { wch: 35 }, // Item
      { wch: 20 }, // Total
      { wch: 18 }, // Status
      { wch: 22 }, // Paid At
    ];
    worksheet['!cols'] = colWidths;

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Daftar_Pesanan_Markaz_Fiqih_${dateStr}.xlsx`);
  };

  return (
    <AdminLayout>
      <SEO title="Daftar Pesanan" />
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="font-serif text-2xl font-bold text-foreground">Daftar Pesanan</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Pantau semua pesanan dan transaksi masuk secara terstruktur.
            </p>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={handleExportExcel}
            disabled={filteredInvoices.length === 0}
            className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Export ke Excel (.xlsx)
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3 space-y-4">
            {/* Status Dropdown Filter */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-foreground">Status Transaksi:</span>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v as DisplayStatus | 'all');
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[190px] h-9 text-xs bg-background">
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="success">🟢 Berhasil (Paid / Closed)</SelectItem>
                    <SelectItem value="pending">🟡 Tertunda (Pending)</SelectItem>
                    <SelectItem value="failed">🔴 Gagal (Failed)</SelectItem>
                    <SelectItem value="all">⚪ Semua Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Cari ID invoice, WhatsApp, user..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8 h-9 text-xs"
                />
              </div>
            </div>

            {/* Filter Tanggal */}
            <div className="flex items-center gap-3 flex-wrap bg-muted/30 p-3 rounded-lg border border-border/50 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Filter Tanggal:</span>
              </div>

              <Select
                value={dateFilterType}
                onValueChange={(v) => {
                  setDateFilterType(v as DateFilterType);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-36 h-8 text-xs bg-white">
                  <SelectValue placeholder="Pilih tipe filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Tanggal</SelectItem>
                  <SelectItem value="date">Tanggal Spesifik</SelectItem>
                  <SelectItem value="month">Per Bulan</SelectItem>
                  <SelectItem value="range">Rentang Tanggal</SelectItem>
                </SelectContent>
              </Select>

              {dateFilterType === 'date' && (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={specificDate}
                    onChange={(e) => {
                      setSpecificDate(e.target.value);
                      setPage(1);
                    }}
                    className="w-40 h-8 text-xs bg-white"
                  />
                </div>
              )}

              {dateFilterType === 'month' && (
                <div className="flex items-center gap-2">
                  <Input
                    type="month"
                    value={specificMonth}
                    onChange={(e) => {
                      setSpecificMonth(e.target.value);
                      setPage(1);
                    }}
                    className="w-40 h-8 text-xs bg-white"
                  />
                </div>
              )}

              {dateFilterType === 'range' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Mulai"
                    className="w-36 h-8 text-xs bg-white"
                  />
                  <span className="text-muted-foreground">s.d.</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Selesai"
                    className="w-36 h-8 text-xs bg-white"
                  />
                </div>
              )}

              {(dateFilterType !== 'all' || search) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDateFilterType('all');
                    setSpecificDate('');
                    setSpecificMonth('');
                    setStartDate('');
                    setEndDate('');
                    setSearch('');
                    setPage(1);
                  }}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground ml-auto"
                >
                  Reset Filter
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {isError && (
              <p className="text-center text-sm text-destructive py-8">
                Gagal memuat daftar pesanan dari database.
              </p>
            )}
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded" />
                ))}
              </div>
            ) : !isError && (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Pengguna / WA</TableHead>
                        <TableHead>Item / Kelas</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedInvoices.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-12">
                            Tidak ada pesanan yang sesuai dengan filter.
                          </TableCell>
                        </TableRow>
                      )}
                      {pagedInvoices.map((inv) => {
                        const displayStatus = toDisplayStatus(inv.status);
                        const itemLabel =
                          inv.items.length === 0
                            ? '-'
                            : inv.items.length === 1
                            ? inv.items[0].title
                            : `${inv.items[0].title} +${inv.items.length - 1} lainnya`;
                        return (
                          <TableRow key={inv.id} data-testid={`row-order-${inv.id}`}>
                            <TableCell>
                              <p className="text-sm font-mono font-medium text-foreground">{inv.id.slice(0, 8)}…</p>
                              <p className="text-xs text-muted-foreground">{formatOrderDate(inv.createdAt)}</p>
                            </TableCell>
                            <TableCell>
                              <p className="text-xs font-semibold text-foreground truncate max-w-[160px]">
                                {inv.userNickname ?? inv.userId.slice(0, 8) + '…'}
                              </p>
                              {inv.userPhone ? (
                                <p className="text-[11px] font-mono text-emerald-700 flex items-center gap-1 mt-0.5">
                                  <Phone className="h-3 w-3 shrink-0" />
                                  {inv.userPhone}
                                </p>
                              ) : (
                                <p className="text-[11px] text-muted-foreground/60 italic">-</p>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[220px] truncate">
                              {itemLabel}
                            </TableCell>
                            <TableCell className="text-sm font-medium text-foreground">
                              {formatPrice(inv.totalAmount)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={STATUS_BADGE[displayStatus].variant}
                                data-testid={`badge-order-status-${inv.id}`}
                              >
                                {STATUS_BADGE[displayStatus].label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                {totalCount > 0 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t text-xs text-muted-foreground">
                    <div>
                      Menampilkan <span className="font-semibold text-foreground">{(safePage - 1) * pageSize + 1}</span> - <span className="font-semibold text-foreground">{Math.min(safePage * pageSize, totalCount)}</span> dari <span className="font-semibold text-foreground">{totalCount}</span> pesanan
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={safePage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Sebelumnya
                      </Button>
                      <span className="px-2 font-medium text-foreground">
                        Halaman {safePage} dari {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={safePage >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Selanjutnya
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
