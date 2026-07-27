import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

// ── YouTube IFrame API global type ────────────────────────────────────────────
declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        options: {
          videoId?: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (event: { target: any }) => void;
            onStateChange?: (event: { target: any; data: number }) => void;
            onError?: (event: { target: any; data: number }) => void;
          };
        },
      ) => {
        getCurrentTime: () => number;
        getDuration?: () => number;
        getPlaylist: () => string[] | undefined;
        cueVideoById: (videoId: string, startSeconds?: number) => void;
        seekTo: (seconds: number, allowSeekAhead: boolean) => void;
        playVideo: () => void;
        destroy: () => void;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}
import { toast } from 'sonner';
import { useParams, Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CertificateView } from '@/components/CertificateView';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Clock,
  PlayCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Loader2,
  Video,
} from 'lucide-react';

import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { FacilitasCard } from '@/components/FacilitasCard';
import { ClassReviewSection } from '@/components/ClassReviewSection';
import { Button } from '@/components/ui/button';
import { SEO } from '@/components/SEO';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/data/mockClasses';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getClassById,
  listProgress,
  listEnrollments,
  listClasses,
  updateProgress as updateProgressFn,
  completeEnrollment as completeEnrollmentFn,
  getVideoWatchProgress,
  saveVideoWatchProgress,
  getVideoCompletions,
  markVideoCompleted,
  getInstructorRatingForClass,
  submitInstructorRating,
  getClassMeetingTitles,
  getMyCertificate,
  requestCertificate,
  type CertificateRequest,
} from '@/lib/db';
import { StarRating } from '@/components/StarRating';

