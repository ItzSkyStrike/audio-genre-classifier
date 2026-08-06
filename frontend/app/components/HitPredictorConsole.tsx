"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type ExtractedFeatures = {
  tempo?: number;
  energy?: number;
  danceability?: number;
  loudness?: number;
  acousticness?: number;
  valence?: number;
  [key: string]: number | undefined;
};

type PredictionResult = {
  genre?: string;
  genre_confidence?: number;
  is_hit?: 0 | 1;
  confidence?: number;
  extracted_features?: ExtractedFeatures;
  error?: string;
};

type HistoryEntry = {
  id: string;
  fileName: string;
  result: PredictionResult;
};

/*use local api if the backend code is running on local machine or desired cloud platform api*/
const API_URL = "https://hit-predictor-api.proudbeach-12e8e35e.centralindia.azurecontainerapps.io/predict";
const ACCEPTED_EXT = /\.(mp3|wav)$/i;

/* -------------------------------------------------------------------------- */
/*  Canvas Particle System Types                                              */
/* -------------------------------------------------------------------------- */

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  opacity: number;
  type: "ambient" | "trail" | "burst" | "ripple";
  radius?: number;
  maxRadius?: number;
};

/* -------------------------------------------------------------------------- */
/*  Small presentational helpers                                              */
/* -------------------------------------------------------------------------- */

/** Five-bar equalizer glyph — doubles as the app's icon, the dropzone's empty
 *  state, and the "analyzing" indicator on the action button. */
function EqualizerBars({
  active,
  className = "",
  barWidth = "w-[3px]",
  barHeight = "h-4",
}: {
  active: boolean;
  className?: string;
  barWidth?: string;
  barHeight?: string;
}) {
  const restScale = [0.4, 0.75, 0.5, 1, 0.6];
  return (
    <div className={`flex items-end gap-[3px] ${className}`} aria-hidden="true">
      {restScale.map((scale, i) => (
        <span
          key={i}
          className={`${barWidth} ${barHeight} origin-bottom rounded-full bg-current`}
          style={{
            transform: active ? undefined : `scaleY(${scale})`,
            animation: active
              ? `eq-bounce 0.9s ease-in-out ${i * 0.11}s infinite`
              : undefined,
          }}
        />
      ))}
    </div>
  );
}

/** Renders decoded amplitude peaks as a seekable waveform — a scaled-up
 *  sibling of EqualizerBars, so the preview player and the loading/branding
 *  motif read as one consistent idea instead of two unrelated widgets. */
function Waveform({
  peaks,
  progress,
  onSeek,
}: {
  peaks: number[];
  progress: number;
  onSeek: (ratio: number) => void;
}) {
  return (
    <div
      role="slider"
      aria-label="Seek preview"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      onClick={(e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        onSeek((e.clientX - rect.left) / rect.width);
      }}
      className="flex h-12 w-full cursor-pointer items-end gap-[2px]"
    >
      {peaks.map((p, i) => {
        const played = i / peaks.length <= progress;
        return (
          <span
            key={i}
            className="flex-1 origin-bottom rounded-full transition-colors duration-150"
            style={{
              height: `${Math.max(15, p * 100)}%`,
              background: played
                ? "linear-gradient(180deg, #60B5FF 0%, #257CE6 100%)"
                : "rgba(58,159,255,0.24)",
              boxShadow: played
                ? "0 0 8px rgba(58,159,255,0.75)"
                : "inset 0 1px 0 rgba(255,255,255,0.1)",
              animation: `bar-grow 0.4s ease-out ${i * 4}ms both`,
            }}
          />
        );
      })}
    </div>
  );
}

function IconUpload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path
        d="M12 16V4M12 4L7 9M12 4l5 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 translate-x-[1px]" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}

function IconX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMuted() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8.5 12h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconTempo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 13l3.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="13" r="1.1" fill="currentColor" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M13 3L5 14h5l-1 7 8-11h-5l1-7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconWave() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M3 12h2l2-6 3 12 3-15 3 12 2-6h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSpeaker() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M4 9v6h4l5 4V5L8 9H4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M16.5 9a4 4 0 0 1 0 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M19 7a7.5 7.5 0 0 1 0 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconLeaf() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M5 19c2-5 5-8 10-10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSmile() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8.5 14c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="9" cy="10" r="0.9" fill="currentColor" />
      <circle cx="15" cy="10" r="0.9" fill="currentColor" />
    </svg>
  );
}

const FEATURE_META: Record<
  string,
  {
    label: string;
    icon: ReactNode;
    format: (v: number) => string;
    accent: string;
    meter: (v: number) => number;
  }
