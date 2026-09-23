import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Gauge, Maximize, Minimize, Pause, Play, RotateCcw, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Protected Video Frame ─────────────────────────────────────────────────────
// Bungkus player YouTube IFrame API dengan kontrol buatan sendiri.
// Iframe YouTube dibuat `pointer-events: none` dan ditutup layer transparan,
// jadi judul video, tombol Share / Watch Later, logo "YouTube", video terkait,
// dan menu klik-kanan ("Salin URL video") tidak bisa diklik penonton.
// Semua kontrol (play, ±10 detik, kecepatan, fullscreen) ada di layer ini.
//
// Pemilih kualitas sengaja TIDAK ada: sejak 2019 YouTube mengabaikan
// setPlaybackQuality(), kualitas diatur otomatis sesuai ukuran player &
// koneksi (fullscreen biasanya naik ke HD).
//
// Player tetap dibuat oleh parent (new YT.Player(containerId, ...)) — parent
// wajib memakai YOUTUBE_PROTECTED_PLAYER_VARS supaya kontrol bawaan YouTube mati.

export const YOUTUBE_PROTECTED_PLAYER_VARS = {
  autoplay: 0,
  controls: 0,
  disablekb: 1,
  fs: 0,
  rel: 0,
  modestbranding: 1,
  iv_load_policy: 3,
  cc_load_policy: 0,
  playsinline: 1,
} as const;

const SEEK_STEP_SECONDS = 10;
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const CONTROLS_HIDE_DELAY_MS = 2500;

// YT.PlayerState
const STATE_ENDED = 0;
const STATE_PLAYING = 1;
const STATE_BUFFERING = 3;

