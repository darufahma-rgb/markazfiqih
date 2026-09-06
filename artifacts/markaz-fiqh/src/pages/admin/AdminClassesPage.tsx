import { useEffect, useRef, useState } from 'react';

function extractPlaylistId(input: string): string {
  const trimmed = input.trim();
  // Kalau bukan URL (tidak ada "youtube.com" atau "youtu.be"),
  // anggap sudah ID mentah, kembalikan apa adanya
  if (!trimmed.includes('youtube.com') && !trimmed.includes('youtu.be')) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    const listParam = url.searchParams.get('list');
    return listParam ?? trimmed;
  } catch {
    // URL tidak valid/gagal di-parse, kembalikan input asli supaya
    // tidak silently menghilangkan data yang diketik admin
    return trimmed;
  }
}
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Search, Pencil, Trash2, Loader2, Wand2, GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ImageUploadField } from '@/components/ImageUploadField';
import { formatPrice } from '@/pages/CatalogPage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  listClasses,
  listAllInstructorsForAdmin,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
  getClassMeetingTitles,
  upsertClassMeetingTitle,
  deleteClassMeetingTitlesForClass,
  bulkUpdateDarsVideos,
  listModulesForClass,
  createModule,
  updateModule,
  deleteModule,
  createDars,
  updateDarsFull,
  deleteDars,
  reorderModules,
  reorderDars,
  type AdminModule,
} from '@/lib/db';

type ClassSummary = Awaited<ReturnType<typeof listClasses>>[0];
type ClassDetail = Awaited<ReturnType<typeof getClassById>>;

// ─── Auto-Match Playlist Dialog ───────────────────────────────────────────────
type DarsForMatch = { id: string; title: string; moduleTitle: string };
type MatchRow = { videoId: string; videoTitle: string; assignedDarsId: string };

async function ensureYtApi(): Promise<void> {
  if ((window as any).YT?.Player) return;
  return new Promise<void>((resolve) => {
    const prev = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
  });
}

async function fetchOEmbedTitle(videoId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://youtube.com/watch?v=${videoId}&format=json`,
    );
    if (!res.ok) return videoId;
    const data = await res.json();
    return (data.title as string | undefined) ?? videoId;
  } catch {
    return videoId;
  }
}

