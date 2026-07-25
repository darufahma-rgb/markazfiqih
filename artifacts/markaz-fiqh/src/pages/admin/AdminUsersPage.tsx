import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { SEO } from '@/components/SEO';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Loader2, Users, Search, ShieldPlus, UserCog, Trash2, Plus, Send, Phone, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  listAllUsersForAdmin,
  listUserEnrollments,
  adminAddEnrollment,
  adminRemoveEnrollment,
  createClassGrant,
  listClasses,
  type AdminUserRow,
} from '@/lib/db';

type ClassRow = Awaited<ReturnType<typeof listClasses>>[number];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function groupByCategory(classes: ClassRow[]): { category: string; classes: ClassRow[] }[] {
  const map = new Map<string, ClassRow[]>();
  for (const cls of classes) {
    const cat = cls.category ?? '(Tanpa Kategori)';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(cls);
  }
  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === '(Tanpa Kategori)') return 1;
      if (b === '(Tanpa Kategori)') return -1;
      return a.localeCompare(b, 'id');
    })
    .map(([category, classes]) => ({ category, classes }));
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // ── Dialog: kelola kelas milik satu user ──────────────────────────────────
  const [manageTarget, setManageTarget] = useState<AdminUserRow | null>(null);
  const [addClassId, setAddClassId] = useState('');
  const [removeTarget, setRemoveTarget] = useState<{ classId: string; classTitle: string } | null>(null);

  // ── Dialog: grant kelas via email ─────────────────────────────────────────
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantClassIds, setGrantClassIds] = useState<string[]>([]);

  const usersQuery = useQuery({
    queryKey: ['admin-users-page', page, pageSize, search],
    queryFn: () => listAllUsersForAdmin({ page, pageSize, search }),
  });

  const classesQuery = useQuery({
    queryKey: ['classes', 'admin'],
    queryFn: () => listClasses({ includeAll: true }),
  });
  const allClasses = classesQuery.data ?? [];
  const classGroups = useMemo(() => groupByCategory(allClasses), [allClasses]);

  const enrollmentsQuery = useQuery({
    queryKey: ['user-enrollments', manageTarget?.userId],
    queryFn: () => listUserEnrollments(manageTarget!.userId),
    enabled: !!manageTarget,
  });
  const ownedClasses = enrollmentsQuery.data ?? [];
  const ownedClassIds = new Set(ownedClasses.map((e) => e.classId));
  const availableToAdd = allClasses.filter((c) => !ownedClassIds.has(c.id));

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users-page'] });
  };
  const invalidateEnrollments = () => {
    if (manageTarget) {
      queryClient.invalidateQueries({ queryKey: ['user-enrollments', manageTarget.userId] });
    }
    invalidateUsers();
  };

  const addEnrollmentMutation = useMutation({
    mutationFn: (classId: string) => adminAddEnrollment(manageTarget!.userId, classId),
    onSuccess: () => {
      invalidateEnrollments();
      setAddClassId('');
      toast({ title: 'Kelas berhasil ditambahkan ke akun pengguna' });
    },
    onError: (err) => {
      toast({
        title: 'Gagal menambahkan kelas',
        description: String((err as Error)?.message ?? err),
        variant: 'destructive',
      });
    },
  });

  const removeEnrollmentMutation = useMutation({
    mutationFn: (classId: string) => adminRemoveEnrollment(manageTarget!.userId, classId),
    onSuccess: () => {
      invalidateEnrollments();
      toast({ title: 'Kelas berhasil dihapus dari akun pengguna' });
      setRemoveTarget(null);
    },
    onError: (err) => {
      toast({
        title: 'Gagal menghapus kelas',
        description: String((err as Error)?.message ?? err),
        variant: 'destructive',
      });
      setRemoveTarget(null);
    },
  });

  const grantMutation = useMutation({
    mutationFn: () => createClassGrant(grantEmail, grantClassIds),
    onSuccess: () => {
      toast({
        title: 'Grant kelas berhasil dibuat',
        description: 'Kelas akan otomatis muncul begitu email ini login pertama kali.',
      });
      setGrantDialogOpen(false);
      setGrantEmail('');
      setGrantClassIds([]);
    },
    onError: (err) => {
      toast({
        title: 'Gagal membuat grant kelas',
        description: String((err as Error)?.message ?? err),
        variant: 'destructive',
      });
    },
  });

  const usersData = usersQuery.data;
  const usersList = usersData?.users ?? [];
  const totalCount = usersData?.totalCount ?? 0;
  const totalPages = usersData?.totalPages ?? 1;

  function toggleGrantClassId(classId: string) {
    setGrantClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId],
    );
  }

  function handleGrantSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!grantEmail.trim()) {
      toast({ title: 'Email wajib diisi', variant: 'destructive' });
      return;
    }
    if (grantClassIds.length === 0) {
      toast({ title: 'Pilih minimal 1 kelas', variant: 'destructive' });
      return;
    }
    grantMutation.mutate();
  }

  return (
    <AdminLayout>
      <SEO title="Kelola Pengguna" />
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-serif text-2xl font-bold text-foreground">Kelola Pengguna</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Daftar semua pengguna terdaftar. Klik salah satu baris untuk melihat nomor WhatsApp atau kelola kelas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setGrantEmail('');
                setGrantClassIds([]);
                setGrantDialogOpen(true);
              }}
              data-testid="button-grant-class-email"
            >
              <Send className="h-4 w-4 mr-2" />
              Grant Kelas via Email
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/manage-admins">
                <ShieldPlus className="h-4 w-4 mr-2" />
                Kelola Admin
              </Link>
            </Button>
          </div>
        </div>

        {/* Search + Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Cari nama, email, atau WhatsApp…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-8"
                data-testid="input-search-users"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {usersQuery.isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Memuat data pengguna…
              </div>
            ) : usersQuery.isError ? (
              <div className="text-center text-sm text-destructive py-8">
                Gagal memuat daftar pengguna dari server.
              </div>
            ) : usersList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Users className="w-7 h-7 text-muted-foreground/50" />
                </div>
                <p className="font-semibold text-foreground mb-1">
                  {search ? 'Tidak ada pengguna ditemukan' : 'Belum ada pengguna terdaftar'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {search
                    ? 'Coba kata kunci lain.'
                    : 'Pengguna yang mendaftar akan muncul di sini.'}
                </p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Tanggal Daftar</TableHead>
                      <TableHead className="text-center">Kelas Dimiliki</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersList.map((u) => (
                      <TableRow
                        key={u.userId}
                        data-testid={`row-user-${u.userId}`}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setManageTarget(u)}
                      >
                        <TableCell className="font-medium text-foreground">
                          {u.nickname ?? (
                            <span className="text-muted-foreground italic">Belum diisi</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell className="text-xs font-mono">
                          {u.phone ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <Phone className="h-3 w-3 text-emerald-600 shrink-0" />
                              {u.phone}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50 italic">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatDate(u.createdAt)}
                        </TableCell>
                        <TableCell className="text-center">
                          {u.enrollmentCount}
                        </TableCell>
                        <TableCell>
                          {u.isAdmin ? (
                            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                              Admin
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pelajar</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`button-manage-classes-${u.userId}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setManageTarget(u);
                            }}
                          >
                            <UserCog className="h-4 w-4 mr-1.5" />
                            Kelola Kelas
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t text-xs text-muted-foreground">
                  <div>
                    Menampilkan <span className="font-semibold text-foreground">{(page - 1) * pageSize + 1}</span> - <span className="font-semibold text-foreground">{Math.min(page * pageSize, totalCount)}</span> dari <span className="font-semibold text-foreground">{totalCount}</span> pengguna
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Sebelumnya
                    </Button>
                    <span className="px-2 font-medium text-foreground">
                      Halaman {page} dari {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Selanjutnya
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Dialog: Kelola Kelas milik satu user ──────────────────────────── */}
      <Dialog open={!!manageTarget} onOpenChange={(open) => !open && setManageTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Kelola Kelas — {manageTarget?.nickname ?? manageTarget?.email}
            </DialogTitle>
            <DialogDescription className="space-y-1 pt-1">
              <div>Email: <span className="text-foreground font-medium">{manageTarget?.email}</span></div>
              {manageTarget?.phone && (
                <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                  WhatsApp: <span>{manageTarget.phone}</span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kelas yang Dimiliki Sekarang</Label>
              {enrollmentsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memuat daftar kelas…
                </div>
              ) : ownedClasses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Pengguna ini belum memiliki kelas apa pun.
                </p>
              ) : (
                <ScrollArea className="h-48 rounded-md border p-3">
                  <div className="space-y-2">
                    {ownedClasses.map((e) => (
                      <div
                        key={e.classId}
                        className="flex items-center justify-between gap-3"
                        data-testid={`owned-class-${e.classId}`}
                      >
                        <span className="text-sm leading-tight">{e.classTitle}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive shrink-0"
                          disabled={removeEnrollmentMutation.isPending}
                          onClick={() =>
                            setRemoveTarget({ classId: e.classId, classTitle: e.classTitle })
                          }
                          data-testid={`button-remove-enrollment-${e.classId}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Hapus
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            <div className="space-y-2">
              <Label>Tambahkan Kelas</Label>
              <div className="flex items-center gap-2">
                <Select value={addClassId} onValueChange={setAddClassId}>
                  <SelectTrigger className="flex-1" data-testid="select-add-class">
                    <SelectValue placeholder="Cari & pilih kelas…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {availableToAdd.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        Semua kelas sudah dimiliki
                      </div>
                    ) : (
                      availableToAdd.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  disabled={!addClassId || addEnrollmentMutation.isPending}
                  onClick={() => addEnrollmentMutation.mutate(addClassId)}
                  data-testid="button-add-enrollment"
                >
                  {addEnrollmentMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManageTarget(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog: konfirmasi hapus kelas dari user ─────────────────── */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus kelas dari pengguna ini?</AlertDialogTitle>
            <AlertDialogDescription>
              "{removeTarget?.classTitle}" akan dihapus dari akun{' '}
              {manageTarget?.nickname ?? manageTarget?.email}. Progres belajar kelas ini juga akan
              hilang. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removeTarget && removeEnrollmentMutation.mutate(removeTarget.classId)}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog: Grant Kelas via Email ─────────────────────────────────── */}
      <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
        <DialogContent className="max-w-lg">
          <form onSubmit={handleGrantSubmit}>
            <DialogHeader>
              <DialogTitle>Grant Kelas via Email</DialogTitle>
              <DialogDescription>
                Untuk pengguna yang belum pernah login ke web. Kelas akan otomatis muncul di
                akunnya begitu email ini login pertama kali.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="grant-email">Email Pengguna</Label>
                <Input
                  id="grant-email"
                  type="email"
                  placeholder="nama@email.com"
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  data-testid="input-grant-email"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Pilih Kelas
                  {grantClassIds.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({grantClassIds.length} dipilih)
                    </span>
                  )}
                </Label>
                {classesQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat daftar kelas...
                  </div>
                ) : (
                  <ScrollArea className="h-60 rounded-md border p-3">
                    <div className="space-y-4">
                      {classGroups.map(({ category, classes }) => (
                        <div key={category}>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                            {category}
                          </p>
                          <div className="space-y-2 pl-1">
                            {classes.map((cls) => {
                              const isChecked = grantClassIds.includes(cls.id);
                              return (
                                <label
                                  key={cls.id}
                                  className="flex items-center gap-3 cursor-pointer group"
                                >
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={() => toggleGrantClassId(cls.id)}
                                    id={`grant-cls-${cls.id}`}
                                  />
                                  <span className="flex-1 text-sm leading-tight group-hover:text-foreground transition-colors">
                                    {cls.title}
                                    {cls.status === 'draft' && (
                                      <span className="ml-1.5 text-xs text-muted-foreground">(draft)</span>
                                    )}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGrantDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={grantMutation.isPending} data-testid="button-submit-grant">
                {grantMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Buat Grant
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