function formatTime(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

export function ProtectedVideoFrame({
  containerId,
  playerRef,
  className,
}: {
  containerId: string;
  playerRef: MutableRefObject<any>;
  className?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [playerState, setPlayerState] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  // Fallback untuk browser tanpa Fullscreen API di elemen biasa (iPhone Safari)
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [seekFlash, setSeekFlash] = useState<{ dir: -1 | 1; key: number } | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desiredSpeedRef = useRef(1);

  const isPlaying = playerState === STATE_PLAYING || playerState === STATE_BUFFERING;
  const isFullscreen = isNativeFullscreen || isPseudoFullscreen;

  // ── Baca status player secara berkala (player dibuat & diganti oleh parent) ──
  useEffect(() => {
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p?.getPlayerState) return;
      try {
        const state = p.getPlayerState();
        setPlayerState(state);
        setCurrentTime(p.getCurrentTime?.() ?? 0);
        setDuration(p.getDuration?.() ?? 0);
        // cueVideoById (pindah pertemuan) bisa me-reset kecepatan ke 1x
        if (state === STATE_PLAYING && p.getPlaybackRate?.() !== desiredSpeedRef.current) {
          p.setPlaybackRate?.(desiredSpeedRef.current);
        }
      } catch (_) { /* player sedang dibuat ulang / sudah di-destroy */ }
    }, 250);
    return () => clearInterval(id);
  }, [playerRef]);

  // ── Kontrol otomatis sembunyi saat video berjalan ──
  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY_MS);
  }, []);

  useEffect(() => {
    if (!isPlaying || speedMenuOpen) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setControlsVisible(true);
    } else {
      revealControls();
    }
  }, [isPlaying, speedMenuOpen, revealControls]);

  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  // ── Aksi ──
  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (isPlaying) p.pauseVideo();
      else p.playVideo();
    } catch (_) { /* noop */ }
  }, [playerRef, isPlaying]);

  const seekBy = useCallback((delta: number) => {
    const p = playerRef.current;
    if (!p) return;
    try {
      const dur = p.getDuration?.() ?? 0;
      const next = Math.max(0, Math.min(dur > 0 ? dur - 0.5 : Infinity, p.getCurrentTime() + delta));
      p.seekTo(next, true);
      setCurrentTime(next);
      setSeekFlash({ dir: delta < 0 ? -1 : 1, key: Date.now() });
    } catch (_) { /* noop */ }
    revealControls();
  }, [playerRef, revealControls]);

  const seekTo = useCallback((seconds: number) => {
    try {
      playerRef.current?.seekTo(seconds, true);
      setCurrentTime(seconds);
    } catch (_) { /* noop */ }
  }, [playerRef]);

  const changeSpeed = useCallback((rate: number) => {
    desiredSpeedRef.current = rate;
    setSpeed(rate);
    setSpeedMenuOpen(false);
    try { playerRef.current?.setPlaybackRate(rate); } catch (_) { /* noop */ }
  }, [playerRef]);

  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current as FullscreenElement | null;
    const doc = document as FullscreenDocument;
    if (!el) return;

    if (isPseudoFullscreen) { setIsPseudoFullscreen(false); return; }
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      (doc.exitFullscreen ?? doc.webkitExitFullscreen)?.call(doc);
      return;
    }

    const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
    if (request) {
      Promise.resolve(request.call(el))
        .then(() => {
          // Di HP, putar layar ke landscape kalau browser mengizinkan
          (screen.orientation as any)?.lock?.('landscape')?.catch?.(() => {});
        })
        .catch(() => setIsPseudoFullscreen(true));
    } else {
      setIsPseudoFullscreen(true);
    }
  }, [isPseudoFullscreen]);

  useEffect(() => {
    const onChange = () => {
      const doc = document as FullscreenDocument;
      const active = doc.fullscreenElement ?? doc.webkitFullscreenElement;
      setIsNativeFullscreen(!!active && active === wrapperRef.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  // Esc untuk keluar dari fullscreen versi fallback
  useEffect(() => {
    if (!isPseudoFullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsPseudoFullscreen(false); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isPseudoFullscreen]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (key === ' ' || key === 'k') { e.preventDefault(); togglePlay(); revealControls(); }
    else if (key === 'arrowleft' || key === 'j') { e.preventDefault(); seekBy(-SEEK_STEP_SECONDS); }
    else if (key === 'arrowright' || key === 'l') { e.preventDefault(); seekBy(SEEK_STEP_SECONDS); }
    else if (key === 'f') { e.preventDefault(); toggleFullscreen(); }
  };

  // Klik area video: mouse → play/pause; sentuhan → tampil/sembunyikan kontrol
  const onSurfacePointerUp = (e: React.PointerEvent) => {
    if (speedMenuOpen) { setSpeedMenuOpen(false); return; }
    if (e.pointerType === 'mouse') {
      togglePlay();
      revealControls();
    } else if (controlsVisible && isPlaying) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setControlsVisible(false);
    } else {
      revealControls();
    }
  };

  const showChrome = controlsVisible || !isPlaying;
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={wrapperRef}
      tabIndex={0}
      role="region"
      aria-label="Pemutar video"
      onKeyDown={onKeyDown}
      onMouseMove={revealControls}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        'group/player relative w-full h-full bg-black overflow-hidden select-none outline-none focus-visible:ring-2 focus-visible:ring-primary',
        isPseudoFullscreen && 'fixed inset-0 z-[9999] h-[100dvh] w-screen',
        !showChrome && 'cursor-none',
        className,
      )}
    >
      {/* Iframe YouTube — tidak bisa disentuh sama sekali */}
      <div className="absolute inset-0 pointer-events-none [&_iframe]:w-full [&_iframe]:h-full">
        <div id={containerId} className="w-full h-full" />
      </div>

      {/* Tutupi judul YouTube di bagian atas saat video belum/tidak berjalan */}
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300',
          playerState === STATE_PLAYING && !showChrome ? 'opacity-0' : 'opacity-100',
        )}
      />

      {/* Layer penangkap klik (menggantikan semua interaksi ke iframe) */}
      <div className="absolute inset-0" onPointerUp={onSurfacePointerUp} />

      {/* Layar selesai — menutupi grid video terkait dari YouTube */}
      {playerState === STATE_ENDED && (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <button
            type="button"
            onClick={() => { seekTo(0); try { playerRef.current?.playVideo(); } catch (_) { /* noop */ } }}
            className="flex flex-col items-center gap-2 text-white/90 hover:text-white"
          >
            <RotateCcw className="w-10 h-10" />
            <span className="text-sm font-medium">Putar ulang</span>
          </button>
        </div>
      )}

      {/* Indikator lompat ±10 detik */}
      {seekFlash && (
        <div
          key={seekFlash.key}
          className={cn(
            'pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-white animate-out fade-out duration-700 fill-mode-forwards',
            seekFlash.dir < 0 ? 'left-[15%]' : 'right-[15%]',
          )}
          onAnimationEnd={() => setSeekFlash(null)}
        >
          {seekFlash.dir < 0 ? `−${SEEK_STEP_SECONDS} detik` : `+${SEEK_STEP_SECONDS} detik`}
        </div>
      )}

      {/* Tombol tengah: mundur 10 · play/pause · maju 10 */}
      {playerState !== STATE_ENDED && (
        <div
          className={cn(
            'pointer-events-none absolute inset-0 flex items-center justify-center gap-6 sm:gap-12 transition-opacity duration-300',
            showChrome ? 'opacity-100' : 'opacity-0',
          )}
        >
          <CenterButton label={`Mundur ${SEEK_STEP_SECONDS} detik`} onClick={() => seekBy(-SEEK_STEP_SECONDS)} visible={showChrome}>
            <SeekIcon dir={-1} />
          </CenterButton>
          <CenterButton label={isPlaying ? 'Jeda' : 'Putar'} onClick={() => { togglePlay(); revealControls(); }} visible={showChrome} large>
            {isPlaying ? <Pause className="w-6 h-6 sm:w-8 sm:h-8 fill-current" /> : <Play className="w-6 h-6 sm:w-8 sm:h-8 fill-current translate-x-0.5" />}
          </CenterButton>
          <CenterButton label={`Maju ${SEEK_STEP_SECONDS} detik`} onClick={() => seekBy(SEEK_STEP_SECONDS)} visible={showChrome}>
            <SeekIcon dir={1} />
          </CenterButton>
        </div>
      )}

      {/* Bar kontrol bawah */}
      <div
        className={cn(
          // Gradien tidak menangkap klik supaya tombol tengah tetap bisa
          // di-tap di layar kecil; hanya baris kontrolnya yang interaktif.
          'pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 sm:px-4 pt-6 sm:pt-8 pb-1.5 sm:pb-3 transition-opacity duration-300',
          showChrome ? 'opacity-100 [&>*]:pointer-events-auto' : 'opacity-0',
        )}
      >
        <div className="relative h-4 flex items-center">
          <div className="absolute inset-x-0 h-1 rounded-full bg-white/25" />
          <div className="absolute left-0 h-1 rounded-full bg-primary" style={{ width: `${progressPct}%` }} />
          <input
            type="range"
            min={0}
            max={Math.max(duration, 1)}
            step={1}
            value={Math.min(currentTime, Math.max(duration, 1))}
            onChange={(e) => seekTo(Number(e.target.value))}
            onKeyDown={(e) => e.stopPropagation()}
            aria-label="Posisi video"
            className="relative w-full h-4 appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white"
          />
        </div>

        <div className="mt-1 flex items-center gap-1 sm:gap-2 text-white">
          <BarButton label={isPlaying ? 'Jeda' : 'Putar'} onClick={togglePlay}>
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
          </BarButton>
          <BarButton label={`Mundur ${SEEK_STEP_SECONDS} detik`} onClick={() => seekBy(-SEEK_STEP_SECONDS)}>
            <SeekIcon dir={-1} small />
          </BarButton>
          <BarButton label={`Maju ${SEEK_STEP_SECONDS} detik`} onClick={() => seekBy(SEEK_STEP_SECONDS)}>
            <SeekIcon dir={1} small />
          </BarButton>
          <span className="ml-1 text-xs sm:text-sm tabular-nums text-white/90 whitespace-nowrap">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setSpeedMenuOpen((o) => !o)}
                aria-label="Kecepatan putar"
                aria-expanded={speedMenuOpen}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 h-9 text-xs sm:text-sm font-semibold hover:bg-white/15',
                  speed !== 1 && 'text-accent',
                )}
              >
                <Gauge className="w-4 h-4" />
                {speed}x
              </button>
              {/* Menu dirender di dalam player (bukan portal) supaya tetap
                  terlihat saat fullscreen */}
              {speedMenuOpen && (
                <div className="absolute bottom-11 right-0 min-w-28 rounded-lg bg-black/90 py-1 shadow-lg ring-1 ring-white/10">
                  <p className="px-3 py-1 text-[11px] uppercase tracking-wide text-white/50">Kecepatan</p>
                  {SPEED_OPTIONS.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => changeSpeed(rate)}
                      className={cn(
                        'block w-full px-3 py-1.5 text-left text-sm hover:bg-white/15',
                        rate === speed && 'text-accent font-semibold',
                      )}
                    >
                      {rate === 1 ? 'Normal' : `${rate}x`}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <BarButton label={isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'} onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </BarButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function BarButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-white/15"
    >
      {children}
    </button>
  );
}

function CenterButton({
  label,
  onClick,
  visible,
  large,
  children,
}: {
  label: string;
  onClick: () => void;
  visible: boolean;
  large?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      tabIndex={visible ? 0 : -1}
      className={cn(
        'flex items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70',
        visible ? 'pointer-events-auto' : 'pointer-events-none',
        large ? 'h-12 w-12 sm:h-16 sm:w-16' : 'h-10 w-10 sm:h-12 sm:w-12',
      )}
    >
      {children}
    </button>
  );
}

function SeekIcon({ dir, small }: { dir: -1 | 1; small?: boolean }) {
  const Icon = dir < 0 ? RotateCcw : RotateCw;
  return (
    <span className="relative inline-flex items-center justify-center">
      <Icon className={small ? 'w-5 h-5' : 'w-6 h-6 sm:w-7 sm:h-7'} />
      <span className={cn('absolute font-bold leading-none', small ? 'text-[7px]' : 'text-[9px]')}>
        {SEEK_STEP_SECONDS}
      </span>
    </span>
  );
}