function AutoMatchPlaylistDialog({
  open,
  onClose,
  darsList,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  darsList: DarsForMatch[];
  onApplied: () => void;
}) {
  const [playlistInput, setPlaylistInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matchRows, setMatchRows] = useState<MatchRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setPlaylistInput('');
      setError(null);
      setMatchRows([]);
      setIsLoading(false);
      setIsSaving(false);
    }
  }, [open]);

  function matchDars(videoTitle: string): string {
    const norm = (s: string) => s.trim().toLowerCase();
    const vt = norm(videoTitle);
    const exact = darsList.find((d) => norm(d.title) === vt);
    if (exact) return exact.id;
    const partial = darsList.find(
      (d) => vt.includes(norm(d.title)) || norm(d.title).includes(vt),
    );
    return partial?.id ?? '';
  }

  async function fetchAndMatch() {
    const playlistId = extractPlaylistId(playlistInput.trim());
    if (!playlistId) {
      setError('Masukkan link atau ID playlist YouTube yang valid.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setMatchRows([]);

    try {
      // Step 1: load YT API if not already loaded
      await ensureYtApi();

      // Step 2: baca daftar video ID dari playlist lewat hidden YT player
      const videoIds = await new Promise<string[]>((resolve, reject) => {
        const container = document.getElementById('admin-yt-meta-container');
        if (!container) { reject(new Error('Container player tidak ditemukan.')); return; }

        let done = false;
        let retried = false;

        const tryRead = (target: any): boolean => {
          try {
            const ids: string[] = target.getPlaylist() ?? [];
            if (ids.length > 0) {
              done = true;
              try { target.destroy(); } catch (_) {}
              resolve(ids);
              return true;
            }
          } catch (_) {}
          return false;
        };

        (window as any).YT.Player('admin-yt-meta-container', {
          playerVars: { listType: 'playlist', list: playlistId, autoplay: 0, mute: 1 },
          events: {
            onReady: (event: any) => {
              if (tryRead(event.target)) return;
              if (!retried) {
                retried = true;
                setTimeout(() => {
                  if (done) return;
                  if (!tryRead(event.target)) {
                    done = true;
                    try { event.target.destroy(); } catch (_) {}
                    reject(new Error('Tidak bisa membaca daftar video. Pastikan playlist bersifat publik.'));
                  }
                }, 1200);
              }
            },
            onError: (event: any) => {
              if (!done) {
                done = true;
                try { event.target.destroy(); } catch (_) {}
                reject(new Error('Gagal memuat playlist. Pastikan playlist bersifat publik dan ID-nya benar.'));
              }
            },
          },
        });
      });

      // Step 3: ambil judul tiap video via oEmbed (batch 5 paralel)
      const BATCH = 5;
      const titled: { id: string; title: string }[] = [];
      for (let i = 0; i < videoIds.length; i += BATCH) {
        const batch = videoIds.slice(i, i + BATCH);
        const results = await Promise.all(
          batch.map(async (id) => ({ id, title: await fetchOEmbedTitle(id) })),
        );
        titled.push(...results);
      }

      // Step 4: auto-match ke dars
      const rows: MatchRow[] = titled.map(({ id, title }) => ({
        videoId: id,
        videoTitle: title,
        assignedDarsId: matchDars(title),
      }));

      setMatchRows(rows);
      if (rows.length === 0) setError('Playlist tidak mengandung video.');
    } catch (err: any) {
      setError(err?.message ?? 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }

  async function applyMatches() {
    const updates = matchRows
      .filter((r) => r.assignedDarsId)
      .map((r) => ({ darsId: r.assignedDarsId, youtubeVideoId: r.videoId }));

    if (updates.length === 0) {
      toast({ title: 'Tidak ada pasangan yang dipilih', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      await bulkUpdateDarsVideos(updates);
      toast({ title: `${updates.length} dars berhasil di-assign video` });
      onApplied();
      onClose();
    } catch (err: any) {
      toast({ title: 'Gagal menyimpan', description: err?.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  const matchedCount = matchRows.filter((r) => r.assignedDarsId).length;

  return (
    <>
      {/* Hidden container untuk YT player — selalu ada di DOM saat komponen ini mounted */}
      <div
        id="admin-yt-meta-container"
        style={{ position: 'fixed', left: -9999, top: -9999, width: 1, height: 1, overflow: 'hidden' }}
        aria-hidden="true"
      />
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Auto-Match Video dari Playlist YouTube</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Masukkan link playlist YouTube. Sistem akan mengambil semua video beserta judulnya,
              lalu mencocokkannya otomatis ke dars yang sudah ada berdasarkan kemiripan judul.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="https://youtube.com/playlist?list=PL... atau ID playlist"
                value={playlistInput}
                onChange={(e) => setPlaylistInput(e.target.value)}
                disabled={isLoading}
                className="flex-1"
              />
              <Button type="button" onClick={fetchAndMatch} disabled={isLoading || !playlistInput.trim()}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
                {isLoading ? 'Memuat...' : 'Ambil & Cocokkan'}
              </Button>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
            )}

            {matchRows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    Hasil: {matchedCount} dari {matchRows.length} video berhasil dicocokkan
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sesuaikan via dropdown jika ada yang salah, atau kosongkan untuk melewati video tersebut.
                  </p>
                </div>
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[45%]">Judul Video (dari YouTube)</TableHead>
                        <TableHead>Dars yang Cocok</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matchRows.map((row, i) => (
                        <TableRow key={row.videoId}>
                          <TableCell className="text-sm py-2 align-top">
                            <a
                              href={`https://youtube.com/watch?v=${row.videoId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline line-clamp-2 text-xs"
                            >
                              {row.videoTitle}
                            </a>
                          </TableCell>
                          <TableCell className="py-2">
                            <Select
                              value={row.assignedDarsId || '__none__'}
                              onValueChange={(v) =>
                                setMatchRows((prev) =>
                                  prev.map((r, j) =>
                                    j === i ? { ...r, assignedDarsId: v === '__none__' ? '' : v } : r,
                                  ),
                                )
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Pilih dars..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-72 overflow-y-auto">
                                <SelectItem value="__none__">
                                  <span className="text-muted-foreground">— Lewati video ini —</span>
                                </SelectItem>
                                {darsList.map((d) => (
                                  <SelectItem key={d.id} value={d.id}>
                                    {d.moduleTitle} › {d.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            {matchRows.length > 0 && (
              <Button type="button" onClick={applyMatches} disabled={isSaving || matchedCount === 0}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Terapkan ({matchedCount} dars)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type MeetingTitleRow = { videoIndex: number; title: string; description: string };

type ClassFormState = {
  title: string;
  description: string;
  coverImage: string;
  basePrice: string;
  discountPrice: string;
  status: 'draft' | 'published';
  level: 'pemula' | 'menengah' | 'lanjutan' | '';
  category: string;
  instructorId: string;
  youtubePlaylistId: string;
  gdriveMateriUrl: string;
  waGroupUrl: string;
  soalLatihanUrl: string;
  ebookUrl: string;
  testimoniFormUrl: string;
  meetingCount: string;
  displayOrder: string;
  reverseVideoOrder: boolean;
  certificateTemplateUrl: string;
};

const EMPTY_FORM: ClassFormState = {
  title: '',
  description: '',
  coverImage: '',
  basePrice: '',
  discountPrice: '',
  status: 'draft',
  level: '',
  category: '',
  instructorId: '',
  youtubePlaylistId: '',
  gdriveMateriUrl: '',
  waGroupUrl: '',
  soalLatihanUrl: '',
  ebookUrl: '',
  testimoniFormUrl: '',
  meetingCount: '',
  displayOrder: '0',
  reverseVideoOrder: false,
  certificateTemplateUrl: '',
};

function classToForm(cls: ClassDetail): ClassFormState {
  return {
    title: cls.title,
    description: cls.description,
    coverImage: cls.coverImage,
    basePrice: String(cls.basePrice),
    discountPrice: cls.discountPrice != null ? String(cls.discountPrice) : '',
    status: cls.status,
    level: (cls.level ?? '') as ClassFormState['level'],
    category: cls.category ?? '',
    instructorId: cls.instructor.id,
    youtubePlaylistId: cls.youtubePlaylistId ?? '',
    gdriveMateriUrl: cls.gdriveMateriUrl ?? '',
    waGroupUrl: cls.waGroupUrl ?? '',
    soalLatihanUrl: cls.soalLatihanUrl ?? '',
    ebookUrl: cls.ebookUrl ?? '',
    testimoniFormUrl: cls.testimoniFormUrl ?? '',
    meetingCount: cls.meetingCount != null ? String(cls.meetingCount) : '',
    displayOrder: String(cls.displayOrder ?? 0),
    reverseVideoOrder: cls.reverseVideoOrder ?? false,
    certificateTemplateUrl: cls.certificateTemplateUrl ?? '',
  };
}

// ─── Extract single YouTube video ID from link or raw ID ──────────────────────
function extractVideoId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.includes('youtube.com') && !trimmed.includes('youtu.be')) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname === 'youtu.be') return url.pathname.slice(1).split('?')[0];
    return url.searchParams.get('v') ?? trimmed;
  } catch { return trimmed; }
}

const EMPTY_DARS_FORM = { title: '', durationMinutes: '', youtubeVideoId: '' };
type AdminDarsItem = AdminModule['darsList'][0];

// ─── Sortable: module row ─────────────────────────────────────────────────────
function SortableModuleRow({ module, isExpanded, onToggle, onEdit, onDelete, children }: {
  module: AdminModule;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: module.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="rounded-lg border bg-card"
    >
      <div className="flex items-center gap-1.5 px-2 py-2">
        <button type="button" {...attributes} {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5">
          <GripVertical className="h-4 w-4" />
        </button>
        <button type="button" onClick={onToggle}
          className="flex items-center gap-1 flex-1 min-w-0 text-left py-0.5">
          {isExpanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <span className="text-sm font-medium truncate">{module.title}</span>
          <span className="text-xs text-muted-foreground ml-1.5 shrink-0">
            ({module.darsList.length} pelajaran)
          </span>
        </button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {isExpanded && <div className="border-t bg-muted/20 px-3 pb-3 pt-2">{children}</div>}
    </div>
  );
}

// ─── Sortable: dars row ───────────────────────────────────────────────────────
function SortableDarsRow({ dars, onEdit, onDelete }: {
  dars: AdminDarsItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: dars.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-1.5 py-1 select-none"
    >
      <button type="button" {...attributes} {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5">
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="flex-1 text-xs truncate text-foreground">{dars.title}</span>
      {dars.youtubeVideoId && (
        <span title="Ada video" className="text-[10px] bg-red-50 border border-red-200 text-red-600 rounded px-1.5 py-0.5 shrink-0">▶</span>
      )}
      {(dars.durationMinutes ?? 0) > 0 && (
        <span className="text-[10px] text-muted-foreground shrink-0">{dars.durationMinutes}m</span>
      )}
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onEdit}>
        <Pencil className="h-3 w-3" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive shrink-0" onClick={onDelete}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ─── Module Structure Section ─────────────────────────────────────────────────
function ModuleStructureSection({ classId, modules, onMutated }: {
  classId: string;
  modules: AdminModule[];
  onMutated: () => void;
}) {
  const { toast } = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Local order ids for optimistic reorder
  const [moduleOrderIds, setModuleOrderIds] = useState(() => modules.map(m => m.id));
  const [darsOrderMap, setDarsOrderMap] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(modules.map(m => [m.id, m.darsList.map(d => d.id)])),
  );
  // Sync when modules prop changes (after mutations/refetch)
  useEffect(() => {
    setModuleOrderIds(prev => {
      const cur = modules.map(m => m.id);
      return prev.length === cur.length && prev.every(id => cur.includes(id)) ? prev : cur;
    });
    setDarsOrderMap(prev => {
      const next: Record<string, string[]> = {};
      modules.forEach(m => {
        const cur = m.darsList.map(d => d.id);
        const p = prev[m.id];
        next[m.id] = (p && p.length === cur.length && p.every(id => cur.includes(id))) ? p : cur;
      });
      return next;
    });
  }, [modules]);

  const sortedModules = moduleOrderIds
    .map(id => modules.find(m => m.id === id))
    .filter(Boolean) as AdminModule[];

  // Expand/collapse per module
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(modules.map(m => m.id)),
  );
  const toggleExpand = (id: string) =>
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // DnD handlers
  function handleModuleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = moduleOrderIds.indexOf(active.id as string);
    const newIdx = moduleOrderIds.indexOf(over.id as string);
    const newIds = arrayMove(moduleOrderIds, oldIdx, newIdx);
    setModuleOrderIds(newIds);
    reorderModules(classId, newIds).then(onMutated).catch((e: any) =>
      toast({ title: 'Gagal menyimpan urutan bab', description: e?.message, variant: 'destructive' }));
  }

  function handleDarsDragEnd(moduleId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const cur = darsOrderMap[moduleId] ?? [];
    const oldIdx = cur.indexOf(active.id as string);
    const newIdx = cur.indexOf(over.id as string);
    const newIds = arrayMove(cur, oldIdx, newIdx);
    setDarsOrderMap(prev => ({ ...prev, [moduleId]: newIds }));
    reorderDars(moduleId, newIds).then(onMutated).catch((e: any) =>
      toast({ title: 'Gagal menyimpan urutan pelajaran', description: e?.message, variant: 'destructive' }));
  }

  // Sub-dialog states
  const [addModuleOpen, setAddModuleOpen] = useState(false);
  const [addModuleTitle, setAddModuleTitle] = useState('');
  const [addModuleSaving, setAddModuleSaving] = useState(false);

  const [editModuleTarget, setEditModuleTarget] = useState<AdminModule | null>(null);
  const [editModuleTitle, setEditModuleTitle] = useState('');
  const [editModuleSaving, setEditModuleSaving] = useState(false);

  const [deleteModuleTarget, setDeleteModuleTarget] = useState<AdminModule | null>(null);
  const [deleteModuleSaving, setDeleteModuleSaving] = useState(false);

  const [addDarsModuleId, setAddDarsModuleId] = useState<string | null>(null);
  const [addDarsForm, setAddDarsForm] = useState(EMPTY_DARS_FORM);
  const [addDarsSaving, setAddDarsSaving] = useState(false);

  const [editDarsTarget, setEditDarsTarget] = useState<{ moduleId: string; dars: AdminDarsItem } | null>(null);
  const [editDarsForm, setEditDarsForm] = useState(EMPTY_DARS_FORM);
  const [editDarsSaving, setEditDarsSaving] = useState(false);

  const [deleteDarsTarget, setDeleteDarsTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleteDarsSaving, setDeleteDarsSaving] = useState(false);

  // Module handlers
  async function handleAddModule() {
    const t = addModuleTitle.trim();
    if (!t) return;
    setAddModuleSaving(true);
    try {
      await createModule(classId, t);
      toast({ title: 'Bab berhasil ditambahkan' });
      setAddModuleOpen(false);
      setAddModuleTitle('');
      onMutated();
    } catch (e: any) {
      toast({ title: 'Gagal menambahkan bab', description: e?.message, variant: 'destructive' });
    } finally { setAddModuleSaving(false); }
  }

  async function handleEditModule() {
    if (!editModuleTarget) return;
    const t = editModuleTitle.trim();
    if (!t) return;
    setEditModuleSaving(true);
    try {
      await updateModule(editModuleTarget.id, t);
      toast({ title: 'Bab berhasil diperbarui' });
      setEditModuleTarget(null);
      onMutated();
    } catch (e: any) {
      toast({ title: 'Gagal memperbarui bab', description: e?.message, variant: 'destructive' });
    } finally { setEditModuleSaving(false); }
  }

  async function handleDeleteModule() {
    if (!deleteModuleTarget) return;
    setDeleteModuleSaving(true);
    try {
      await deleteModule(deleteModuleTarget.id);
      toast({ title: 'Bab berhasil dihapus' });
      setDeleteModuleTarget(null);
      onMutated();
    } catch (e: any) {
      toast({ title: 'Gagal menghapus bab', description: e?.message, variant: 'destructive' });
    } finally { setDeleteModuleSaving(false); }
  }

  // Dars handlers
  async function handleAddDars() {
    if (!addDarsModuleId) return;
    if (!addDarsForm.title.trim()) return;
    setAddDarsSaving(true);
    try {
      const rawVid = extractVideoId(addDarsForm.youtubeVideoId);
      await createDars(addDarsModuleId, {
        title: addDarsForm.title.trim(),
        durationMinutes: parseInt(addDarsForm.durationMinutes || '0', 10) || 0,
        youtubeVideoId: rawVid || undefined,
      });
      toast({ title: 'Pelajaran berhasil ditambahkan' });
      setAddDarsModuleId(null);
      setAddDarsForm(EMPTY_DARS_FORM);
      onMutated();
    } catch (e: any) {
      toast({ title: 'Gagal menambahkan pelajaran', description: e?.message, variant: 'destructive' });
    } finally { setAddDarsSaving(false); }
  }

  async function handleEditDars() {
    if (!editDarsTarget) return;
    if (!editDarsForm.title.trim()) return;
    setEditDarsSaving(true);
    try {
      const rawVid = extractVideoId(editDarsForm.youtubeVideoId);
      await updateDarsFull(editDarsTarget.dars.id, {
        title: editDarsForm.title.trim(),
        durationMinutes: parseInt(editDarsForm.durationMinutes || '0', 10) || 0,
        youtubeVideoId: rawVid || null,
      });
      toast({ title: 'Pelajaran berhasil diperbarui' });
      setEditDarsTarget(null);
      onMutated();
    } catch (e: any) {
      toast({ title: 'Gagal memperbarui pelajaran', description: e?.message, variant: 'destructive' });
    } finally { setEditDarsSaving(false); }
  }

  async function handleDeleteDars() {
    if (!deleteDarsTarget) return;
    setDeleteDarsSaving(true);
    try {
      await deleteDars(deleteDarsTarget.id);
      toast({ title: 'Pelajaran berhasil dihapus' });
      setDeleteDarsTarget(null);
      onMutated();
    } catch (e: any) {
      toast({ title: 'Gagal menghapus pelajaran', description: e?.message, variant: 'destructive' });
    } finally { setDeleteDarsSaving(false); }
  }

  return (
    <div className="space-y-3">
      {/* Module list with DnD */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
        <SortableContext items={moduleOrderIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {sortedModules.map(module => {
              const darsIds = darsOrderMap[module.id] ?? module.darsList.map(d => d.id);
              const sortedDars = darsIds
                .map(id => module.darsList.find(d => d.id === id))
                .filter(Boolean) as AdminDarsItem[];
              return (
                <SortableModuleRow
                  key={module.id}
                  module={module}
                  isExpanded={expandedIds.has(module.id)}
                  onToggle={() => toggleExpand(module.id)}
                  onEdit={() => { setEditModuleTarget(module); setEditModuleTitle(module.title); }}
                  onDelete={() => setDeleteModuleTarget(module)}
                >
                  {/* Dars list with inner DnD */}
                  <DndContext sensors={sensors} collisionDetection={closestCenter}
                    onDragEnd={(e) => handleDarsDragEnd(module.id, e)}>
                    <SortableContext items={darsIds} strategy={verticalListSortingStrategy}>
                      <div className="space-y-0.5 pt-1">
                        {sortedDars.map(dars => (
                          <SortableDarsRow
                            key={dars.id}
                            dars={dars}
                            onEdit={() => {
                              setEditDarsTarget({ moduleId: module.id, dars });
                              setEditDarsForm({
                                title: dars.title,
                                durationMinutes: dars.durationMinutes != null ? String(dars.durationMinutes) : '',
                                youtubeVideoId: dars.youtubeVideoId ?? '',
                              });
                            }}
                            onDelete={() => setDeleteDarsTarget({ id: dars.id, title: dars.title })}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                  <Button
                    type="button" variant="ghost" size="sm"
                    className="h-7 text-xs mt-2 text-muted-foreground hover:text-foreground w-full justify-start pl-1"
                    onClick={() => { setAddDarsModuleId(module.id); setAddDarsForm(EMPTY_DARS_FORM); }}
                  >
                    <Plus className="h-3 w-3 mr-1" />Tambah Pelajaran
                  </Button>
                </SortableModuleRow>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      <Button type="button" variant="outline" size="sm"
        onClick={() => { setAddModuleOpen(true); setAddModuleTitle(''); }}>
        <Plus className="h-4 w-4 mr-2" />Tambah Bab
      </Button>

      {/* ── Sub-Dialogs ──────────────────────────────────────────────── */}
      {/* Add Module */}
      <Dialog open={addModuleOpen} onOpenChange={(v) => !v && setAddModuleOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Tambah Bab</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-module-title">Judul Bab</Label>
              <Input id="add-module-title" placeholder="cth. Bab Thaharah" value={addModuleTitle}
                onChange={e => setAddModuleTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddModule())}
                autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddModuleOpen(false)}>Batal</Button>
            <Button type="button" onClick={handleAddModule} disabled={addModuleSaving || !addModuleTitle.trim()}>
              {addModuleSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Module */}
      <Dialog open={!!editModuleTarget} onOpenChange={(v) => !v && setEditModuleTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Bab</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-module-title">Judul Bab</Label>
              <Input id="edit-module-title" value={editModuleTitle}
                onChange={e => setEditModuleTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleEditModule())}
                autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditModuleTarget(null)}>Batal</Button>
            <Button type="button" onClick={handleEditModule} disabled={editModuleSaving || !editModuleTitle.trim()}>
              {editModuleSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Module */}
      <AlertDialog open={!!deleteModuleTarget} onOpenChange={(v) => !v && setDeleteModuleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Bab?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menghapus bab <strong>"{deleteModuleTarget?.title}"</strong>.{' '}
              <strong>Menghapus Bab ini akan menghapus semua pelajaran di dalamnya juga.</strong>{' '}
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteModule} disabled={deleteModuleSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteModuleSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Hapus Bab
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Dars */}
      <Dialog open={!!addDarsModuleId} onOpenChange={(v) => !v && setAddDarsModuleId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Tambah Pelajaran</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="add-dars-title">Judul Pelajaran</Label>
              <Input id="add-dars-title" placeholder="cth. Matan Bab Thaharah" value={addDarsForm.title}
                onChange={e => setAddDarsForm(p => ({ ...p, title: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-dars-duration">Durasi (menit)</Label>
              <Input id="add-dars-duration" type="number" min="0" placeholder="cth. 45"
                value={addDarsForm.durationMinutes}
                onChange={e => setAddDarsForm(p => ({ ...p, durationMinutes: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-dars-video">Link/ID Video YouTube (opsional)</Label>
              <Input id="add-dars-video"
                placeholder="https://youtu.be/xxx atau ID mentah"
                value={addDarsForm.youtubeVideoId}
                onChange={e => setAddDarsForm(p => ({ ...p, youtubeVideoId: e.target.value }))} />
              <p className="text-[11px] text-muted-foreground">
                Bisa dikosongkan dan diisi belakangan lewat Edit atau Auto-Match.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddDarsModuleId(null)}>Batal</Button>
            <Button type="button" onClick={handleAddDars} disabled={addDarsSaving || !addDarsForm.title.trim()}>
              {addDarsSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dars */}
      <Dialog open={!!editDarsTarget} onOpenChange={(v) => !v && setEditDarsTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Pelajaran</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-dars-title">Judul Pelajaran</Label>
              <Input id="edit-dars-title" value={editDarsForm.title}
                onChange={e => setEditDarsForm(p => ({ ...p, title: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dars-duration">Durasi (menit)</Label>
              <Input id="edit-dars-duration" type="number" min="0"
                value={editDarsForm.durationMinutes}
                onChange={e => setEditDarsForm(p => ({ ...p, durationMinutes: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dars-video">Link/ID Video YouTube</Label>
              <Input id="edit-dars-video"
                placeholder="https://youtu.be/xxx atau ID mentah (kosongkan untuk hapus)"
                value={editDarsForm.youtubeVideoId}
                onChange={e => setEditDarsForm(p => ({ ...p, youtubeVideoId: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditDarsTarget(null)}>Batal</Button>
            <Button type="button" onClick={handleEditDars} disabled={editDarsSaving || !editDarsForm.title.trim()}>
              {editDarsSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dars */}
      <AlertDialog open={!!deleteDarsTarget} onOpenChange={(v) => !v && setDeleteDarsTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pelajaran?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan menghapus pelajaran <strong>"{deleteDarsTarget?.title}"</strong>.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDars} disabled={deleteDarsSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteDarsSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Hapus Pelajaran
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AdminClassesPage() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassSummary | null>(null);
  const [form, setForm] = useState<ClassFormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<ClassSummary | null>(null);
  const [meetingTitleRows, setMeetingTitleRows] = useState<MeetingTitleRow[]>([]);
  const [autoMatchOpen, setAutoMatchOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const classesQuery = useQuery({
    queryKey: ['classes', 'admin'],
    queryFn: () => listClasses({ includeAll: true }),
  });
  const instructorsQuery = useQuery({
    queryKey: ['instructors', 'admin'],
    queryFn: listAllInstructorsForAdmin,
  });
  const classes = classesQuery.data ?? [];
  const instructors = instructorsQuery.data ?? [];

  const editingId = editingClass?.id ?? '';
  const { data: editingClassDetail } = useQuery({
    queryKey: ['class', editingId],
    queryFn: () => getClassById(editingId),
    enabled: !!editingClass && dialogOpen,
  });

  const { data: existingMeetingTitles } = useQuery({
    queryKey: ['class-meeting-titles', 'admin', editingId],
    queryFn: () => getClassMeetingTitles(editingId),
    enabled: !!editingClass && dialogOpen,
  });

  const { data: adminModules = [], refetch: refetchModules } = useQuery({
    queryKey: ['admin-modules', editingId],
    queryFn: () => listModulesForClass(editingId),
    enabled: !!editingClass && dialogOpen,
  });
  const isModuleClass = adminModules.length > 0 || (editingClassDetail?.modules?.length ?? 0) > 0;

  const invalidateClasses = () =>
    queryClient.invalidateQueries({ queryKey: ['classes', 'admin'] });

  // Penyimpanan judul per pertemuan dijalankan DI DALAM mutationFn (bukan di
  // onSuccess) supaya kegagalannya ikut ditangkap onError — sebelumnya kalau
  // saveMeetingTitles() gagal di dalam onSuccess yang async, tidak ada
  // onError maupun toast apa pun yang terpanggil; dialog cuma diam tanpa
  // penjelasan (Revisi 1 Bulan: "Judul per pertemuan tidak work").
  const createMutation = useMutation({
    mutationFn: async (payload: Parameters<typeof createClass>[0]) => {
      const created = await createClass(payload);
      if ((created as any)?.id) {
        try {
          await saveMeetingTitles((created as any).id, { isNewClass: true });
        } catch (titleError) {
          throw new Error(
            `Kelas berhasil ditambahkan, tapi judul per pertemuan gagal disimpan: ${
              titleError instanceof Error ? titleError.message : String(titleError)
            }`,
          );
        }
      }
      return created;
    },
    onSuccess: () => {
      toast({ title: 'Kelas berhasil ditambahkan' });
      setDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: 'Gagal menambahkan kelas', description: String((error as Error)?.message ?? error), variant: 'destructive' });
    },
    onSettled: () => {
      invalidateClasses();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Parameters<typeof updateClass>[1] }) => {
      await updateClass(id, data);
      try {
        await saveMeetingTitles(id);
      } catch (titleError) {
        throw new Error(
          `Kelas berhasil diperbarui, tapi judul per pertemuan gagal disimpan: ${
            titleError instanceof Error ? titleError.message : String(titleError)
          }`,
        );
      }
    },
    onSuccess: () => {
      toast({ title: 'Kelas berhasil diperbarui' });
      setDialogOpen(false);
    },
    onError: (error) => {
      toast({ title: 'Gagal memperbarui kelas', description: String((error as Error)?.message ?? error), variant: 'destructive' });
    },
    onSettled: () => {
      invalidateClasses();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteClass(id),
    onSuccess: () => {
      invalidateClasses();
      toast({ title: 'Kelas berhasil dihapus' });
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast({ title: 'Gagal menghapus kelas', description: String((error as Error)?.message ?? error), variant: 'destructive' });
      setDeleteTarget(null);
    },
  });

  useEffect(() => {
    if (!editingClass && instructors.length > 0 && !form.instructorId) {
      setForm((prev) => ({ ...prev, instructorId: instructors[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instructors]);

  useEffect(() => {
    if (editingClassDetail && editingClass) {
      setForm(classToForm(editingClassDetail));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingClassDetail]);

  // ── Sinkronkan baris "Judul per Pertemuan" saat data tersimpan dimuat (Prompt 127) ──
  // Dijalankan SEKALI per pembukaan dialog untuk kelas yang sama (dikunci
  // lewat ref `syncedMeetingTitlesForId`), bukan setiap kali `existingMeetingTitles`
  // berubah referensi. getClassMeetingTitles() selalu mengembalikan objek Map
  // BARU tiap fetch — tanpa penjaga ini, background refetch apa pun saat
  // dialog masih terbuka akan menimpa ulang baris yang baru diketik admin
  // dan belum sempat disimpan (Revisi 1 Bulan: "Judul per pertemuan tidak work").
  const syncedMeetingTitlesForId = useRef<string | null>(null);
  useEffect(() => {
    if (!dialogOpen) {
      syncedMeetingTitlesForId.current = null;
      return;
    }
    if (existingMeetingTitles && editingClass && syncedMeetingTitlesForId.current !== editingId) {
      const maxIndex = existingMeetingTitles.size > 0 ? Math.max(...existingMeetingTitles.keys()) : -1;
      const rows: MeetingTitleRow[] = [];
      for (let i = 0; i <= maxIndex; i++) {
        const saved = existingMeetingTitles.get(i);
        rows.push({ videoIndex: i, title: saved?.title ?? '', description: saved?.description ?? '' });
      }
      setMeetingTitleRows(rows);
      syncedMeetingTitlesForId.current = editingId;
    }
  }, [existingMeetingTitles, editingClass, editingId, dialogOpen]);

  function addMeetingTitleRow() {
    setMeetingTitleRows((rows) => [
      ...rows,
      { videoIndex: rows.length, title: '', description: '' },
    ]);
  }

  function removeMeetingTitleRow(videoIndex: number) {
    setMeetingTitleRows((rows) =>
      rows.filter((r) => r.videoIndex !== videoIndex).map((r, i) => ({ ...r, videoIndex: i })),
    );
  }

  function updateMeetingTitleRow(videoIndex: number, patch: Partial<Pick<MeetingTitleRow, 'title' | 'description'>>) {
    setMeetingTitleRows((rows) =>
      rows.map((r) => (r.videoIndex === videoIndex ? { ...r, ...patch } : r)),
    );
  }

  async function saveMeetingTitles(classId: string, opts?: { isNewClass?: boolean }) {
    // PENJAGA: hanya sentuh judul pertemuan kalau isi form memang milik kelas
    // ini DAN sudah selesai dimuat dari server. Tanpa penjaga ini, langkah
    // "hapus semua lalu simpan ulang" di bawah bisa menghapus judul yang
    // sudah tersimpan, karena updateMutation juga dipakai oleh tombol
    // "Jadikan Draft"/"Terbitkan" di tabel — yang tidak pernah membuka dialog
    // sehingga meetingTitleRows masih kosong (atau malah berisi sisa milik
    // kelas lain yang tadi dibuka).
    // Kelas baru dikecualikan: belum punya baris tersimpan yang bisa hilang.
    if (!opts?.isNewClass && syncedMeetingTitlesForId.current !== classId) return;

    // Hapus dulu SEMUA baris lama kelas ini, baru simpan ulang set yang
    // sedang ada di form — supaya baris yang dihapus admin lewat
    // removeMeetingTitleRow() (yang cuma menggeser nomor urut baris lain di
    // state lokal, tidak pernah menghapus dari DB) tidak tertinggal jadi
    // data basi di video_index yang sudah tidak ada baris form-nya lagi.
    await deleteClassMeetingTitlesForClass(classId);
    if (meetingTitleRows.length > 0) {
      await Promise.all(
        meetingTitleRows.map((row) =>
          upsertClassMeetingTitle({
            classId,
            videoIndex: row.videoIndex,
            title: row.title,
            description: row.description,
          }),
        ),
      );
    }
    queryClient.invalidateQueries({ queryKey: ['class-meeting-titles', classId] });
    queryClient.invalidateQueries({ queryKey: ['class-meeting-titles', 'admin', classId] });
  }

  // Tabel manajemen ini diurutkan A-Z berdasarkan judul supaya gampang dicari
  // saat mengelola (Revisi 1 Bulan: "Urutan manajemen kelas disini sesuai
  // abjad saja sidi a-z, agak kesulitan ketika lagi manage"). Kolom "Urutan"
  // tetap menampilkan display_order apa adanya — itu yang dipakai Katalog &
  // Beranda (diatur lewat drag & drop di Admin > Tata Letak Katalog), cuma
  // urutan BARIS di tabel ini yang tidak lagi mengikutinya.
  const filtered = classes
    .filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.title.localeCompare(b.title, 'id', { sensitivity: 'base' }));

  function openCreateDialog() {
    setEditingClass(null);
    setForm({ ...EMPTY_FORM, instructorId: instructors[0]?.id ?? '' });
    setMeetingTitleRows([]);
    setDialogOpen(true);
  }

  function openEditDialog(cls: ClassSummary) {
    setEditingClass(cls);
    setMeetingTitleRows([]);
    setForm({
      title: cls.title,
      description: cls.description,
      coverImage: cls.coverImage,
      basePrice: String(cls.basePrice),
      discountPrice: cls.discountPrice != null ? String(cls.discountPrice) : '',
      status: cls.status,
      level: cls.level ?? '',
      category: cls.category ?? '',
      instructorId: cls.instructor.id,
      youtubePlaylistId: cls.youtubePlaylistId ?? '',
      gdriveMateriUrl: '',
      waGroupUrl: '',
      soalLatihanUrl: '',
      ebookUrl: '',
      testimoniFormUrl: '',
      meetingCount: '',
      displayOrder: String(cls.displayOrder ?? 0),
      reverseVideoOrder: false,
      certificateTemplateUrl: cls.certificateTemplateUrl ?? '',
    });
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.title.trim() || !form.instructorId) {
      toast({ title: 'Judul kelas dan pengajar wajib diisi', variant: 'destructive' });
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description,
      coverImage: form.coverImage,
      basePrice: Number(form.basePrice) || 0,
      discountPrice: form.discountPrice ? Number(form.discountPrice) : null,
      status: form.status,
      level: form.level || null,
      category: form.category || null,
      instructorId: form.instructorId,
      youtubePlaylistId: form.youtubePlaylistId.trim()
        ? extractPlaylistId(form.youtubePlaylistId)
        : null,
      gdriveMateriUrl: form.gdriveMateriUrl.trim() || null,
      waGroupUrl: form.waGroupUrl.trim() || null,
      soalLatihanUrl: form.soalLatihanUrl.trim() || null,
      ebookUrl: form.ebookUrl.trim() || null,
      testimoniFormUrl: form.testimoniFormUrl.trim() || null,
      meetingCount: form.meetingCount ? parseInt(form.meetingCount, 10) : null,
      displayOrder: form.displayOrder ? parseInt(form.displayOrder, 10) : 0,
      reverseVideoOrder: form.reverseVideoOrder,
      certificateTemplateUrl: form.certificateTemplateUrl.trim() || null,
    };

    if (editingClass) {
      updateMutation.mutate({ id: editingClass.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleTogglePublish(cls: ClassSummary) {
    updateMutation.mutate({
      id: cls.id,
      data: { status: cls.status === 'published' ? 'draft' : 'published' },
    });
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDetailLoading = !!editingClass && !editingClassDetail;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl font-bold text-foreground">Manajemen Kelas</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Kelola daftar kelas fiqih, harga, dan status publikasinya.
            </p>
          </div>
          <Button data-testid="button-add-class" onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Kelas
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari kelas..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-class"
              />
            </div>
          </CardHeader>
          <CardContent>
            {classesQuery.isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Memuat data kelas...
              </div>
            ) : classesQuery.isError ? (
              <div className="text-center text-sm text-destructive py-8">
                Gagal memuat data kelas dari server.
              </div>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Urutan</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Harga</TableHead>
                    <TableHead>Modul</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                        Tidak ada kelas yang cocok dengan pencarian.
                      </TableCell>
                    </TableRow>
                  )}
                  {filtered.map((cls) => (
                    <TableRow key={cls.id} data-testid={`row-class-${cls.id}`}>
                      <TableCell className="text-sm text-muted-foreground" data-testid={`text-display-order-${cls.id}`}>
                        {cls.displayOrder ?? 0}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={cls.coverImage}
                            alt={cls.title}
                            className="h-10 w-14 rounded object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate max-w-[220px]">
                              {cls.title}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                              {cls.instructor.name}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {cls.discountPrice ? (
                            <>
                              <span className="font-medium text-foreground">{formatPrice(cls.discountPrice)}</span>
                              <span className="block text-xs text-muted-foreground line-through">
                                {formatPrice(cls.basePrice)}
                              </span>
                            </>
                          ) : (
                            <span className="font-medium text-foreground">{formatPrice(cls.basePrice)}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {cls.moduleCount} modul
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={cls.status === 'published' ? 'success' : 'neutral'}
                          data-testid={`badge-status-${cls.id}`}
                        >
                          {cls.status === 'published' ? 'Published' : 'Draft'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTogglePublish(cls)}
                            disabled={updateMutation.isPending}
                            data-testid={`button-toggle-status-${cls.id}`}
                          >
                            {cls.status === 'published' ? 'Jadikan Draft' : 'Terbitkan'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(cls)}
                            data-testid={`button-edit-class-${cls.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteTarget(cls)}
                            data-testid={`button-delete-class-${cls.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
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

      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setAutoMatchOpen(false); }}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingClass ? 'Edit Kelas' : 'Tambah Kelas Baru'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="class-title">Judul Kelas</Label>
                <Input
                  id="class-title"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  data-testid="input-class-title"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-description">Deskripsi</Label>
                <Textarea
                  id="class-description"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  data-testid="input-class-description"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Gambar Sampul</Label>
                <ImageUploadField
                  value={form.coverImage}
                  onChange={(url) => setForm((p) => ({ ...p, coverImage: url }))}
                  previewClassName="w-16 h-20 rounded object-cover border"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="class-base-price">Harga Sebelum Diskon (Rp)</Label>
                  <Input
                    id="class-base-price"
                    type="number"
                    value={form.basePrice}
                    onChange={(e) => setForm((p) => ({ ...p, basePrice: e.target.value }))}
                    data-testid="input-class-base-price"
                  />
                  <p className="text-xs text-muted-foreground">
                    Harga referensi yang akan dicoret/strikethrough. Kosongkan kolom
                    di bawah kalau kelas ini tidak ada diskon.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="class-discount-price">Harga Jual Sekarang (Rp, opsional)</Label>
                  <Input
                    id="class-discount-price"
                    type="number"
                    value={form.discountPrice}
                    onChange={(e) => setForm((p) => ({ ...p, discountPrice: e.target.value }))}
                    data-testid="input-class-discount-price"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ini harga yang BENERAN DIBAYAR pelajar. Kosongkan kalau tidak ada
                    diskon — harga di atas ("Sebelum Diskon") akan dipakai sebagai
                    harga jual.
                  </p>
                  {form.discountPrice && Number(form.discountPrice) > Number(form.basePrice) && (
                    <p className="text-xs text-destructive font-medium mt-1" data-testid="warning-price-mismatch">
                      ⚠ Harga Jual Sekarang ({formatPrice(Number(form.discountPrice))}) lebih
                      mahal dari Harga Sebelum Diskon ({formatPrice(Number(form.basePrice))}).
                      Pelajar akan dikenakan harga yang LEBIH MAHAL. Pastikan ini benar-benar
                      yang dimaksud, atau tukar posisi kedua angka ini.
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pengajar</Label>
                  <Select
                    value={form.instructorId}
                    onValueChange={(v) => setForm((p) => ({ ...p, instructorId: v }))}
                  >
                    <SelectTrigger data-testid="select-class-instructor">
                      <SelectValue placeholder="Pilih pengajar" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 overflow-y-auto">
                      {instructors.map((instructor) => (
                        <SelectItem key={instructor.id} value={instructor.id}>
                          {instructor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Level</Label>
                  <Select
                    value={form.level || 'none'}
                    onValueChange={(v) => setForm((p) => ({ ...p, level: v === 'none' ? '' : (v as ClassFormState['level']) }))}
                  >
                    <SelectTrigger data-testid="select-class-level">
                      <SelectValue placeholder="Pilih level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tidak ada</SelectItem>
                      <SelectItem value="pemula">Pemula</SelectItem>
                      <SelectItem value="menengah">Menengah</SelectItem>
                      <SelectItem value="lanjutan">Lanjutan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="class-category">Kategori</Label>
                  <Input
                    id="class-category"
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    data-testid="input-class-category"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm((p) => ({ ...p, status: v as ClassFormState['status'] }))}
                  >
                    <SelectTrigger data-testid="select-class-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-display-order">Urutan Tampil</Label>
                <Input
                  id="class-display-order"
                  type="number"
                  placeholder="0"
                  value={form.displayOrder}
                  onChange={(e) => setForm((p) => ({ ...p, displayOrder: e.target.value }))}
                  data-testid="input-class-display-order"
                />
                <p className="text-xs text-muted-foreground">
                  Menentukan posisi kelas dalam daftar (angka lebih kecil tampil lebih dulu). Kelas dengan kategori sama diurutkan berdasarkan angka ini.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-youtube-playlist">Link Playlist YouTube</Label>
                <Input
                  id="class-youtube-playlist"
                  type="text"
                  placeholder="https://www.youtube.com/playlist?list=..."
                  value={form.youtubePlaylistId}
                  onChange={(e) => setForm((p) => ({ ...p, youtubePlaylistId: e.target.value }))}
                  data-testid="input-class-youtube-playlist"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Bisa paste link lengkap dari YouTube (contoh: https://youtube.com/playlist?list=PLxxxxx)
                  atau ID playlist saja — sistem otomatis mengambil ID-nya.
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-lg border p-4">
                <Switch
                  id="class-reverse-video-order"
                  checked={form.reverseVideoOrder}
                  onCheckedChange={(checked) => setForm((p) => ({ ...p, reverseVideoOrder: checked }))}
                  data-testid="switch-class-reverse-video-order"
                />
                <div className="space-y-0.5">
                  <Label htmlFor="class-reverse-video-order" className="cursor-pointer font-medium">
                    Balik Urutan Video
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Aktifkan kalau urutan video di playlist YouTube kelas ini kebalik dari urutan pertemuan aslinya.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-meeting-count">Jumlah Pertemuan</Label>
                <Input
                  id="class-meeting-count"
                  type="number"
                  placeholder="Contoh: 2"
                  value={form.meetingCount}
                  onChange={(e) => setForm((p) => ({ ...p, meetingCount: e.target.value }))}
                  data-testid="input-class-meeting-count"
                />
                <p className="text-xs text-muted-foreground">
                  Khusus kelas berbasis playlist video (tanpa breakdown modul manual). Ditampilkan sebagai "X Pertemuan" di halaman kelas.
                </p>
              </div>
              {form.youtubePlaylistId.trim() && (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Judul per Pertemuan</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Khusus kelas video playlist. Kosongkan judul kalau ingin tetap pakai default "Pertemuan ke-N".
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addMeetingTitleRow}
                      data-testid="button-add-meeting-title"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Tambah Pertemuan
                    </Button>
                  </div>
                  {meetingTitleRows.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Belum ada baris. Klik "Tambah Pertemuan" untuk mulai mengisi.
                    </p>
                  )}
                  <div className="space-y-3">
                    {meetingTitleRows.map((row) => (
                      <div key={row.videoIndex} className="flex gap-2 items-start rounded-md border p-3">
                        <div className="flex-1 space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            Pertemuan ke-{row.videoIndex + 1}
                          </p>
                          <Input
                            placeholder={`Judul (contoh: Pembahasan Hukum Wudhu)`}
                            value={row.title}
                            onChange={(e) => updateMeetingTitleRow(row.videoIndex, { title: e.target.value })}
                            data-testid={`input-meeting-title-${row.videoIndex}`}
                          />
                          <Textarea
                            placeholder="Deskripsi singkat (opsional)"
                            rows={2}
                            value={row.description}
                            onChange={(e) => updateMeetingTitleRow(row.videoIndex, { description: e.target.value })}
                            data-testid={`input-meeting-description-${row.videoIndex}`}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMeetingTitleRow(row.videoIndex)}
                          data-testid={`button-remove-meeting-title-${row.videoIndex}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="class-gdrive-materi">Link Google Drive Materi (PDF)</Label>
                <Input
                  id="class-gdrive-materi"
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={form.gdriveMateriUrl}
                  onChange={(e) => setForm((p) => ({ ...p, gdriveMateriUrl: e.target.value }))}
                  data-testid="input-class-gdrive-materi"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-wa-group">Link Grup WhatsApp</Label>
                <Input
                  id="class-wa-group"
                  type="url"
                  placeholder="https://chat.whatsapp.com/..."
                  value={form.waGroupUrl}
                  onChange={(e) => setForm((p) => ({ ...p, waGroupUrl: e.target.value }))}
                  data-testid="input-class-wa-group"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-soal-latihan">Link Soal Latihan</Label>
                <Input
                  id="class-soal-latihan"
                  type="url"
                  placeholder="https://forms.gle/... atau link lainnya"
                  value={form.soalLatihanUrl}
                  onChange={(e) => setForm((p) => ({ ...p, soalLatihanUrl: e.target.value }))}
                  data-testid="input-class-soal-latihan"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="class-ebook-url">Link Ebook</Label>
                <Input
                  id="class-ebook-url"
                  type="url"
                  value={form.ebookUrl}
                  onChange={(e) => setForm((p) => ({ ...p, ebookUrl: e.target.value }))}
                  placeholder="https://drive.google.com/... atau link PDF"
                  data-testid="input-class-ebook-url"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class-testimoni">Link Testimoni (Google Form)</Label>
                <Input
                  id="class-testimoni"
                  type="url"
                  placeholder="https://forms.gle/..."
                  value={form.testimoniFormUrl}
                  onChange={(e) => setForm((p) => ({ ...p, testimoniFormUrl: e.target.value }))}
                  data-testid="input-class-testimoni"
                />
              </div>
              <div className="space-y-2">
                <Label>Template Sertifikat (opsional)</Label>
                <ImageUploadField
                  value={form.certificateTemplateUrl}
                  onChange={(url) => setForm((p) => ({ ...p, certificateTemplateUrl: url }))}
                  previewClassName="w-28 h-20 rounded-md object-cover border"
                />
                <p className="text-xs text-muted-foreground">
                  Upload gambar template landscape (disarankan rasio A4 landscape, mis. 1123×794 px atau lebih besar).
                  Kosongkan untuk memakai desain sertifikat bawaan.
                </p>
              </div>

              {/* ── Struktur Bab & Pelajaran — khusus kelas modul/dars */}
              {editingClass && isModuleClass && (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Struktur Bab &amp; Pelajaran</Label>
                  </div>
                  <ModuleStructureSection
                    classId={editingClass.id}
                    modules={adminModules}
                    onMutated={() => {
                      refetchModules();
                      queryClient.invalidateQueries({ queryKey: ['class', editingId] });
                    }}
                  />
                </div>
              )}

              {/* Tool Auto-Match — khusus kelas yang punya modul/dars */}
              {editingClass && isModuleClass && (
                <div className="rounded-lg border border-dashed p-4 space-y-2">
                  <Label>Auto-Match Video dari Playlist YouTube</Label>
                  <p className="text-xs text-muted-foreground">
                    Cocokkan video di sebuah playlist YouTube ke dars yang sudah ada secara otomatis berdasarkan kemiripan judul.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAutoMatchOpen(true)}
                    data-testid="button-open-auto-match"
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    Buka Tool Auto-Match
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSaving || isDetailLoading} data-testid="button-submit-class">
                {(isSaving || isDetailLoading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingClass ? 'Simpan Perubahan' : 'Tambah Kelas'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Kelas?</AlertDialogTitle>
            <AlertDialogDescription>
              Kelas "{deleteTarget?.title}" akan dihapus secara permanen dari database. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-class"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Auto-Match Dialog — hanya di-render kalau kelas yang sedang diedit punya modul */}
      {editingClass && editingClassDetail && editingClassDetail.modules.length > 0 && (
        <AutoMatchPlaylistDialog
          open={autoMatchOpen}
          onClose={() => setAutoMatchOpen(false)}
          darsList={editingClassDetail.modules.flatMap((m: any) =>
            m.dars.map((d: { id: string; title: string }) => ({ id: d.id, title: d.title, moduleTitle: m.title })),
          )}
          onApplied={() => {
            queryClient.invalidateQueries({ queryKey: ['class', editingClass.id] });
          }}
        />
      )}
    </AdminLayout>
  );
}