> = {
  tempo: {
    label: "Tempo",
    icon: <IconTempo />,
    format: (v) => `${Math.round(v)} BPM`,
    accent: "#A06EE1", // Electric Violet
    meter: (v) => Math.max(0, Math.min(100, ((v - 40) / (200 - 40)) * 100)),
  },
  energy: {
    label: "Energy",
    icon: <IconBolt />,
    format: (v) => `${Math.round(v * 100)}%`,
    accent: "#FFB800", // Neon Gold
    meter: (v) => Math.max(0, Math.min(100, v * 100)),
  },
  danceability: {
    label: "Danceability",
    icon: <IconWave />,
    format: (v) => `${Math.round(v * 100)}%`,
    accent: "#00E5A3", // Cyber Emerald Green
    meter: (v) => Math.max(0, Math.min(100, v * 100)),
  },
  loudness: {
    label: "Loudness",
    icon: <IconSpeaker />,
    format: (v) => `${v.toFixed(1)} dB`,
    accent: "#00B4D8", // Vivid Cyan
    // backend reports loudness on the standard -60dB (silent) to 0dB (peak) scale
    meter: (v) => Math.max(0, Math.min(100, ((v - -60) / (0 - -60)) * 100)),
  },
  acousticness: {
    label: "Acousticness",
    icon: <IconLeaf />,
    format: (v) => `${Math.round(v * 100)}%`,
    accent: "#76E039", // Vibrant Lime Green
    meter: (v) => Math.max(0, Math.min(100, v * 100)),
  },
  valence: {
    label: "Mood",
    icon: <IconSmile />,
    format: (v) => `${Math.round(v * 100)}%`,
    accent: "#FF3385", // Neon Magenta / Pink
    meter: (v) => Math.max(0, Math.min(100, v * 100)),
  },
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(seconds: number) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

/* -------------------------------------------------------------------------- */
/*  Main component                                                            */
/* -------------------------------------------------------------------------- */

export default function HitPredictorConsole() {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [displayConfidence, setDisplayConfidence] = useState(0);
  const [statsRevealed, setStatsRevealed] = useState(false);
  const [waveformPeaks, setWaveformPeaks] = useState<number[] | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const particlesRef = useRef<Particle[]>([]);

  /* ---- Canvas Particle System (60 FPS) ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let lastSpawn = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;

      // Trail particles on cursor move
      if (Math.random() < 0.4) {
        particlesRef.current.push({
          x: e.clientX + (Math.random() - 0.5) * 8,
          y: e.clientY + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8 - 0.3,
          life: 0,
          maxLife: 30 + Math.random() * 20,
          size: 1.2 + Math.random() * 2,
          opacity: 0.6 + Math.random() * 0.4,
          type: "trail",
        });
      }
    };

    const handleClick = (e: MouseEvent) => {
      // Burst particles on click
      const count = 12 + Math.floor(Math.random() * 8);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const speed = 1.5 + Math.random() * 3;
        particlesRef.current.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 40 + Math.random() * 25,
          size: 1.5 + Math.random() * 2.5,
          opacity: 1,
          type: "burst",
        });
      }
      // Energy ripple
      particlesRef.current.push({
        x: e.clientX,
        y: e.clientY,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 50,
        size: 0,
        opacity: 0.5,
        type: "ripple",
        radius: 0,
        maxRadius: 80 + Math.random() * 40,
      });
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("click", handleClick);
    document.addEventListener("mouseleave", handleMouseLeave);

    // Seed ambient particles
    for (let i = 0; i < 40; i++) {
      particlesRef.current.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.15 - Math.random() * 0.25,
        life: Math.random() * 200,
        maxLife: 200 + Math.random() * 200,
        size: 1 + Math.random() * 2,
        opacity: 0.15 + Math.random() * 0.35,
        type: "ambient",
      });
    }

    const tick = (now: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Spawn ambient particles periodically
      if (now - lastSpawn > 120) {
        lastSpawn = now;
        if (particlesRef.current.filter((p) => p.type === "ambient").length < 50) {
          particlesRef.current.push({
            x: Math.random() * canvas.width,
            y: canvas.height + 10,
            vx: (Math.random() - 0.5) * 0.4,
            vy: -0.2 - Math.random() * 0.4,
            life: 0,
            maxLife: 250 + Math.random() * 250,
            size: 1 + Math.random() * 2.2,
            opacity: 0.1 + Math.random() * 0.3,
            type: "ambient",
          });
        }
      }

      // Update & draw particles
      const alive: Particle[] = [];
      for (const p of particlesRef.current) {
        p.life++;
        if (p.life > p.maxLife) continue;

        p.x += p.vx;
        p.y += p.vy;

        const progress = p.life / p.maxLife;

        if (p.type === "ripple") {
          p.radius = (p.maxRadius ?? 80) * progress;
          const alpha = p.opacity * (1 - progress);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(30, 144, 255, ${alpha})`;
          ctx.lineWidth = 1.5 * (1 - progress);
          ctx.stroke();
        } else {
          // Fade in then out
          let alpha: number;
          if (p.type === "ambient") {
            alpha = p.opacity * (progress < 0.1 ? progress / 0.1 : 1 - progress);
          } else {
            alpha = p.opacity * (1 - progress);
          }

          if (p.type === "burst") {
            p.vx *= 0.96;
            p.vy *= 0.96;
          }

          const currentSize = p.type === "burst" ? p.size * (1 - progress * 0.5) : p.size;

          ctx.beginPath();
          ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);

          if (p.type === "trail") {
            ctx.fillStyle = `rgba(0, 112, 204, ${alpha * 0.8})`;
            ctx.shadowColor = "rgba(30, 144, 255, 0.6)";
            ctx.shadowBlur = 6;
          } else if (p.type === "burst") {
            ctx.fillStyle = `rgba(30, 144, 255, ${alpha})`;
            ctx.shadowColor = "rgba(30, 144, 255, 0.8)";
            ctx.shadowBlur = 10;
          } else {
            ctx.fillStyle = `rgba(0, 112, 204, ${alpha})`;
            ctx.shadowColor = "rgba(0, 112, 204, 0.3)";
            ctx.shadowBlur = 4;
          }
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        alive.push(p);
      }
      particlesRef.current = alive;

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  // Create a playable object URL whenever a new file is selected, and clean
  // up the previous one so blob URLs don't leak between selections.
  useEffect(() => {
    if (!file) {
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Decode real amplitude peaks for the waveform. Runs client-side only and
  // fails soft — if decoding isn't supported for a format, the scrubber below
  // just falls back to a plain progress bar instead of breaking anything.
  useEffect(() => {
    setWaveformPeaks(null);
    if (!file) return;

    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    let cancelled = false;
    const ctx = new AudioContextCtor();

    (async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        if (cancelled) return;
        const raw = audioBuffer.getChannelData(0);
        const barCount = 80;
        const blockSize = Math.max(1, Math.floor(raw.length / barCount));
        const peaks: number[] = [];
        for (let i = 0; i < barCount; i++) {
          const start = i * blockSize;
          let max = 0;
          for (let j = 0; j < blockSize; j++) {
            const v = Math.abs(raw[start + j] ?? 0);
            if (v > max) max = v;
          }
          peaks.push(max);
        }
        const maxPeak = Math.max(...peaks, 0.0001);
        if (!cancelled) setWaveformPeaks(peaks.map((p) => Math.max(0.12, p / maxPeak)));
      } catch {
        if (!cancelled) setWaveformPeaks(null);
      }
    })();

    return () => {
      cancelled = true;
      ctx.close().catch(() => {});
    };
  }, [file]);

  // On a fresh prediction, count the confidence score up from zero (driving
  // the ring fill in step) and reveal the acoustic stat bars right after —
  // one small orchestrated sequence instead of everything popping in at once.
  useEffect(() => {
    const predicted = !!result && !result.error && typeof result.is_hit === "number";
    if (!predicted) {
      setDisplayConfidence(0);
      setStatsRevealed(false);
      return;
    }
    const target = Math.max(0, Math.min(100, result?.confidence ?? 0));
    setStatsRevealed(false);
    let raf = 0;
    const animDuration = 900;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / animDuration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayConfidence(target * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setStatsRevealed(true);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [result]);

  const isAudioFile = (f: File) => ACCEPTED_EXT.test(f.name) || f.type.startsWith("audio/");

  const selectFile = useCallback((f: File | null) => {
    if (!f) return;
    if (!isAudioFile(f)) {
      setResult({ error: "That file type isn't supported — please choose an MP3 or WAV." });
      return;
    }
    setResult(null);
    setFile(f);
  }, []);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    selectFile(e.target.files?.[0] ?? null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    selectFile(e.dataTransfer.files?.[0] ?? null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const clearFile = (e: ReactMouseEvent) => {
    e.stopPropagation();
    audioRef.current?.pause();
    setFile(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const togglePlay = (e: ReactMouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => setIsPlaying(false));
    }
  };

  const seekToRatio = (ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const clamped = Math.min(1, Math.max(0, ratio));
    audio.currentTime = clamped * duration;
    setCurrentTime(audio.currentTime);
  };

  const handleSeek = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    seekToRatio((e.clientX - rect.left) / rect.width);
  };

  const handleAnalyze = async () => {
    if (!file || analyzing) return;
    setAnalyzing(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(API_URL, { method: "POST", body: formData });
      const data: PredictionResult = await res.json();
      setResult(data);
      if (!data.error && typeof data.is_hit === "number") {
        const entry: HistoryEntry = {
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random()}`,
          fileName: file.name,
          result: data,
        };
        setHistory((prev) => [entry, ...prev].slice(0, 6));
      }
    } catch {
      setResult({
        error: "Couldn't reach the prediction server — make sure the backend is running on localhost:8000.",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const isHit = result?.is_hit === 1;
  const hasPrediction = !!result && !result.error && typeof result.is_hit === "number";
  const confidence = Math.max(0, Math.min(100, result?.confidence ?? 0));
  const ringColor = isHit ? "#3A9FFF" : "#FF3131";

  const featureEntries = Object.entries(result?.extracted_features ?? {}).filter(
    ([, v]) => typeof v === "number"
  ) as [string, number][];

  return (
    <div
      className="relative min-h-screen overflow-hidden px-3 py-8 text-[#E0E0E0] sm:px-6 sm:py-12 md:py-16"
      style={{
        background: "linear-gradient(165deg, #010206 0%, #020204 28%, #030A17 55%, #020204 100%)",
      }}
    >
      {/* ---- Canvas particle layer ---- */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-10"
        style={{ mixBlendMode: "screen" }}
        aria-hidden="true"
      />

      {/* ===== ARC REACTOR BACKGROUND ===== */}

      {/* Faded blue cyber grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            "linear-gradient(rgba(58,159,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(58,159,255,0.55) 1px, transparent 1px)",
          backgroundSize: "55px 55px",
          maskImage: "radial-gradient(ellipse at center, rgba(0,0,0,0.95) 45%, transparent 90%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, rgba(0,0,0,0.95) 45%, transparent 90%)",
          animation: "cyber-grid-pulse 8s ease-in-out infinite",
        }}
        aria-hidden="true"
      />

      {/* Deep radial glow from center — the reactor's ambient light */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(58,159,255,0.15) 0%, rgba(58,159,255,0.05) 25%, transparent 55%)",
          animation: "reactor-core-breathe 4s ease-in-out infinite",
        }}
        aria-hidden="true"
      />

      {/* Core bright spot — the white-hot center */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[60px] w-[60px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(200,225,255,0.35) 0%, rgba(58,159,255,0.2) 40%, transparent 70%)",
          boxShadow: "0 0 60px 20px rgba(58,159,255,0.15), 0 0 120px 40px rgba(58,159,255,0.08)",
          animation: "reactor-core-breathe 4s ease-in-out infinite",
        }}
        aria-hidden="true"
      />

      {/* Inner ring 1 — thin bright circle */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          border: "1px solid rgba(58,159,255,0.2)",
          boxShadow: "0 0 15px 2px rgba(58,159,255,0.08), inset 0 0 15px 2px rgba(58,159,255,0.05)",
          animation: "reactor-ring-pulse 3s ease-in-out infinite",
        }}
        aria-hidden="true"
      />

      {/* Inner ring 2 — segmented rotating ring */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "conic-gradient(from 0deg, transparent 0deg, rgba(58,159,255,0.12) 8deg, transparent 16deg, transparent 90deg, rgba(58,159,255,0.12) 98deg, transparent 106deg, transparent 180deg, rgba(58,159,255,0.12) 188deg, transparent 196deg, transparent 270deg, rgba(58,159,255,0.12) 278deg, transparent 286deg)",
          maskImage: "radial-gradient(circle, transparent 42%, black 44%, black 48%, transparent 50%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 42%, black 44%, black 48%, transparent 50%)",
          animation: "reactor-spin-slow 20s linear infinite",
        }}
        aria-hidden="true"
      />

      {/* Mid ring — dashed circle */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          border: "1px dashed rgba(58,159,255,0.1)",
          animation: "reactor-ring-pulse 5s ease-in-out infinite 1s",
        }}
        aria-hidden="true"
      />

      {/* Outer ring — thick segmented rotating ring */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: "conic-gradient(from 45deg, transparent 0deg, rgba(58,159,255,0.08) 5deg, transparent 10deg, transparent 30deg, rgba(58,159,255,0.08) 35deg, transparent 40deg, transparent 60deg, rgba(58,159,255,0.08) 65deg, transparent 70deg, transparent 90deg, rgba(58,159,255,0.08) 95deg, transparent 100deg, transparent 120deg, rgba(58,159,255,0.08) 125deg, transparent 130deg, transparent 150deg, rgba(58,159,255,0.08) 155deg, transparent 160deg, transparent 180deg, rgba(58,159,255,0.08) 185deg, transparent 190deg, transparent 210deg, rgba(58,159,255,0.08) 215deg, transparent 220deg, transparent 240deg, rgba(58,159,255,0.08) 245deg, transparent 250deg, transparent 270deg, rgba(58,159,255,0.08) 275deg, transparent 280deg, transparent 300deg, rgba(58,159,255,0.08) 305deg, transparent 310deg, transparent 330deg, rgba(58,159,255,0.08) 335deg, transparent 340deg)",
          maskImage: "radial-gradient(circle, transparent 44%, black 45%, black 49%, transparent 50%)",
          WebkitMaskImage: "radial-gradient(circle, transparent 44%, black 45%, black 49%, transparent 50%)",
          animation: "reactor-spin-reverse 30s linear infinite",
        }}
        aria-hidden="true"
      />

      {/* Outer decorative ring */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          border: "1px solid rgba(58,159,255,0.06)",
          boxShadow: "inset 0 0 30px 4px rgba(58,159,255,0.03)",
          animation: "reactor-ring-pulse 6s ease-in-out infinite 2s",
        }}
        aria-hidden="true"
      />

      {/* Outermost subtle ring */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          border: "1px solid rgba(58,159,255,0.03)",
        }}
        aria-hidden="true"
      />

      {/* Spoke lines — energy channels radiating outward */}
      {[0, 30, 60, 90, 120, 150].map((deg) => (
        <div
          key={deg}
          className="pointer-events-none absolute left-1/2 top-1/2 origin-center"
          style={{
            width: "1px",
            height: "400px",
            marginLeft: "-0.5px",
            marginTop: "-200px",
            background: "linear-gradient(to bottom, transparent 10%, rgba(58,159,255,0.06) 30%, rgba(58,159,255,0.1) 50%, rgba(58,159,255,0.06) 70%, transparent 90%)",
            transform: `rotate(${deg}deg)`,
          }}
          aria-hidden="true"
        />
      ))}

      {/* Energy beam rays — longer, faint */}
      {[15, 75, 135, 195, 255, 315].map((deg) => (
        <div
          key={`ray-${deg}`}
          className="pointer-events-none absolute left-1/2 top-1/2 origin-center"
          style={{
            width: "1px",
            height: "900px",
            marginLeft: "-0.5px",
            marginTop: "-450px",
            background: "linear-gradient(to bottom, transparent 5%, rgba(58,159,255,0.03) 35%, rgba(58,159,255,0.05) 50%, rgba(58,159,255,0.03) 65%, transparent 95%)",
            transform: `rotate(${deg}deg)`,
          }}
          aria-hidden="true"
        />
      ))}

      {/* Scanline overlay — fine horizontal lines */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(58,159,255,0.15) 2px, rgba(58,159,255,0.15) 4px)",
          animation: "scanline-scroll 10s linear infinite",
        }}
        aria-hidden="true"
      />

      {/* Vignette — dark edges, reactor glow center */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,2,0.5) 65%, rgba(0,0,0,0.88) 100%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-20 mx-auto flex w-full max-w-6xl flex-col items-center">
        {/* header */}
        <div
          className="mb-8 flex flex-col items-center text-center sm:mb-12"
          style={{ animation: "fade-in-down 0.7s ease-out" }}
        >
          <div
            className="mb-4 flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.22em]"
            style={{
              border: "1px solid rgba(58,159,255,0.25)",
              background: "rgba(58,159,255,0.16)",
              color: "#3A9FFF",
              boxShadow:
                "0 0 20px -8px rgba(58,159,255,0.4), inset 0 0 12px -4px rgba(58,159,255,0.16)",
              backdropFilter: "blur(12px)",
            }}
          >
            <EqualizerBars active={true} barHeight="h-2.5" className="text-[#3A9FFF]" />
            Audio Intelligence
          </div>
          <h1
            className="text-2xl font-black uppercase tracking-wider xs:text-3xl sm:text-4xl md:text-5xl"
            style={{
              fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
              letterSpacing: "0.08em",
            }}
          >
            <span
              style={{
                background: "linear-gradient(90deg, #E0E0E0 0%, #E0E0E0 35%, #3A9FFF 50%, #E0E0E0 65%, #E0E0E0 100%)",
                backgroundSize: "300% 100%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                animation: "title-gradient-cycle 3s ease-in-out infinite",
                filter: "drop-shadow(0 0 20px rgba(58,159,255,0.22))",
              }}
            >
              AI HIT PREDICTOR
            </span>
          </h1>
          <p
            className="mt-3 max-w-sm text-[14px] leading-relaxed"
            style={{ color: "rgba(58,159,255,0.5)", letterSpacing: "0.04em" }}
          >
            Drop a track and let the model read its tempo, energy, and groove to call whether it&apos;s hit-bound.
          </p>

          {/* Decorative line */}
          <div className="mt-5 flex items-center gap-3">
            <div className="h-px w-16" style={{ background: "linear-gradient(90deg, transparent, rgba(58,159,255,0.4))" }} />
            <div className="h-1.5 w-1.5 rotate-45" style={{ background: "#3A9FFF", boxShadow: "0 0 8px rgba(58,159,255,0.8)" }} />
            <div className="h-px w-16" style={{ background: "linear-gradient(90deg, rgba(58,159,255,0.4), transparent)" }} />
          </div>
        </div>

        <div
          className="grid w-full gap-6 sm:gap-8 lg:grid-cols-[minmax(280px,420px)_minmax(0,1fr)] lg:items-start"
          style={{ animation: "fade-up 0.7s ease-out 0.1s both" }}
        >
          {/* left column — upload, preview, analyze */}
          <div className="flex flex-col items-center gap-6">
            {/* dropzone */}
            <input
              ref={inputRef}
              type="file"
              accept=".mp3,.wav,audio/mpeg,audio/wav"
              onChange={handleInputChange}
              className="hidden"
            />
            <audio
              ref={audioRef}
              src={audioUrl ?? undefined}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              className="hidden"
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`group relative w-full cursor-pointer overflow-hidden rounded-2xl transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3A9FFF]/60 ${
                isDragging
                  ? "scale-[1.02]"
                  : file
                  ? ""
                  : "hover:scale-[1.01]"
              }`}
              style={{
                background: isDragging
                  ? "rgba(58,159,255,0.13)"
                  : file
                  ? "linear-gradient(135deg, rgba(58,159,255,0.07), rgba(0,0,0,0.6))"
                  : "linear-gradient(135deg, rgba(58,159,255,0.07), rgba(0,0,0,0.4))",
                backdropFilter: "blur(20px)",
                boxShadow: isDragging
                  ? "0 0 40px -10px rgba(58,159,255,0.5), inset 0 0 30px -10px rgba(58,159,255,0.16)"
                  : file
                  ? "0 0 30px -12px rgba(58,159,255,0.3), inset 0 1px 0 rgba(58,159,255,0.13)"
                  : "inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              {/* Spinning conic-gradient border */}
              <div
                className="pointer-events-none absolute -inset-[1px] -z-10 rounded-2xl"
                style={{
                  background: isDragging
                    ? "conic-gradient(from var(--spin-angle, 0deg), #3A9FFF, transparent 40%, #3A9FFF 50%, transparent 90%, #3A9FFF)"
                    : file
                    ? "conic-gradient(from var(--spin-angle, 0deg), rgba(58,159,255,0.8), transparent 30%, rgba(58,159,255,0.4) 50%, transparent 80%, rgba(58,159,255,0.8))"
                    : "conic-gradient(from var(--spin-angle, 0deg), rgba(58,159,255,0.5), transparent 25%, rgba(58,159,255,0.2) 50%, transparent 75%, rgba(58,159,255,0.5))",
                  animation: "spin-border 3s linear infinite",
                }}
                aria-hidden="true"
              />
              {/* Inner background mask */}
              <div
                className="pointer-events-none absolute inset-[1px] -z-10 rounded-[calc(1rem-1px)]"
                style={{
                  background: "linear-gradient(135deg, #030A17, #020204)",
                }}
                aria-hidden="true"
              />
              {!file ? (
                <div className="flex flex-col items-center gap-3 px-5 py-10 text-center sm:px-8 sm:py-14">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-xl transition-all duration-300 group-hover:-translate-y-1 group-hover:scale-110"
                    style={{
                      border: "1px solid rgba(58,159,255,0.2)",
                      background: "rgba(58,159,255,0.16)",
                      color: "rgba(58,159,255,0.5)",
                      boxShadow: "0 0 20px -8px rgba(58,159,255,0.3)",
                    }}
                  >
                    <IconUpload />
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-[#E0E0E0]">
                      Drag &amp; drop your track here
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "rgba(58,159,255,0.35)" }}>
                      MP3 or WAV · click to browse
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3.5 px-6 py-6">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={togglePlay}
                      aria-label={isPlaying ? "Pause preview" : "Play preview"}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 active:scale-95"
                      style={{
                        background: "rgba(58,159,255,0.18)",
                        border: "1px solid rgba(58,159,255,0.25)",
                        color: "#3A9FFF",
                        boxShadow: "0 0 15px -5px rgba(58,159,255,0.4)",
                      }}
                    >
                      {isPlaying ? <IconPause /> : <IconPlay />}
                    </button>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold text-[#E0E0E0]">{file.name}</p>
                      <p className="mt-0.5 text-xs" style={{ color: "rgba(58,159,255,0.4)" }}>
                        {formatBytes(file.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={clearFile}
                      aria-label="Remove file"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 hover:scale-110 active:scale-90"
                      style={{
                        color: "rgba(255,255,255,0.3)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <IconX />
                    </button>
                  </div>

                  {/* preview scrubber */}
                  <div className="flex items-center gap-2 pl-[3.25rem] sm:gap-2.5 sm:pl-[3.75rem]">
                    <span
                      className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums"
                      style={{ color: "rgba(58,159,255,0.5)" }}
                    >
                      {formatTime(currentTime)}
                    </span>
                    {waveformPeaks ? (
                      <Waveform
                        peaks={waveformPeaks}
                        progress={duration ? currentTime / duration : 0}
                        onSeek={seekToRatio}
                      />
                    ) : (
                      <div
                        role="slider"
                        aria-label="Seek preview"
                        aria-valuemin={0}
                        aria-valuemax={Math.round(duration)}
                        aria-valuenow={Math.round(currentTime)}
                        onClick={handleSeek}
                        className="group/bar relative h-1.5 flex-1 cursor-pointer rounded-full"
                        style={{ background: "rgba(58,159,255,0.13)" }}
                      >
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-[width]"
                          style={{
                            width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                            background: "linear-gradient(90deg, #3A9FFF, #1E65B8)",
                            boxShadow: "0 0 10px rgba(58,159,255,0.5)",
                          }}
                        />
                      </div>
                    )}
                    <span
                      className="w-8 shrink-0 font-mono text-[10px] tabular-nums"
                      style={{ color: "rgba(58,159,255,0.3)" }}
                    >
                      {formatTime(duration)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* action button */}
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!file || analyzing}
              className={`relative mt-5 flex h-12 w-full max-w-[280px] items-center justify-center overflow-hidden rounded-xl text-[13px] font-bold uppercase tracking-[0.12em] transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3A9FFF]/60 disabled:cursor-not-allowed sm:mt-7 sm:h-14 sm:max-w-xs sm:text-[14px] ${
                !file
                  ? ""
                  : analyzing
                  ? ""
                  : "hover:-translate-y-1 hover:scale-[1.02] active:translate-y-0 active:scale-[0.98]"
              }`}
              style={{
                border: !file
                  ? "1px solid rgba(255,255,255,0.06)"
                  : analyzing
                  ? "1px solid rgba(58,159,255,0.3)"
                  : "1px solid rgba(58,159,255,0.6)",
                background: !file
                  ? "rgba(255,255,255,0.03)"
                  : analyzing
                  ? "rgba(58,159,255,0.13)"
                  : "linear-gradient(135deg, #3A9FFF, #154E8C)",
                color: !file
                  ? "rgba(255,255,255,0.2)"
                  : analyzing
                  ? "#3A9FFF"
                  : "#020204",
                boxShadow: analyzing
                  ? "0 0 30px -8px rgba(58,159,255,0.4)"
                  : file
                  ? "0 0 40px -10px rgba(58,159,255,0.6), inset 0 1px 0 rgba(255,255,255,0.2)"
                  : "none",
                animation: analyzing ? "neon-pulse 1.6s ease-in-out infinite" : undefined,
              }}
            >
              {/* Button highlight overlay */}
              {file && !analyzing && (
                <span
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.2), transparent 60%)",
                  }}
                  aria-hidden="true"
                />
              )}
              <span className="relative z-[1] flex items-center gap-2.5">
                {analyzing ? (
                  <>
                    <EqualizerBars active barHeight="h-3.5" className="text-[#3A9FFF]" />
                    Analyzing track…
                  </>
                ) : (
                  <>
                    Analyze Track
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                      <path d="M9 6l8 6-8 6V6z" fill="currentColor" />
                    </svg>
                  </>
                )}
              </span>
            </button>

            {/* High quality audio & AI disclaimer note */}
            <div
              className="mt-2 flex w-full max-w-[320px] items-start gap-2.5 rounded-xl px-3.5 py-3 text-left"
              style={{
                border: "1px solid rgba(58,159,255,0.15)",
                background: "rgba(58,159,255,0.04)",
                backdropFilter: "blur(8px)",
              }}
            >
              <span className="mt-0.5 shrink-0 text-[#3A9FFF]">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M12 9v4m0 4h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <p className="text-[11px] leading-relaxed text-[#9A9AA2]">
                <strong className="font-semibold text-[#E0E0E0]">Tip:</strong> Upload high-quality audio (e.g. 320kbps MP3 or WAV) for best accuracy. AI predictions may occasionally make mistakes.
              </p>
            </div>

            {/* error state */}
            {result?.error && (
              <div
                className="mt-8 flex w-full items-start gap-3 rounded-xl px-5 py-4 text-sm"
                style={{
                  border: "1px solid rgba(255,49,49,0.25)",
                  background: "rgba(255,49,49,0.06)",
                  color: "#FF6B6B",
                  backdropFilter: "blur(12px)",
                  boxShadow: "0 0 20px -8px rgba(255,49,49,0.3)",
                  animation: "fade-up 0.4s ease-out",
                }}
              >
                <span className="mt-0.5 text-[#FF3131]">
                  <IconMuted />
                </span>
                <span>{result.error}</span>
              </div>
            )}
          </div>

          {/* right column — always-present prediction panel */}
          <div className="flex flex-1 flex-col items-center justify-center">
            {analyzing ? (
              <div
                className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl px-5 py-10 text-center sm:px-8 sm:py-16 lg:min-h-[400px] lg:justify-center"
                style={{
                  border: "1px solid rgba(58,159,255,0.22)",
                  background: "linear-gradient(135deg, rgba(58,159,255,0.07), rgba(0,0,0,0.6))",
                  backdropFilter: "blur(20px)",
                  boxShadow:
                    "0 0 40px -15px rgba(58,159,255,0.3), inset 0 1px 0 rgba(58,159,255,0.13)",
                  animation: "fade-up 0.4s ease-out",
                }}
              >
                <div className="relative flex h-24 w-24 items-center justify-center">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{ border: "2px solid rgba(58,159,255,0.16)" }}
                  />
                  <div
                    className="absolute inset-0 animate-spin rounded-full"
                    style={{
                      border: "2px solid transparent",
                      borderTopColor: "#3A9FFF",
                      filter: "drop-shadow(0 0 8px rgba(58,159,255,0.6))",
                    }}
                  />
                  <EqualizerBars active barHeight="h-5" className="text-[#3A9FFF]" />
                </div>
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-[#3A9FFF]">
                    Listening to the track…
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "rgba(58,159,255,0.35)" }}>
                    Reading tempo, energy, and genre cues
                  </p>
                </div>
              </div>
            ) : hasPrediction ? (
              <div className="flex w-full max-w-md flex-col items-center px-1">
                {/* detected genre badge */}
                {result?.genre && (
                  <div
                    className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em]"
                    style={{
                      border: "1px solid rgba(58,159,255,0.3)",
                      background: "rgba(58,159,255,0.13)",
                      color: "#3A9FFF",
                      backdropFilter: "blur(12px)",
                      boxShadow:
                        "0 0 30px -14px rgba(58,159,255,0.6), inset 0 0 12px -4px rgba(58,159,255,0.16)",
                      animation: "fade-up 0.4s ease-out",
                    }}
                  >
                    <IconSpark />
                    Detected Genre: {result.genre}
                  </div>
                )}

                {/* results card */}
                <div
                  className={`w-full overflow-hidden rounded-2xl p-5 sm:p-8 ${
                    result?.genre ? "mt-4" : "mt-0"
                  }`}
                  style={{
                    animation: "fade-up 0.5s ease-out",
                    border: `1px solid ${isHit ? "rgba(58,159,255,0.3)" : "rgba(255,49,49,0.22)"}`,
                    background: isHit
                      ? "linear-gradient(135deg, rgba(58,159,255,0.13), rgba(0,0,0,0.7))"
                      : "linear-gradient(135deg, rgba(255,49,49,0.04), rgba(0,0,0,0.7))",
                    boxShadow: isHit
                      ? "0 0 60px -20px rgba(58,159,255,0.5), inset 0 1px 0 rgba(58,159,255,0.16), inset 0 0 30px -10px rgba(58,159,255,0.05)"
                      : "0 0 50px -25px rgba(255,49,49,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
                    backdropFilter: "blur(24px)",
                  }}
                >
                  <div className="flex flex-col items-center text-center">
                    <span
                      className="mb-6 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-black uppercase tracking-[0.16em]"
                      style={{
                        color: isHit ? "#3A9FFF" : "#FF3131",
                        background: isHit ? "rgba(58,159,255,0.18)" : "rgba(255,49,49,0.1)",
                        border: `1px solid ${isHit ? "rgba(58,159,255,0.25)" : "rgba(255,49,49,0.2)"}`,
                        boxShadow: `0 0 15px -5px ${isHit ? "rgba(58,159,255,0.4)" : "rgba(255,49,49,0.3)"}`,
                      }}
                    >
                      {isHit ? <IconSpark /> : <IconMuted />}
                      {isHit ? "Hit" : "Pass"}
                    </span>

                    {/* confidence ring */}
                    <div
                      className="relative flex h-32 w-32 items-center justify-center sm:h-40 sm:w-40 md:h-44 md:w-44"
                      role="meter"
                      aria-label="Prediction confidence"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(confidence)}
                    >
                      {/* Glow behind ring */}
                      <div
                        className="absolute -inset-6 rounded-full opacity-40 blur-3xl"
                        style={{
                          background: ringColor,
                          animation: "ring-glow-pulse 2s ease-in-out infinite",
                        }}
                        aria-hidden="true"
                      />
                      {/* Outer decorative ring */}
                      <div
                        className="absolute -inset-2 rounded-full"
                        style={{
                          border: `1px solid ${isHit ? "rgba(58,159,255,0.16)" : "rgba(255,49,49,0.08)"}`,
                        }}
                        aria-hidden="true"
                      />
                      {/* Spinning conic-gradient ring border */}
                      <div
                        className="pointer-events-none absolute -inset-1.5 rounded-full"
                        style={{
                          background: `conic-gradient(from var(--spin-angle, 0deg), ${ringColor}, transparent 30%, transparent 70%, ${ringColor})`,
                          maskImage: "radial-gradient(circle, transparent 66%, black 68%, black 72%, transparent 74%)",
                          WebkitMaskImage: "radial-gradient(circle, transparent 66%, black 68%, black 72%, transparent 74%)",
                          animation: "spin-border 4s linear infinite",
                          filter: `drop-shadow(0 0 8px ${ringColor})`,
                        }}
                        aria-hidden="true"
                      />

                      <div
                        className="relative h-32 w-32 rounded-full sm:h-40 sm:w-40 md:h-44 md:w-44"
                        style={{
                          background: `conic-gradient(${ringColor} ${
                            displayConfidence * 3.6
                          }deg, rgba(255,255,255,0.04) 0deg)`,
                          filter: `drop-shadow(0 0 12px ${isHit ? "rgba(58,159,255,0.4)" : "rgba(255,49,49,0.3)"})`,
                        }}
                      >
                        <div
                          className="absolute inset-[6px] flex flex-col items-center justify-center rounded-full"
                          style={{
                            background: "linear-gradient(135deg, #0a0a0c, #060608)",
                            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), inset 0 0 20px -8px ${
                              isHit ? "rgba(58,159,255,0.16)" : "rgba(255,49,49,0.08)"
                            }`,
                          }}
                        >
                          <span
                            className="font-mono text-2xl font-black tabular-nums sm:text-3xl"
                            style={{
                              color: ringColor,
                              textShadow: `0 0 20px ${isHit ? "rgba(58,159,255,0.5)" : "rgba(255,49,49,0.4)"}`,
                              letterSpacing: "-0.02em",
                            }}
                          >
                            {displayConfidence.toFixed(1)}
                            <span
                              className="text-lg"
                              style={{ color: "rgba(255,255,255,0.25)" }}
                            >
                              %
                            </span>
                          </span>
                          <span
                            className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em]"
                            style={{ color: "rgba(58,159,255,0.4)" }}
                          >
                            Confidence
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* acoustic stats grid */}
                    {featureEntries.length > 0 && (
                      <div className="mt-8 w-full">
                        <div
                          className="mb-3 flex items-center gap-3 text-[9px] font-bold uppercase tracking-[0.2em]"
                          style={{ color: "rgba(58,159,255,0.4)" }}
                        >
                          <span
                            className="h-px flex-1"
                            style={{ background: "rgba(58,159,255,0.16)" }}
                          />
                          Acoustic Breakdown
                          <span
                            className="h-px flex-1"
                            style={{ background: "rgba(58,159,255,0.16)" }}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {featureEntries.map(([key, value], i) => {
                            const meta = FEATURE_META[key] ?? {
                              label: key,
                              icon: <IconWave />,
                              format: (v: number) => `${v}`,
                              accent: "#9A9AA2",
                              meter: () => 0,
                            };
                            return (
                              <div
                                key={key}
                                className="group relative flex flex-col items-center gap-2 overflow-hidden rounded-xl px-2 py-4 transition-all duration-300 hover:animate-[card-hover-breathe_2.8s_ease-in-out_infinite]"
                                style={{
                                  border: `1px solid ${meta.accent}2B`,
                                  background: `linear-gradient(135deg, ${meta.accent}12, rgba(8,10,16,0.85))`,
                                  backdropFilter: "blur(12px)",
                                  boxShadow: `inset 0 1px 0 ${meta.accent}1F, 0 0 15px -8px ${meta.accent}20`,
                                }}
                              >
                                {/* Hover light-up background & glowing border overlay */}
                                <div
                                  className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                  style={{
                                    background: `linear-gradient(135deg, ${meta.accent}52, ${meta.accent}22)`,
                                    boxShadow: `inset 0 0 0 1.5px ${meta.accent}, 0 0 28px -2px ${meta.accent}A0`,
                                  }}
                                  aria-hidden="true"
                                />
                                <span
                                  style={{
                                    color: meta.accent,
                                    filter: `drop-shadow(0 0 6px ${meta.accent}60)`,
                                  }}
                                >
                                  {meta.icon}
                                </span>
                                <span
                                  className="font-mono text-sm font-bold tabular-nums"
                                  style={{
                                    color: "#E0E0E0",
                                    textShadow: "0 0 10px rgba(255,255,255,0.1)",
                                  }}
                                >
                                  {meta.format(value)}
                                </span>
                                <span
                                  className="text-[9px] font-bold uppercase tracking-[0.15em]"
                                  style={{ color: `${meta.accent}CC` }}
                                >
                                  {meta.label}
                                </span>
                                <div
                                  className="mt-1 h-1 w-full overflow-hidden rounded-full"
                                  style={{ background: "rgba(255,255,255,0.08)" }}
                                >
                                  <div
                                    className="h-full rounded-full transition-[width] duration-700 ease-out"
                                    style={{
                                      width: statsRevealed ? `${meta.meter(value)}%` : "0%",
                                      background: `linear-gradient(90deg, ${meta.accent}, ${meta.accent}AA)`,
                                      boxShadow: `0 0 8px ${meta.accent}80`,
                                      transitionDelay: `${i * 110}ms`,
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl px-5 py-10 text-center sm:px-8 sm:py-16 lg:min-h-[400px] lg:justify-center"
                style={{
                  border: "1px dashed rgba(58,159,255,0.18)",
                  background: "rgba(58,159,255,0.07)",
                  backdropFilter: "blur(12px)",
                  animation: "fade-up 0.4s ease-out",
                }}
              >
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-xl"
                  style={{
                    border: "1px solid rgba(58,159,255,0.16)",
                    background: "rgba(58,159,255,0.07)",
                    animation: "float 4s ease-in-out infinite",
                  }}
                >
                  <EqualizerBars active={false} barHeight="h-5" className="text-[#3A9FFF]/20" />
                </div>
                <div>
                  <p
                    className="text-sm font-semibold uppercase tracking-wide"
                    style={{ color: "rgba(58,159,255,0.4)" }}
                  >
                    Your prediction will land here
                  </p>
                  <p
                    className="mt-1 max-w-[240px] text-xs"
                    style={{ color: "rgba(58,159,255,0.2)" }}
                  >
                    Upload a track and hit analyze to see the genre, hit score, and acoustic
                    breakdown.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* recent analyses — only appears once you've actually used the tool */}
        {history.length > 0 && (
          <div className="mt-10 w-full sm:mt-14">
            <div
              className="mb-4 flex items-center gap-3 text-[9px] font-bold uppercase tracking-[0.2em]"
              style={{ color: "rgba(58,159,255,0.4)" }}
            >
              <span
                className="h-px flex-1"
                style={{ background: "rgba(58,159,255,0.16)" }}
              />
              Recent Analyses
              <span
                className="h-px flex-1"
                style={{ background: "rgba(58,159,255,0.16)" }}
              />
            </div>
            <div className="flex w-full gap-3 overflow-x-auto pb-2">
              {history.map((entry) => {
                const entryIsHit = entry.result.is_hit === 1;
                const isActive = result === entry.result;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setResult(entry.result)}
                    className="flex min-w-[160px] max-w-[190px] shrink-0 flex-col gap-2 rounded-xl p-3 text-left transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.98] sm:min-w-[190px] sm:p-4"
                    style={{
                      border: isActive
                        ? "1px solid rgba(58,159,255,0.4)"
                        : "1px solid rgba(58,159,255,0.13)",
                      background: isActive
                        ? "rgba(58,159,255,0.13)"
                        : "linear-gradient(135deg, rgba(58,159,255,0.07), rgba(0,0,0,0.4))",
                      backdropFilter: "blur(12px)",
                      boxShadow: isActive
                        ? "0 0 20px -8px rgba(58,159,255,0.4), inset 0 0 12px -4px rgba(58,159,255,0.05)"
                        : "inset 0 1px 0 rgba(58,159,255,0.16)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wide"
                        style={{
                          color: entryIsHit ? "#3A9FFF" : "#FF3131",
                          background: entryIsHit
                            ? "rgba(58,159,255,0.18)"
                            : "rgba(255,49,49,0.1)",
                          border: `1px solid ${entryIsHit ? "rgba(58,159,255,0.2)" : "rgba(255,49,49,0.15)"}`,
                        }}
                      >
                        {entryIsHit ? "Hit" : "Pass"}
                      </span>
                      <span
                        className="font-mono text-xs font-bold"
                        style={{
                          color: "rgba(58,159,255,0.6)",
                          textShadow: "0 0 8px rgba(58,159,255,0.3)",
                        }}
                      >
                        {(entry.result.confidence ?? 0).toFixed(0)}%
                      </span>
                    </div>
                    <p className="truncate text-xs font-semibold text-[#E0E0E0]">
                      {entry.fileName}
                    </p>
                    {entry.result.genre && (
                      <p
                        className="truncate text-[9px] font-bold uppercase tracking-[0.15em]"
                        style={{ color: "rgba(58,159,255,0.3)" }}
                      >
                        {entry.result.genre}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer branding */}
        <div className="mt-10 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] sm:mt-16" style={{ color: "rgba(58,159,255,0.22)" }}>
          <div className="h-px w-8" style={{ background: "rgba(58,159,255,0.16)" }} />
          Neural Audio Engine v2.0
          <div className="h-px w-8" style={{ background: "rgba(58,159,255,0.16)" }} />
        </div>
      </div>

      <style>{`
        @property --spin-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes spin-border {
          to { --spin-angle: 360deg; }
        }
        @keyframes eq-bounce {
          0%, 100% { transform: scaleY(0.35); }
          50% { transform: scaleY(1); }
        }
        @keyframes neon-pulse {
          0%, 100% { box-shadow: 0 0 20px -5px rgba(58,159,255,0.4), inset 0 0 12px -4px rgba(58,159,255,0.16); }
          50% { box-shadow: 0 0 40px -5px rgba(58,159,255,0.6), inset 0 0 20px -4px rgba(58,159,255,0.22); }
        }
        @keyframes ring-glow-pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.05); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes reactor-core-breathe {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes reactor-ring-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes reactor-spin-slow {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes reactor-spin-reverse {
          from { transform: translate(-50%, -50%) rotate(360deg); }
          to { transform: translate(-50%, -50%) rotate(0deg); }
        }
        @keyframes scanline-scroll {
          from { transform: translateY(0); }
          to { transform: translateY(100px); }
        }
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bar-grow {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
        @keyframes title-gradient-cycle {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes border-dash-march {
          to { background-position: 100% 100%; }
        }
        @keyframes card-hover-breathe {
          0%, 100% { transform: translateY(-4px) scale(1.025); }
          50% { transform: translateY(-6px) scale(1.042); }
        }
        @keyframes cyber-grid-pulse {
          0%, 100% { opacity: 0.10; }
          50% { opacity: 0.18; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>
    </div>
  );
}