// ── Local types (sesuai return getClassById dari db.ts) ───────────────────────
type DarsItem = { id: string; title: string; durationMinutes: number | null; orderIndex: number; youtubeVideoId: string | null };
type ClassDarsModule = { id: string; title: string; orderIndex: number; durationMinutes: number; dars: DarsItem[] };

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDuration(min: number | null) {
  if (!min) return '-';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} jam ${m > 0 ? m + ' mnt' : ''}` : `${m} menit`;
}

// ── Flatten all dars for prev/next navigation ─────────────────────────────────
function flattenDars(modules: ClassDarsModule[]): { dars: DarsItem; module: ClassDarsModule }[] {
  return modules.flatMap((m) => m.dars.map((d) => ({ dars: d, module: m })));
}

// ── Video Placeholder ─────────────────────────────────────────────────────────
function VideoPlaceholder({ title }: { title: string }) {
  return (
    <div className="w-full bg-black">
      <div
        className="relative w-full flex items-center justify-center bg-zinc-900"
        style={{ paddingBottom: '56.25%' }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-400">
          <Video className="w-12 h-12 opacity-30" />
          <p className="text-sm font-medium opacity-60">{title}</p>
          <p className="text-xs opacity-40">Video akan segera tersedia</p>
        </div>
      </div>
    </div>
  );
}

// ── Dars Video Player — YouTube player untuk mode Modul/Bab ───────────────────
// Gunakan key={darsId} dari parent agar component remount saat pindah dars,
// sehingga player lama di-destroy dan player baru dibuat dari nol.
function DarsVideoPlayer({
  youtubeVideoId,
  darsIndex,
  classId,
  userId,
  onVideoEnded,
}: {
  youtubeVideoId: string;
  darsIndex: number;
  classId: string;
  userId: string;
  onVideoEnded: () => void;
}) {
  const [ytApiReady, setYtApiReady] = useState(false);
  const playerRef = useRef<any>(null);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ambil posisi terakhir yang tersimpan — gunakan videoIndex=darsIndex sebagai kunci
  const { data: savedProgress, isLoading: isProgressLoading } = useQuery({
    queryKey: ['videoWatchProgress', userId, classId],
    queryFn: () => getVideoWatchProgress(userId, classId),
    enabled: !!userId && !!classId,
    staleTime: Infinity,
  });

  // Load YouTube IFrame API script sekali, global
  useEffect(() => {
    if (window.YT?.Player) { setYtApiReady(true); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); setYtApiReady(true); };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
  }, []);

  const flushProgress = useCallback(() => {
    const p = playerRef.current;
    if (!p || !userId || !classId) return;
    try {
      const seconds = Math.floor(p.getCurrentTime());
      if (seconds > 0) {
        saveVideoWatchProgress({ userId, classId, videoIndex: darsIndex, positionSeconds: seconds });
      }
    } catch (_) { /* player may already be destroyed */ }
  }, [userId, classId, darsIndex]);

  // Buat player saat API siap & progress sudah dimuat
  useEffect(() => {
    if (!ytApiReady || isProgressLoading || playerRef.current) return;

    // Resume hanya kalau videoIndex yang tersimpan cocok dengan dars ini
    const resume =
      savedProgress && savedProgress.videoIndex === darsIndex
        ? savedProgress.positionSeconds
        : 0;

    const player = new window.YT.Player('dars-video-player', {
      videoId: youtubeVideoId,
      playerVars: {
        autoplay: 0,
        rel: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        fs: 1,
        playsinline: 1,
        ...(resume > 0 ? { start: resume } : {}),
      },
      events: {
        onReady: () => {
          if (resume > 0) {
            toast.info(getResumeLabel(resume), { duration: 4000 });
          }
        },
        onStateChange: (event: { target: any; data: number }) => {
          if (event.data === 0) {
            // ENDED: tandai dars selesai & pindah ke dars berikutnya
            onVideoEnded();
          } else if (event.data === 2) {
            // PAUSED: flush posisi ke DB
            flushProgress();
          } else if (event.data === 3) {
            // BUFFERING/SEEK: tidak write ke DB
          }
        },
      },
    });

    playerRef.current = player;
    saveIntervalRef.current = setInterval(flushProgress, 15_000);

    return () => {
      flushProgress();
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
      try { player.destroy(); } catch (_) { /* noop */ }
      playerRef.current = null;
    };
  }, [ytApiReady, isProgressLoading, savedProgress, darsIndex, youtubeVideoId, onVideoEnded, flushProgress]);

  return (
    <div className="w-full bg-black">
      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
        <div id="dars-video-player" className="absolute inset-0 w-full h-full" />
      </div>
    </div>
  );
}

// ── Certificate Section ────────────────────────────────────────────────────────
function CertificateSection({
  classId,
  classTitle,
  isClassCompleted,
}: {
  classId: string;
  classTitle: string;
  // Revisi 5 item 6: sertifikat hanya bisa diambil kalau kelas sudah 100% selesai.
  isClassCompleted: boolean;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [fullName, setFullName] = useState(user?.name ?? '');
  const [score, setScore] = useState('');
  const [showCertModal, setShowCertModal] = useState(false);
  const [issuedCert, setIssuedCert] = useState<CertificateRequest | null>(null);

  const { data: myCert } = useQuery({
    queryKey: ['my-certificate', user?.id, classId],
    queryFn: () => getMyCertificate(user!.id, classId),
    enabled: !!user?.id,
  });

  const requestMutation = useMutation({
    mutationFn: () => requestCertificate({ classId, fullName, email: user?.email ?? '', score }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['my-certificate', user?.id, classId] });
      setIsFormOpen(false);
      setIssuedCert(data);
      setShowCertModal(true);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Gagal mengambil sertifikat.'),
  });

  let mainContent: React.ReactNode;

  if (myCert) {
    mainContent = (
      <div className="bg-card rounded-2xl border p-5 space-y-3">
        <p className="text-sm font-semibold text-foreground">Sertifikat Kamu</p>
        <p className="text-xs text-muted-foreground">No. {myCert.certificateNumber}</p>
        <a
          href={`/sertifikat/${myCert.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-primary font-medium hover:underline"
        >
          <Award className="w-4 h-4" /> Lihat &amp; Download Sertifikat
        </a>
      </div>
    );
  } else if (!isClassCompleted) {
    mainContent = (
      <div className="bg-card rounded-2xl border p-5 space-y-2">
        <p className="text-sm font-semibold text-foreground">Ambil Sertifikat</p>
        <p className="text-xs text-muted-foreground">
          Selesaikan seluruh kelas ini dulu untuk bisa mengambil sertifikat.
        </p>
      </div>
    );
  } else {
    mainContent = (
      <div className="bg-card rounded-2xl border p-5 space-y-3">
        <p className="text-sm font-semibold text-foreground">Ambil Sertifikat</p>
        {!isFormOpen ? (
          <Button size="sm" onClick={() => setIsFormOpen(true)}>
            <Award className="w-4 h-4 mr-1.5" /> Ambil Sertifikat Kelas Ini
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nama Lengkap</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nilai Soal Latihan (opsional)</Label>
              <Input value={score} onChange={(e) => setScore(e.target.value)} placeholder="cth: 90" />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => requestMutation.mutate()}
                disabled={!fullName.trim() || requestMutation.isPending}
              >
                {requestMutation.isPending ? 'Menerbitkan...' : 'Terbitkan Sertifikat'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsFormOpen(false)}>Batal</Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {mainContent}
      <Dialog open={showCertModal} onOpenChange={setShowCertModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sertifikat Berhasil Diterbitkan 🎉</DialogTitle>
          </DialogHeader>
          {issuedCert && (
            <div className="space-y-4">
              <CertificateView cert={issuedCert} showPrintButton={false} />
              <div className="flex justify-end">
                <a
                  href={`/sertifikat/${issuedCert.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary font-medium hover:underline"
                >
                  Buka halaman lengkap sertifikat →
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Playlist Mode: helper label untuk toast resume ─────────────────────────────
function getResumeLabel(positionSeconds: number) {
  const menit = Math.floor(positionSeconds / 60);
  return menit > 0 ? `Melanjutkan dari menit ke-${menit}` : `Melanjutkan dari detik ke-${positionSeconds}`;
}

// ── Playlist Mode ─────────────────────────────────────────────────────────────
function PlaylistMode({
  classId,
  classTitle,
  classDescription,
  classCategory,
  instructorId,
  instructorName,
  instructorBio,
  instructorPhotoUrl,
  instructorClassCount,
  playlistId,
  enrollmentId,
  initialIsCompleted,
  userId,
  gdriveMateriUrl,
  waGroupUrl,
  soalLatihanUrl,
  ebookUrl,
  testimoniFormUrl,
  reverseVideoOrder = false,
}: {
  classId: string;
  classTitle: string;
  classDescription: string;
  classCategory: string | null;
  instructorId: string;
  instructorName: string;
  instructorBio: string;
  instructorPhotoUrl: string;
  instructorClassCount: number;
  playlistId: string;
  enrollmentId: string | null;
  initialIsCompleted: boolean;
  userId: string;
  gdriveMateriUrl?: string | null;
  waGroupUrl?: string | null;
  soalLatihanUrl?: string | null;
  ebookUrl?: string | null;
  testimoniFormUrl?: string | null;
  reverseVideoOrder?: boolean;
}) {
  const queryClient = useQueryClient();
  const isEnrolled = !!enrollmentId;

  // ── Rating Pengajar (Prompt 118 — spesifik per kelas, terpisah dari review kelas) ──
  const { data: instructorRatingData = { average: 0, count: 0, myRating: null } } = useQuery({
    queryKey: ['instructor-rating', instructorId, classId, userId],
    queryFn: () => getInstructorRatingForClass(userId, instructorId, classId),
    enabled: !!instructorId && !!classId,
  });

  // ── Judul/deskripsi custom per pertemuan (Prompt 127 — khusus video playlist) ──
  const { data: meetingTitles = new Map<number, { videoIndex: number; title: string | null; description: string | null }>() } = useQuery({
    queryKey: ['class-meeting-titles', classId],
    queryFn: () => getClassMeetingTitles(classId),
    enabled: !!classId,
  });

  const submitInstructorRatingMutation = useMutation({
    mutationFn: (params: { instructorId: string; classId: string; rating: number }) =>
      submitInstructorRating(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-rating', instructorId, classId, userId] });
      queryClient.invalidateQueries({ queryKey: ['instructor-detail'] });
      queryClient.invalidateQueries({ queryKey: ['instructor-overall-rating', instructorId] });
      toast.success('Rating pengajar tersimpan');
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Gagal menyimpan rating pengajar');
    },
  });

  // ── YouTube IFrame API state ──
  const [ytApiReady, setYtApiReady] = useState(false);
  const playerRef = useRef<any>(null);
  const metaPlayerRef = useRef<any>(null);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentIndexRef = useRef(0);
  const [watchedPercent, setWatchedPercent] = useState(0);
  const skipNextNavRef = useRef(false);

  // ── Daftar video individual dalam playlist — didapat sekali lewat getPlaylist() ──
  const [videoIds, setVideoIds] = useState<string[] | null>(null);
  const [metaError, setMetaError] = useState(false);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);

  // ── Load saved progress ──
  const { data: savedProgress, isLoading: isProgressLoading } = useQuery({
    queryKey: ['videoWatchProgress', userId, classId],
    queryFn: () => getVideoWatchProgress(userId, classId),
    enabled: !!userId && !!classId,
    staleTime: Infinity,
  });

  // ── Load video completions (centang per-pertemuan) ──
  const { data: completedIndexes = new Set<number>() } = useQuery({
    queryKey: ['video-completions', userId, classId],
    queryFn: () => getVideoCompletions(userId!, classId!),
    enabled: !!userId && !!classId,
  });

  // ── Load YouTube IFrame API script (once, globally) ──
  useEffect(() => {
    if (window.YT?.Player) {
      setYtApiReady(true);
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      setYtApiReady(true);
    };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
  }, []);

  // ── STEP 1: baca daftar video ID individual dalam playlist (sekali saja) ──
  // CATATAN PRIVASI: untuk mendapat daftar video ID tanpa API key tambahan, kita
  // sempat memuat player dalam mode `listType: playlist` (autoplay MATI, muted)
  // hanya untuk membaca metadata lewat getPlaylist(), lalu langsung di-destroy.
  // Ini artinya ada eksposur sesaat ke metadata playlist saat player itu dimuat —
  // keterbatasan teknis yang dijelaskan lebih lanjut di laporan pengerjaan.
  useEffect(() => {
    if (!playlistId || !ytApiReady || videoIds !== null) return;

    // Reset status error tiap kali memulai siklus pengambilan metadata baru,
    // supaya tidak "nyangkut" di tampilan error kalau efek ini pernah dijalankan
    // ulang untuk playlist yang sama.
    setMetaError(false);

    let cancelled = false;
    let retried = false;
    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    // Teardown idempoten: aman dipanggil berkali-kali dari onReady/onError/cleanup
    // tanpa risiko double-destroy.
    const teardown = (target: any) => {
      if (destroyed) return;
      destroyed = true;
      try {
        target?.destroy();
      } catch (_) { /* noop */ }
    };

    const readPlaylist = (event: any) => {
      if (cancelled) return;
      try {
        const ids: string[] = event.target.getPlaylist() ?? [];
        if (ids.length > 0) {
          setVideoIds(reverseVideoOrder ? [...ids].reverse() : ids);
          teardown(event.target);
          return;
        }
      } catch (_) { /* fall through to retry/error below */ }

      // getPlaylist() kadang belum terisi tepat saat onReady — beri satu kali
      // kesempatan retry singkat sebelum benar-benar dianggap gagal.
      if (!retried) {
        retried = true;
        retryTimeoutId = setTimeout(() => {
          retryTimeoutId = null;
          if (cancelled) return;
          try {
            const ids: string[] = event.target.getPlaylist() ?? [];
            if (ids.length > 0) {
              setVideoIds(reverseVideoOrder ? [...ids].reverse() : ids);
            } else {
              setMetaError(true);
            }
          } catch (_) {
            setMetaError(true);
          } finally {
            teardown(event.target);
          }
        }, 800);
        return;
      }

      setMetaError(true);
      teardown(event.target);
    };

    const metaPlayer = new window.YT.Player('yt-meta-container', {
      playerVars: {
        listType: 'playlist',
        list: playlistId,
        autoplay: 0,
        mute: 1,
      } as any,
      events: {
        onReady: readPlaylist,
        onError: (event: any) => {
          if (cancelled) return;
          setMetaError(true);
          teardown(event.target);
        },
      },
    });
    metaPlayerRef.current = metaPlayer;

    return () => {
      cancelled = true;
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      teardown(metaPlayerRef.current);
      metaPlayerRef.current = null;
    };
  }, [playlistId, ytApiReady, videoIds, reverseVideoOrder]);

  // ── Helper: hitung & tampilkan persentase TANPA menulis ke DB ──
  // Dipanggil saat buffering/seek agar indikator update real-time
  // tanpa membebani database dengan write berlebih.
  const refreshPercent = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      const seconds = Math.floor(p.getCurrentTime());
      const duration = p.getDuration?.() ?? 0;
      if (duration > 0) {
        setWatchedPercent(Math.min(100, Math.round((seconds / duration) * 100)));
      }
    } catch (_) { /* player may already be destroyed */ }
  }, []);

  // ── Helper: flush current position to DB + hitung persentase tonton ──
  // Dipanggil tiap 15 detik (interval) dan saat user pause.
  const flushProgress = useCallback(() => {
    const p = playerRef.current;
    if (!p || !userId || !classId) return;
    try {
      const seconds = Math.floor(p.getCurrentTime());
      const duration = p.getDuration?.() ?? 0;
      if (duration > 0) {
        setWatchedPercent(Math.min(100, Math.round((seconds / duration) * 100)));
      }
      if (seconds > 0) {
        saveVideoWatchProgress({
          userId,
          classId,
          videoIndex: currentIndexRef.current,
          positionSeconds: seconds,
        });
      }
    } catch (_) { /* player may already be destroyed */ }
  }, [userId, classId]);

  // ── STEP 2: buat player video TUNGGAL sekali videoIds & saved progress siap ──
  // Autoplay MATI secara eksplisit (autoplay: 0) dan tidak ada pemanggilan
  // playVideo() otomatis di manapun — video hanya mulai saat user klik tombol
  // play sendiri di player YouTube.
  useEffect(() => {
    if (!videoIds || videoIds.length === 0 || !ytApiReady || isProgressLoading || playerRef.current) {
      return;
    }

    let initialIndex = 0;
    let resumeSeconds = 0;
    if (savedProgress && savedProgress.videoIndex >= 0 && savedProgress.videoIndex < videoIds.length) {
      initialIndex = savedProgress.videoIndex;
      resumeSeconds = savedProgress.positionSeconds;
    }

    currentIndexRef.current = initialIndex;
    skipNextNavRef.current = true; // hindari efek navigasi ganda saat state ini di-set
    setCurrentIndex(initialIndex);

    const videoId = videoIds[initialIndex];
    const player = new window.YT.Player('yt-video-container', {
      videoId,
      playerVars: {
        autoplay: 0,
        rel: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        fs: 1,
        playsinline: 1,
        ...(resumeSeconds > 0 ? { start: resumeSeconds } : {}),
      },
      events: {
        onReady: () => {
          if (resumeSeconds > 0) {
            toast.info(getResumeLabel(resumeSeconds), { duration: 4000 });
          }
        },
        onStateChange: (event: { target: any; data: number }) => {
          if (event.data === 0 && userId && classId) {
            // ENDED: tandai pertemuan ini selesai secara otomatis
            markVideoCompletedMutation.mutate({
              userId,
              classId,
              videoIndex: currentIndexRef.current,
            });
          } else if (event.data === 2) {
            // PAUSED: flush ke DB sekaligus update persentase
            flushProgress();
          } else if (event.data === 3) {
            // BUFFERING (termasuk saat user seek): update persentase saja,
            // TIDAK menulis ke DB agar tidak membebani dengan write berlebih
            refreshPercent();
          }
        },
      },
    });

    playerRef.current = player;
    saveIntervalRef.current = setInterval(flushProgress, 15_000);

    return () => {
      flushProgress(); // save on unmount / re-init
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
      try {
        player.destroy();
      } catch (_) { /* noop */ }
      playerRef.current = null;
    };
  }, [videoIds, ytApiReady, isProgressLoading, savedProgress, flushProgress]);

  // ── STEP 3: pindah video saat user klik Sebelumnya/Selanjutnya/Daftar Materi ──
  // cueVideoById() memuat video BARU tanpa langsung memutar (bukan playVideo()),
  // jadi navigasi antar video juga tidak memicu autoplay.
  useEffect(() => {
    if (currentIndex === null) return;
    if (skipNextNavRef.current) {
      skipNextNavRef.current = false;
      currentIndexRef.current = currentIndex;
      return;
    }
    if (!playerRef.current || !videoIds) return;
    const videoId = videoIds[currentIndex];
    if (!videoId) return;

    flushProgress(); // simpan posisi video sebelumnya sebelum berpindah
    setWatchedPercent(0); // reset indikator agar tidak nyangkut di video sebelumnya
    try {
      playerRef.current.cueVideoById(videoId, 0);
    } catch (_) { /* noop */ }
    currentIndexRef.current = currentIndex;
  }, [currentIndex, videoIds, flushProgress]);

  const goToIndex = useCallback(
    (i: number) => {
      if (!videoIds || i < 0 || i >= videoIds.length) return;
      setCurrentIndex(i);
    },
    [videoIds],
  );

  // ── Status "Kelas Selesai" — sumber kebenaran dari data enrollment server ──
  // (bukan dari mutation.isSuccess semata, supaya tidak reset ke "belum selesai"
  // saat halaman di-remount / keluar-masuk halaman)
  const [optimisticDone, setOptimisticDone] = useState(false);
  const isCompleted = initialIsCompleted || optimisticDone;

  const { mutate: completeEnrollmentMutate, isPending: isCompleting } = useMutation({
    mutationFn: () => completeEnrollmentFn({ userId, classId, enrollmentId }),
    onSuccess: () => {
      setOptimisticDone(true);
      queryClient.invalidateQueries({ queryKey: ['enrollments', userId] });
      queryClient.invalidateQueries({ queryKey: ['progress', userId, classId] });
      queryClient.invalidateQueries({ queryKey: ['my-classes'] });
      toast.success('Kelas berhasil ditandai selesai! Sertifikat siap diterbitkan.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan, coba lagi.');
    },
  });

  const markVideoCompletedMutation = useMutation({
    mutationFn: markVideoCompleted,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-completions', userId, classId] });
    },
  });

  const { data: categoryClasses = [] } = useQuery({
    queryKey: ['classes', { category: classCategory }],
    queryFn: () => listClasses(classCategory ? { category: classCategory } : undefined),
    enabled: !!classCategory,
  });
  const relatedClasses = categoryClasses.filter((c) => c.id !== classId).slice(0, 3);

  // Progress bar sidebar kiri — persentase pertemuan yang sudah selesai ditonton
  const playlistProgressPct =
    videoIds && videoIds.length > 0
      ? Math.round((completedIndexes.size / videoIds.length) * 100)
      : isCompleted
      ? 100
      : 0;

  // ── Kartu pengajar + fasilitas: dipakai ulang di desktop sidebar kanan & mobile ──
  const InstructorCard = () => (
    <div className="bg-card rounded-2xl border p-5 space-y-3">
      <p className="text-sm font-semibold text-foreground">Tentang Pengajar</p>
      <div className="flex items-start gap-3">
        <Avatar className="w-12 h-12 shrink-0">
          <AvatarImage src={instructorPhotoUrl} alt={instructorName} />
          <AvatarFallback className="bg-primary/10 text-primary font-bold">
            {instructorName.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{instructorName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{instructorClassCount} kelas</p>
          {instructorBio && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{instructorBio}</p>
          )}
        </div>
      </div>
      <div className="pt-2 border-t mt-2 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <StarRating rating={instructorRatingData.average} size="sm" />
          <span className="text-xs text-muted-foreground">
            {instructorRatingData.average > 0
              ? `${instructorRatingData.average} (${instructorRatingData.count} rating)`
              : 'Belum ada rating'}
          </span>
        </div>
        {isEnrolled && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Rating kamu:</span>
            <StarRating
              rating={instructorRatingData.myRating ?? 0}
              size="sm"
              interactive
              onChange={(r) =>
                submitInstructorRatingMutation.mutate({ instructorId, classId, rating: r })
              }
            />
          </div>
        )}
      </div>
    </div>
  );

  // ── Prompt 131: card "Kelas Saya" + progress + Daftar Pertemuan — dipakai
  //    ulang di kolom kanan sticky (desktop) & kolom kiri (mobile, di bawah
  //    card video). Styling & fungsi navigasi SAMA seperti sebelumnya
  //    (Prompt 107/122), cuma posisinya yang berpindah. ──
  const DaftarPertemuanCard = () => (
    <div className="bg-card rounded-2xl border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b space-y-3 bg-card">
        <Link
          href="/my-classes"
          className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Kelas Saya
        </Link>
        <h2 className="font-serif text-sm font-bold text-foreground line-clamp-2 leading-snug">
          {classTitle}
        </h2>
        {/* Progress bar — pakai data completedIndexes dari Prompt 107 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress belajar</span>
            <span className="font-bold text-primary">{playlistProgressPct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${playlistProgressPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {completedIndexes.size} dari {videoIds?.length ?? '…'} pertemuan selesai
          </p>
        </div>
      </div>

      {/* Daftar pertemuan (scrollable) — ikon & styling identik dengan dars Modul/Bab */}
      <nav className="max-h-[420px] lg:max-h-[calc(100vh-22rem)] overflow-y-auto py-2">
        {!videoIds && !metaError && (
          <div className="flex items-center gap-3 px-4 py-3 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Memuat daftar video...
          </div>
        )}
        {metaError && (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            Gagal memuat daftar video.
          </p>
        )}
        {videoIds &&
          videoIds.map((_, i) => {
            const isActive = i === currentIndex;
            const isDone = completedIndexes.has(i);
            return (
              <div key={i}>
                <button
                  onClick={() => goToIndex(i)}
                  className={`w-full flex items-start gap-3 px-5 py-2.5 text-left text-sm transition-colors duration-150 ${
                    isActive
                      ? 'bg-primary/10 border-l-2 border-primary'
                      : 'hover:bg-muted/40 border-l-2 border-transparent'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {isActive ? (
                      <PlayCircle className="w-4 h-4 text-primary" fill="currentColor" />
                    ) : isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground/40" />
                    )}
                  </div>
                  <p
                    className={`leading-snug flex-1 min-w-0 ${
                      isActive
                        ? 'font-semibold text-primary'
                        : isDone
                        ? 'text-foreground/80'
                        : 'text-foreground/70'
                    }`}
                  >
                    {meetingTitles.get(i)?.title || `Pertemuan ke-${i + 1}`}
                  </p>
                </button>
              </div>
            );
          })}
      </nav>
    </div>
  );

  const KelasLainnyaSection = () =>
    classCategory && relatedClasses.length > 0 ? (
      <div className="bg-card rounded-2xl border p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground">
          Kelas Lainnya{classCategory ? `: ${classCategory}` : ''}
        </p>
        <div className="space-y-3">
          {relatedClasses.map((cls) => (
            <Link key={cls.id} href={`/class/${cls.id}`} className="flex items-start gap-3 group">
              <img
                src={cls.coverImage}
                alt={cls.title}
                className="w-16 h-11 rounded-lg object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                  {cls.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatPrice(cls.discountPrice ?? cls.basePrice)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <AppShell>
      {/* ── Prompt 131: layout 2 kolom — GANTI grid 3 kolom Prompt 128.
          Kolom KIRI (lebar, flex-1): video+breadcrumb+judul+deskripsi+tombol
          selesai jadi 1 card menyatu, lalu di bawahnya card "Tentang
          Pengajar" yang diperluas (rating pengajar + Review & Komentar).
          Kolom KANAN (sempit, w-80/xl:w-96, sticky): card "Kelas Saya" +
          Daftar Pertemuan, lalu di bawahnya "Kelas Lainnya".
          Mobile: stack vertikal — video dulu, lalu breadcrumb+judul+tombol
          selesai, lalu Daftar Pertemuan, lalu Tentang Pengajar+Review, lalu
          Kelas Lainnya paling bawah (diatur lewat urutan DOM + `lg:order-*`). */}
      <div className="flex-1 container mx-auto px-4 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Kolom kiri (lebar) ────────────────────────────────────────────
              Satu flex-col tunggal — urutan mobile diatur SELURUHNYA lewat
              class `order-*` di sini (termasuk "Kelas Lainnya" di order-5),
              bukan lewat container terpisah, supaya sesuai spesifikasi. */}
          <div className="flex-1 min-w-0 flex flex-col gap-6">
            {/* Video + breadcrumb pertemuan + judul + deskripsi + tombol
                "Tandai Kelas Selesai" — 1 card menyatu (order-1, paling atas
                di mobile juga karena video paling penting dilihat duluan). */}
            <div className="order-1 bg-card rounded-2xl border overflow-hidden">
              <div className="w-full aspect-video overflow-hidden bg-black relative">
                {metaError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-400 px-6 text-center">
                    <Video className="w-12 h-12 opacity-30" />
                    <p className="text-sm font-medium opacity-60">
                      Gagal memuat video. Silakan reload halaman.
                    </p>
                  </div>
                ) : (
                  <div id="yt-video-container" className="w-full h-full" />
                )}
              </div>
              {/* Player tersembunyi, dipakai sekali membaca daftar video lewat getPlaylist() */}
              <div id="yt-meta-container" className="sr-only" aria-hidden="true" />

              <div className="p-6 space-y-4">
                {/* Breadcrumb pertemuan + tombol navigasi */}
                {videoIds && videoIds.length > 0 && currentIndex !== null && (
                  <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b">
                    <div>
                      <p className="text-xs font-medium text-primary uppercase tracking-wide">
                        Pertemuan ke-{currentIndex + 1} dari {videoIds.length}
                      </p>
                      <h2 className="font-serif text-lg font-bold text-foreground mt-0.5">
                        {meetingTitles.get(currentIndex)?.title || `Pertemuan ke-${currentIndex + 1}`}
                      </h2>
                      {meetingTitles.get(currentIndex)?.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {meetingTitles.get(currentIndex)?.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentIndex <= 0}
                        onClick={() => goToIndex(currentIndex - 1)}
                        className="gap-1"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Sebelumnya
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentIndex >= videoIds.length - 1}
                        onClick={() => goToIndex(currentIndex + 1)}
                        className="gap-1"
                      >
                        Selanjutnya
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Judul kelas, deskripsi, tombol "Tandai Kelas Selesai" */}
                <div className="space-y-1">
                  <h1 className="font-serif text-2xl font-bold text-foreground leading-snug">
                    {classTitle}
                  </h1>
                  <p className="text-sm text-muted-foreground">{instructorName}</p>
                  {watchedPercent > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Progres menonton</span>
                        <span className="font-medium">{watchedPercent}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${watchedPercent}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {classDescription && (
                    <p className="text-sm text-muted-foreground leading-relaxed pt-1">
                      {classDescription}
                    </p>
                  )}
                </div>

                {isCompleted ? (
                  <div className="inline-flex items-center gap-2 rounded-lg bg-success-pale border border-success-pale px-4 py-3">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                    >
                      <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                    </motion.div>
                    <span className="font-semibold text-success">Kelas telah ditandai selesai</span>
                  </div>
                ) : (
                  <motion.div
                    className="inline-block"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Button
                      size="lg"
                      onClick={() => completeEnrollmentMutate()}
                      disabled={isCompleting || !userId}
                      className="gap-2"
                    >
                      {isCompleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Tandai Kelas Selesai
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Daftar Pertemuan — di mobile tampil SETELAH card video (order-2) */}
            <div className="order-2 lg:hidden">
              <DaftarPertemuanCard />
            </div>

            {/* Fasilitas Kelas — di mobile tampil LANGSUNG DI BAWAH Daftar Pertemuan (order-2) */}
            {(gdriveMateriUrl || waGroupUrl || soalLatihanUrl || ebookUrl || testimoniFormUrl) && (
              <div className="order-2 bg-card rounded-2xl border overflow-hidden lg:hidden">
                <FacilitasCard
                  gdriveMateriUrl={gdriveMateriUrl}
                  waGroupUrl={waGroupUrl}
                  soalLatihanUrl={soalLatihanUrl}
                  ebookUrl={ebookUrl}
                  testimoniFormUrl={testimoniFormUrl}
                />
              </div>
            )}

            {/* Tentang Pengajar & Review — order-3 */}
            <div className="order-3 bg-card rounded-2xl border p-5 space-y-6">
              <InstructorCard />
              <div className="pt-2 border-t">
                <ClassReviewSection classId={classId} currentUserId={userId} variant="card" />
              </div>
            </div>

            <div className="order-4">
              <CertificateSection classId={classId} classTitle={classTitle} isClassCompleted={isCompleted} />
            </div>

            {/* "Kelas Lainnya" — paling bawah di mobile (order-5, bagian dari
                stack tunggal kolom kiri). Di desktop disembunyikan di sini
                (`lg:hidden`) karena sudah dirender ulang di kolom kanan
                sticky di bawah. */}
            <div className="order-5 lg:hidden">
              <KelasLainnyaSection />
            </div>
          </div>

          {/* ── Kolom kanan (sempit, mengikuti scroll halaman) ─────────────────
              Hanya tampil sebagai kolom terpisah di desktop (`lg:flex`); di
              mobile kontennya sudah dirender di stack kolom kiri di atas. */}
          <aside className="hidden lg:flex lg:flex-col gap-6 w-full lg:w-80 xl:w-96 shrink-0">
            <DaftarPertemuanCard />
            {(gdriveMateriUrl || waGroupUrl || soalLatihanUrl || ebookUrl || testimoniFormUrl) && (
              <div className="bg-card rounded-2xl border overflow-hidden">
                <FacilitasCard
                  gdriveMateriUrl={gdriveMateriUrl}
                  waGroupUrl={waGroupUrl}
                  soalLatihanUrl={soalLatihanUrl}
                  ebookUrl={ebookUrl}
                  testimoniFormUrl={testimoniFormUrl}
                />
              </div>
            )}
            <KelasLainnyaSection />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({
  modules,
  classTitle,
  activeDarsId,
  completedIds,
  progressPct,
  onSelectDars,
}: {
  modules: ClassDarsModule[];
  classTitle: string;
  activeDarsId: string;
  completedIds: Set<string>;
  progressPct: number;
  onSelectDars: (id: string) => void;
}) {
  const activeModuleId = useMemo(() => {
    for (const m of modules) {
      if (m.dars.some((d) => d.id === activeDarsId)) return m.id;
    }
    return modules[0]?.id ?? '';
  }, [activeDarsId, modules]);

  const [openModules, setOpenModules] = useState<Set<string>>(
    () => new Set([activeModuleId])
  );

  const toggleModule = (id: string) =>
    setOpenModules((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const totalDars = modules.reduce((s, m) => s + m.dars.length, 0);

  return (
    <aside className="w-full lg:w-80 xl:w-96 shrink-0 border-r bg-card flex flex-col lg:h-[calc(100vh-4rem)] lg:sticky lg:top-16 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b space-y-3 bg-card">
        <Link
          href="/my-classes"
          className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Kelas Saya
        </Link>
        <div>
          <h2 className="font-serif text-sm font-bold text-foreground line-clamp-2 leading-snug">
            {classTitle}
          </h2>
        </div>
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress belajar</span>
            <span className="font-bold text-primary">{progressPct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {completedIds.size} dari {totalDars} pelajaran selesai
          </p>
        </div>
      </div>

      {/* Module list (scrollable) */}
      <nav className="flex-1 overflow-y-auto py-2">
        {modules.map((mod) => {
          const isOpen = openModules.has(mod.id);
          const modCompleted = mod.dars.filter((d) => completedIds.has(d.id)).length;

          return (
            <div key={mod.id}>
              <button
                onClick={() => toggleModule(mod.id)}
                className="w-full flex items-start gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors duration-150 group"
              >
                <div className="shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold mt-0.5">
                  {mod.orderIndex}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {mod.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {modCompleted}/{mod.dars.length} selesai
                  </p>
                </div>
                <div className="shrink-0 text-muted-foreground mt-0.5">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isOpen && (
                <ul className="pb-1">
                  {mod.dars.map((dars) => {
                    const isActive = dars.id === activeDarsId;
                    const isDone = completedIds.has(dars.id);
                    return (
                      <li key={dars.id}>
                        <button
                          onClick={() => onSelectDars(dars.id)}
                          className={`w-full flex items-start gap-3 px-5 py-2.5 text-left text-sm transition-colors duration-150 ${
                            isActive
                              ? 'bg-primary/10 border-l-2 border-primary'
                              : 'hover:bg-muted/40 border-l-2 border-transparent'
                          }`}
                        >
                          <div className="shrink-0 mt-0.5">
                            {isActive ? (
                              <PlayCircle className="w-4 h-4 text-primary" fill="currentColor" />
                            ) : isDone ? (
                              <CheckCircle2 className="w-4 h-4 text-success" />
                            ) : (
                              <Circle className="w-4 h-4 text-muted-foreground/40" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`leading-snug line-clamp-2 ${
                                isActive
                                  ? 'font-semibold text-primary'
                                  : isDone
                                  ? 'text-foreground/80'
                                  : 'text-foreground/70'
                              }`}
                            >
                              {dars.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {dars.durationMinutes ?? '-'} menit
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

// ── Main Content Area ─────────────────────────────────────────────────────────
function LearnContent() {
  const { classId } = useParams<{ classId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: classDetail, isLoading: isLoadingClass } = useQuery({
    queryKey: ['class', classId],
    queryFn: () => getClassById(classId!),
    enabled: !!classId,
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (classDetail) {
      const targetPath = `/belajar/${classDetail.slug}`;
      if (window.location.pathname !== targetPath && (window.location.pathname.startsWith('/learn/') || classId !== classDetail.slug)) {
        window.history.replaceState(null, '', targetPath);
      }
    }
  }, [classDetail, classId]);

  // modules langsung dari classDetail — tidak perlu query terpisah
  const modules = classDetail?.modules ?? [];

  const { data: progressItems = [], isLoading: isLoadingProgress } = useQuery({
    queryKey: ['progress', user?.id, classId],
    queryFn: () => listProgress(user!.id, classId!),
    enabled: !!user?.id && !!classId,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['enrollments', user?.id],
    queryFn: () => listEnrollments(user!.id),
    enabled: !!user?.id,
  });

  const { mutate: updateProgressMutate, isPending: isUpdating } = useMutation({
    mutationFn: updateProgressFn,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan, coba lagi.');
    },
  });

  // ── Rating pengajar — untuk sidebar kanan mode Modul/Bab ─────────────────
  const { data: moduleInstructorRating = { average: 0, count: 0, myRating: null } } = useQuery({
    queryKey: ['instructor-rating', classDetail?.instructor?.id, classId, user?.id],
    queryFn: () =>
      getInstructorRatingForClass(user!.id, classDetail!.instructor.id, classId!),
    enabled: !!classDetail?.instructor?.id && !!classId && !!user?.id,
  });

  const submitModuleInstructorRating = useMutation({
    mutationFn: (params: { instructorId: string; classId: string; rating: number }) =>
      submitInstructorRating(params),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['instructor-rating', classDetail?.instructor?.id, classId, user?.id],
      });
      toast.success('Rating pengajar tersimpan');
    },
    onError: (err: any) => {
      toast.error(err?.message ?? 'Gagal menyimpan rating pengajar');
    },
  });

  const isLoading = isLoadingClass || isLoadingProgress;

  // Build Set<darsId> from progress API response
  const completedIds = useMemo(
    () => new Set(progressItems.filter((p) => p.isCompleted).map((p) => p.darsId)),
    [progressItems],
  );

  const allDars = useMemo(() => flattenDars(modules), [modules]);
  const totalDars = allDars.length;
  const progressPct = totalDars > 0 ? Math.round((completedIds.size / totalDars) * 100) : 0;

  // Default: first incomplete dars
  const [activeDarsId, setActiveDarsId] = useState<string>(() => {
    return allDars.find((e) => !completedIds.has(e.dars.id))?.dars.id ?? allDars[0]?.dars.id ?? '';
  });

  // When modules load, set activeDarsId if still empty
  const resolvedActiveDarsId =
    activeDarsId || allDars.find((e) => !completedIds.has(e.dars.id))?.dars.id || allDars[0]?.dars.id || '';

  const activeEntry = useMemo(
    () => allDars.find((e) => e.dars.id === resolvedActiveDarsId),
    [allDars, resolvedActiveDarsId],
  );
  const activeIndex = useMemo(
    () => allDars.findIndex((e) => e.dars.id === resolvedActiveDarsId),
    [allDars, resolvedActiveDarsId],
  );
  const prevEntry = activeIndex > 0 ? allDars[activeIndex - 1] : null;
  const nextEntry = activeIndex < allDars.length - 1 ? allDars[activeIndex + 1] : null;
  const isDone = completedIds.has(resolvedActiveDarsId);

  const invalidateProgress = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ['progress', user?.id, classId],
    });
  }, [queryClient, user?.id, classId]);

  const enrollment = useMemo(
    () => enrollments.find((e) => e.class.id === classId) ?? null,
    [enrollments, classId],
  );

  const isNormalClassCompleted =
    (enrollment?.isCompleted ?? false) ||
    (totalDars > 0 && completedIds.size === totalDars);

  const handleMarkDone = useCallback(() => {
    if (!user?.id || !resolvedActiveDarsId) return;
    updateProgressMutate(
      { userId: user.id, darsId: resolvedActiveDarsId, isCompleted: true },
      {
        onSuccess: () => {
          invalidateProgress();
          // Jika ini dars terakhir yang diselesaikan, otomatis tandai kelas selesai
          if (totalDars > 0 && completedIds.size + 1 >= totalDars) {
            completeEnrollmentFn({ userId: user.id, classId: classId!, enrollmentId: enrollment?.id });
            queryClient.invalidateQueries({ queryKey: ['enrollments', user.id] });
          }
          if (nextEntry) setTimeout(() => setActiveDarsId(nextEntry.dars.id), 400);
        },
      },
    );
  }, [user?.id, resolvedActiveDarsId, updateProgressMutate, invalidateProgress, nextEntry, totalDars, completedIds.size, classId, enrollment, queryClient]);

  const handleUnmarkDone = useCallback(() => {
    if (!user?.id || !resolvedActiveDarsId) return;
    updateProgressMutate(
      { userId: user.id, darsId: resolvedActiveDarsId, isCompleted: false },
      { onSuccess: invalidateProgress },
    );
  }, [user?.id, resolvedActiveDarsId, updateProgressMutate, invalidateProgress]);

  if (isLoadingClass && !classDetail) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  if (!classDetail) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center flex-col gap-4 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground" />
          <h1 className="font-serif text-2xl font-bold">Kelas tidak ditemukan</h1>
          <motion.div
            className="inline-block"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            <Button asChild>
              <Link href="/my-classes">Kembali ke Kelas Saya</Link>
            </Button>
          </motion.div>
        </div>
      </AppShell>
    );
  }

  // ── Playlist mode: class has a YouTube playlist but no module/dars data ──────
  const isPlaylistMode = !!(classDetail.youtubePlaylistId && classDetail.modules.length === 0);

  if (isPlaylistMode) {
    const enrollment = enrollments.find((e) => e.class.id === classId) ?? null;
    return (
      <PlaylistMode
        key={classId}
        classId={classId!}
        classTitle={classDetail.title}
        classDescription={classDetail.description}
        classCategory={classDetail.category}
        instructorId={classDetail.instructor.id}
        instructorName={classDetail.instructor.name}
        instructorBio={classDetail.instructor.bio}
        instructorPhotoUrl={classDetail.instructor.photoUrl}
        instructorClassCount={classDetail.instructor.classCount}
        playlistId={classDetail.youtubePlaylistId!}
        enrollmentId={enrollment?.id ?? null}
        initialIsCompleted={enrollment?.isCompleted ?? false}
        userId={user?.id ?? ''}
        gdriveMateriUrl={classDetail.gdriveMateriUrl}
        waGroupUrl={classDetail.waGroupUrl}
        soalLatihanUrl={classDetail.soalLatihanUrl}
        ebookUrl={classDetail.ebookUrl}
        testimoniFormUrl={classDetail.testimoniFormUrl}
        reverseVideoOrder={classDetail.reverseVideoOrder}
      />
    );
  }

  // ── No content: kelas sudah published tapi belum ada modul/dars maupun playlist ──
  const hasNoContent = !classDetail.youtubePlaylistId && classDetail.modules.length === 0;

  if (hasNoContent) {
    return (
      <AppShell>
        <div className="flex-1 flex items-center justify-center flex-col gap-4 text-center px-4 py-16">
          <BookOpen className="w-12 h-12 text-muted-foreground" />
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Materi Belum Tersedia
            </h1>
            <p className="text-muted-foreground mt-2 max-w-md">
              Kelas &ldquo;{classDetail.title}&rdquo; sudah bisa kamu akses, tapi materinya
              sedang disiapkan oleh pengajar. Kami akan kabari begitu materi
              sudah bisa ditonton.
            </p>
          </div>
          <motion.div
            className="inline-block"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            <Button asChild variant="outline">
              <Link href="/my-classes">Kembali ke Kelas Saya</Link>
            </Button>
          </motion.div>
        </div>
      </AppShell>
    );
  }

  // ── Normal mode: existing modul/dars breakdown ────────────────────────────────
  return (
    <AppShell>
      <SEO title={classDetail ? `Belajar: ${classDetail.title}` : 'Belajar'} />
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Sidebar — di desktop tampil di kiri, di mobile tampil di bawah konten */}
        <div className="order-2 lg:order-1 w-full lg:w-auto">
          <Sidebar
            modules={modules}
            classTitle={classDetail.title}
            activeDarsId={resolvedActiveDarsId}
            completedIds={completedIds}
            progressPct={progressPct}
            onSelectDars={setActiveDarsId}
          />
        </div>

        {/* Main: Player + Info */}
        <main className="order-1 lg:order-2 flex-1 min-w-0 flex flex-col">
          {/* Video Player atau Placeholder */}
          {activeEntry && (
            activeEntry.dars.youtubeVideoId ? (
              <DarsVideoPlayer
                key={resolvedActiveDarsId}
                youtubeVideoId={activeEntry.dars.youtubeVideoId}
                darsIndex={activeIndex}
                classId={classId!}
                userId={user?.id ?? ''}
                onVideoEnded={handleMarkDone}
              />
            ) : (
              <VideoPlaceholder title={activeEntry.dars.title} />
            )
          )}

          {/* Info & Controls */}
          <div className="flex-1 p-6 lg:p-8 max-w-3xl space-y-5">
            {/* Breadcrumb */}
            {activeEntry && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs font-medium">
                  Modul {activeEntry.module.orderIndex}
                </Badge>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  Pelajaran {activeEntry.dars.orderIndex}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {activeEntry.dars.durationMinutes ?? '-'} menit
                </span>
              </div>
            )}

            {/* Title */}
            <motion.h1
              key={resolvedActiveDarsId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="font-serif text-2xl lg:text-3xl font-bold text-foreground leading-snug"
            >
              {activeEntry?.dars.title ?? ''}
            </motion.h1>

            <p className="text-muted-foreground leading-relaxed text-sm lg:text-base">
              Bismillah. Pada pelajaran ini Ustadz akan membahas{' '}
              <span className="lowercase">{activeEntry?.dars.title}</span> secara mendalam
              disertai dalil-dalil yang shahih dan contoh praktis.
            </p>

            {/* Mark Done + Nav */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2">
              {isDone ? (
                <div className="flex items-center gap-2">
                  <AnimatePresence>
                    <motion.div
                      key="done-badge"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                      className="flex items-center gap-2 rounded-lg bg-success-pale border border-success-pale px-4 py-2.5"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 10, delay: 0.05 }}
                      >
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      </motion.div>
                      <span className="text-sm font-semibold text-success">Sudah Selesai</span>
                    </motion.div>
                  </AnimatePresence>
                  <motion.div
                    className="inline-block"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleUnmarkDone}
                      disabled={isUpdating}
                      className="text-muted-foreground hover:text-foreground gap-1.5 text-xs"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Tandai Belum
                    </Button>
                  </motion.div>
                </div>
              ) : (
                <motion.div
                  className="inline-block"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                >
                  <Button onClick={handleMarkDone} disabled={isUpdating} className="gap-2">
                    {isUpdating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Tandai Selesai
                  </Button>
                </motion.div>
              )}

              {/* Prev / Next */}
              <div className="flex items-center gap-2 sm:ml-auto">
                <motion.div
                  className="inline-block"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!prevEntry}
                    onClick={() => prevEntry && setActiveDarsId(prevEntry.dars.id)}
                    className="gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Sebelumnya
                  </Button>
                </motion.div>
                <motion.div
                  className="inline-block"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!nextEntry}
                    onClick={() => nextEntry && setActiveDarsId(nextEntry.dars.id)}
                    className="gap-1"
                  >
                    Selanjutnya
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </motion.div>
              </div>
            </div>

            {/* Mini nav — dars in current module */}
            {activeEntry && (
              <div className="pt-4 border-t">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Pelajaran dalam {activeEntry.module.title}
                </p>
                <ul className="space-y-1">
                  {activeEntry.module.dars.map((d) => {
                    const isThis = d.id === resolvedActiveDarsId;
                    const done = completedIds.has(d.id);
                    return (
                      <li key={d.id}>
                        <button
                          onClick={() => setActiveDarsId(d.id)}
                          className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                            isThis
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'hover:bg-muted/50 text-foreground/70'
                          }`}
                        >
                          {done ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                          ) : isThis ? (
                            <PlayCircle className="w-3.5 h-3.5 shrink-0" fill="currentColor" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 shrink-0 text-muted-foreground/40" />
                          )}
                          <span className="flex-1 line-clamp-1">{d.title}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {d.durationMinutes ?? '-'} mnt
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Fasilitas Kelas — mobile only (di bawah urutan pertemuan) */}
            {(classDetail.gdriveMateriUrl || classDetail.waGroupUrl || classDetail.soalLatihanUrl || classDetail.ebookUrl || classDetail.testimoniFormUrl) && (
              <div className="pt-4 border-t lg:hidden">
                <FacilitasCard
                  gdriveMateriUrl={classDetail.gdriveMateriUrl}
                  waGroupUrl={classDetail.waGroupUrl}
                  soalLatihanUrl={classDetail.soalLatihanUrl}
                  ebookUrl={classDetail.ebookUrl}
                  testimoniFormUrl={classDetail.testimoniFormUrl}
                />
              </div>
            )}

            {/* Sertifikat — mobile only */}
            <div className="lg:hidden">
              <CertificateSection
                classId={classId}
                classTitle={classDetail.title}
                isClassCompleted={isNormalClassCompleted}
              />
            </div>

            {/* Mobile: Tentang Pengajar (desktop: tampil di sidebar kanan) */}
            <div className="pt-4 border-t lg:hidden">
              <div className="bg-card rounded-2xl border p-5 space-y-3">
                <p className="text-sm font-semibold text-foreground">Tentang Pengajar</p>
                <div className="flex items-start gap-3">
                  <Avatar className="w-12 h-12 shrink-0">
                    <AvatarImage src={classDetail.instructor.photoUrl} alt={classDetail.instructor.name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                      {classDetail.instructor.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{classDetail.instructor.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{classDetail.instructor.classCount} kelas</p>
                    {classDetail.instructor.bio && (
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{classDetail.instructor.bio}</p>
                    )}
                  </div>
                </div>
                <div className="pt-2 border-t mt-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <StarRating rating={moduleInstructorRating.average} size="sm" />
                    <span className="text-xs text-muted-foreground">
                      {moduleInstructorRating.average > 0
                        ? `${moduleInstructorRating.average} (${moduleInstructorRating.count} rating)`
                        : 'Belum ada rating'}
                    </span>
                  </div>
                  {enrollments.some((e) => e.class.id === classId) && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Rating kamu:</span>
                      <StarRating
                        rating={moduleInstructorRating.myRating ?? 0}
                        size="sm"
                        interactive
                        onChange={(r) =>
                          submitModuleInstructorRating.mutate({
                            instructorId: classDetail.instructor.id,
                            classId: classId!,
                            rating: r,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ── Sidebar kanan (desktop only): Tentang Pengajar + Fasilitas ─────── */}
        <aside className="hidden lg:flex flex-col gap-4 w-[320px] shrink-0 p-4 py-6">
          {/* Card: Tentang Pengajar */}
          <div className="bg-card rounded-2xl border p-5 space-y-3">
            <p className="text-sm font-semibold text-foreground">Tentang Pengajar</p>
            <div className="flex items-start gap-3">
              <Avatar className="w-12 h-12 shrink-0">
                <AvatarImage src={classDetail.instructor.photoUrl} alt={classDetail.instructor.name} />
                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                  {classDetail.instructor.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{classDetail.instructor.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{classDetail.instructor.classCount} kelas</p>
                {classDetail.instructor.bio && (
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{classDetail.instructor.bio}</p>
                )}
              </div>
            </div>
            <div className="pt-2 border-t mt-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <StarRating rating={moduleInstructorRating.average} size="sm" />
                <span className="text-xs text-muted-foreground">
                  {moduleInstructorRating.average > 0
                    ? `${moduleInstructorRating.average} (${moduleInstructorRating.count} rating)`
                    : 'Belum ada rating'}
                </span>
              </div>
              {enrollments.some((e) => e.class.id === classId) && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Rating kamu:</span>
                  <StarRating
                    rating={moduleInstructorRating.myRating ?? 0}
                    size="sm"
                    interactive
                    onChange={(r) =>
                      submitModuleInstructorRating.mutate({
                        instructorId: classDetail.instructor.id,
                        classId: classId!,
                        rating: r,
                      })
                    }
                  />
                </div>
              )}
            </div>
          </div>

          {/* Card: Fasilitas Kelas */}
          {(classDetail.gdriveMateriUrl || classDetail.waGroupUrl || classDetail.soalLatihanUrl || classDetail.ebookUrl || classDetail.testimoniFormUrl) && (
            <div className="bg-card rounded-2xl border overflow-hidden">
              <FacilitasCard
                gdriveMateriUrl={classDetail.gdriveMateriUrl}
                waGroupUrl={classDetail.waGroupUrl}
                soalLatihanUrl={classDetail.soalLatihanUrl}
                ebookUrl={classDetail.ebookUrl}
                testimoniFormUrl={classDetail.testimoniFormUrl}
              />
            </div>
          )}

          {/* Card: Sertifikat */}
          <CertificateSection
            classId={classId}
            classTitle={classDetail.title}
            isClassCompleted={isNormalClassCompleted}
          />
        </aside>
      </div>
    </AppShell>
  );
}

export default function LearnPage() {
  return (
    <ProtectedRoute>
      <LearnContent />
    </ProtectedRoute>
  );
}
