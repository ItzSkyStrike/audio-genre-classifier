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

const API_URL = "https://audio-predictor-backend.onrender.com/predict";
// OR
// const API_URL = `${process.env.NEXT_PUBLIC_API_URL}/predict`;
const ACCEPTED_EXT = /\.(mp3|wav)$/i;

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
              height: `${Math.max(10, p * 100)}%`,
              background: played ? "#22E67A" : "rgba(255,255,255,0.14)",
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
    accent: "#8C7CFF",
    meter: (v) => Math.max(0, Math.min(100, ((v - 40) / (200 - 40)) * 100)),
  },
  energy: {
    label: "Energy",
    icon: <IconBolt />,
    format: (v) => `${Math.round(v * 100)}%`,
    accent: "#F5B94D",
    meter: (v) => Math.max(0, Math.min(100, v * 100)),
  },
  danceability: {
    label: "Danceability",
    icon: <IconWave />,
    format: (v) => `${Math.round(v * 100)}%`,
    accent: "#22E67A",
    meter: (v) => Math.max(0, Math.min(100, v * 100)),
  },
  loudness: {
    label: "Loudness",
    icon: <IconSpeaker />,
    format: (v) => `${v.toFixed(1)} dB`,
    accent: "#5FB8E8",
    // backend reports loudness on the standard -60dB (silent) to 0dB (peak) scale
    meter: (v) => Math.max(0, Math.min(100, ((v - -60) / (0 - -60)) * 100)),
  },
  acousticness: {
    label: "Acousticness",
    icon: <IconLeaf />,
    format: (v) => `${Math.round(v * 100)}%`,
    accent: "#4FD1B5",
    meter: (v) => Math.max(0, Math.min(100, v * 100)),
  },
  valence: {
    label: "Mood",
    icon: <IconSmile />,
    format: (v) => `${Math.round(v * 100)}%`,
    accent: "#F2799B",
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
        if (!cancelled) setWaveformPeaks(peaks.map((p) => Math.max(0.06, p / maxPeak)));
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
    } catch (err) {
      setResult({
        error: "Couldn't reach the prediction server. Please ensure the Codespace backend is public and running.",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const isHit = result?.is_hit === 1;
  const hasPrediction = !!result && !result.error && typeof result.is_hit === "number";
  const confidence = Math.max(0, Math.min(100, result?.confidence ?? 0));
  const ringColor = isHit ? "#22E67A" : "#E8785C";

  const featureEntries = Object.entries(result?.extracted_features ?? {}).filter(
    ([, v]) => typeof v === "number"
  ) as [string, number][];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08080a] px-4 py-16 text-[#F2F2F5] sm:px-6">
      {/* subtle dot-grid texture — keeps the dark field from reading flat */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          animation: "grid-pulse 7s ease-in-out infinite",
        }}
        aria-hidden="true"
      />
      {/* ambient glow field */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] rounded-full blur-[120px]"
        style={{
          background: "radial-gradient(circle, #22E67A, transparent 70%)",
          animation: "drift-a 22s ease-in-out infinite",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full blur-[110px]"
        style={{
          background: "radial-gradient(circle, #7C6CFF, transparent 70%)",
          animation: "drift-b 26s ease-in-out infinite",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-[62%] top-[38%] h-[380px] w-[380px] rounded-full blur-[120px]"
        style={{
          background: "radial-gradient(circle, #F5B94D, transparent 70%)",
          animation: "drift-c 30s ease-in-out infinite",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center">
        {/* header */}
        <div
          className="mb-12 flex flex-col items-center text-center"
          style={{ animation: "fade-in-down 0.7s ease-out" }}
        >
          <div className="mb-4 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#9A9AA2]">
            <EqualizerBars active={false} barHeight="h-2.5" className="text-[#22E67A]" />
            Audio Intelligence
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            AI Hit{" "}
            <span className="bg-gradient-to-r from-[#22E67A] to-[#8CFFC2] bg-clip-text text-transparent">
              Predictor
            </span>
          </h1>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-[#9A9AA2]">
            Drop a track and let the model read its tempo, energy, and groove to call whether it&apos;s hit-bound.
          </p>
        </div>

        <div
          className="grid w-full gap-8 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start"
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
          className={`group w-full cursor-pointer rounded-3xl border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22E67A]/60 ${
            isDragging
              ? "scale-[1.01] border-[#22E67A]/70 bg-[#22E67A]/[0.06]"
              : file
              ? "border-[#22E67A]/30 bg-[#22E67A]/[0.04]"
              : "border-dashed border-white/15 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.035]"
          }`}
        >
          {!file ? (
            <div className="flex flex-col items-center gap-3 px-8 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[#9A9AA2] transition-all duration-300 group-hover:-translate-y-0.5 group-hover:scale-105 group-hover:text-[#22E67A]">
                <IconUpload />
              </div>
              <div>
                <p className="text-sm font-medium text-[#F2F2F5]">
                  Drag &amp; drop your track here
                </p>
                <p className="mt-1 text-xs text-[#6C6C74]">MP3 or WAV · click to browse</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5 px-6 py-6">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? "Pause preview" : "Play preview"}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#22E67A]/10 text-[#22E67A] transition-all duration-200 hover:scale-110 hover:bg-[#22E67A]/20 active:scale-95"
                >
                  {isPlaying ? <IconPause /> : <IconPlay />}
                </button>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium text-[#F2F2F5]">{file.name}</p>
                  <p className="mt-0.5 text-xs text-[#6C6C74]">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={clearFile}
                  aria-label="Remove file"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#6C6C74] transition-all duration-200 hover:scale-110 hover:bg-white/10 hover:text-[#F2F2F5] active:scale-90"
                >
                  <IconX />
                </button>
              </div>

              {/* preview scrubber */}
              <div className="flex items-center gap-2.5 pl-[3.75rem]">
                <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-[#6C6C74]">
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
                    className="group/bar relative h-1.5 flex-1 cursor-pointer rounded-full bg-white/10"
                  >
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-[#22E67A] transition-[width] group-hover/bar:bg-[#3EF092]"
                      style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                    />
                  </div>
                )}
                <span className="w-8 shrink-0 font-mono text-[10px] tabular-nums text-[#6C6C74]">
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
          className={`relative mt-7 flex h-14 w-full max-w-xs items-center justify-center overflow-hidden rounded-full text-[15px] font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22E67A]/60 disabled:cursor-not-allowed ${
            !file
              ? "bg-white/[0.06] text-[#6C6C74]"
              : analyzing
              ? "bg-[#1a3b28] text-[#8CFFC2]"
              : "bg-[#22E67A] text-[#04140A] hover:-translate-y-0.5 hover:bg-[#3EF092] active:translate-y-0 active:scale-[0.98]"
          }`}
          style={
            analyzing
              ? { animation: "glow-pulse 1.6s ease-in-out infinite" }
              : file
              ? { boxShadow: "0 8px 30px -10px rgba(34,230,122,0.55)" }
              : undefined
          }
        >
          <span
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.18), transparent 55%)" }}
            aria-hidden="true"
          />
          <span className="relative z-[1] flex items-center gap-2.5">
            {analyzing ? (
              <>
                <EqualizerBars active barHeight="h-3.5" className="text-[#8CFFC2]" />
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

        {/* error state */}
        {result?.error && (
          <div
            className="mt-8 flex w-full items-start gap-3 rounded-2xl border border-[#E8785C]/25 bg-[#E8785C]/[0.06] px-5 py-4 text-sm text-[#F3B7A6]"
            style={{ animation: "fade-up 0.4s ease-out" }}
          >
            <span className="mt-0.5 text-[#E8785C]">
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
                className="flex w-full max-w-md flex-col items-center gap-5 rounded-3xl border border-white/10 bg-white/[0.02] px-8 py-16 text-center lg:min-h-[460px] lg:justify-center"
                style={{
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                  animation: "fade-up 0.4s ease-out",
                }}
              >
                <div className="relative flex h-24 w-24 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                  <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#22E67A]" />
                  <EqualizerBars active barHeight="h-5" className="text-[#22E67A]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#8CFFC2]">Listening to the track…</p>
                  <p className="mt-1 text-xs text-[#6C6C74]">
                    Reading tempo, energy, and genre cues
                  </p>
                </div>
              </div>
            ) : hasPrediction ? (
              <div className="flex w-full max-w-md flex-col items-center">
                {/* detected genre badge */}
                {result?.genre && (
                  <div
                    className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em]"
                    style={{
                      borderColor: "rgba(34,230,122,0.3)",
                      background: "rgba(34,230,122,0.08)",
                      color: "#8CFFC2",
                      backdropFilter: "blur(12px)",
                      boxShadow:
                        "0 0 30px -14px rgba(34,230,122,0.6), inset 0 1px 0 rgba(255,255,255,0.12)",
                      animation: "fade-up 0.4s ease-out",
                    }}
                  >
                    <IconSpark />
                    Detected Genre: {result.genre}
                  </div>
                )}

                {/* results card */}
                <div
                  className={`w-full overflow-hidden rounded-3xl border p-8 ${
                    result?.genre ? "mt-4" : "mt-0"
                  }`}
                  style={{
                    animation: "fade-up 0.5s ease-out",
                    borderColor: isHit ? "rgba(34,230,122,0.28)" : "rgba(232,120,92,0.22)",
                    background: isHit
                      ? "linear-gradient(180deg, rgba(34,230,122,0.09), rgba(255,255,255,0.02))"
                      : "linear-gradient(180deg, rgba(232,120,92,0.06), rgba(255,255,255,0.02))",
                    boxShadow: isHit
                      ? "0 0 70px -25px rgba(34,230,122,0.55), inset 0 1px 0 rgba(255,255,255,0.07)"
                      : "0 0 50px -25px rgba(232,120,92,0.35), inset 0 1px 0 rgba(255,255,255,0.07)",
                    backdropFilter: "blur(20px)",
                  }}
                >
            <div className="flex flex-col items-center text-center">
              <span
                className="mb-6 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em]"
                style={{
                  color: isHit ? "#22E67A" : "#E8785C",
                  background: isHit ? "rgba(34,230,122,0.12)" : "rgba(232,120,92,0.1)",
                }}
              >
                {isHit ? <IconSpark /> : <IconMuted />}
                {isHit ? "Hit" : "Pass"}
              </span>

              {/* confidence ring */}
              <div
                className="relative flex h-40 w-40 items-center justify-center"
                role="meter"
                aria-label="Prediction confidence"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(confidence)}
              >
                <div
                  className="absolute -inset-4 rounded-full opacity-35 blur-2xl"
                  style={{ background: ringColor }}
                  aria-hidden="true"
                />
                <div
                  className="relative h-40 w-40 rounded-full"
                  style={{
                    background: `conic-gradient(${ringColor} ${
                      displayConfidence * 3.6
                    }deg, rgba(255,255,255,0.07) 0deg)`,
                  }}
                >
                  <div
                    className="absolute inset-[6px] flex flex-col items-center justify-center rounded-full bg-[#0b0b0d]"
                    style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}
                  >
                    <span className="font-mono text-3xl font-bold tabular-nums">
                      {displayConfidence.toFixed(1)}
                      <span className="text-lg text-[#6C6C74]">%</span>
                    </span>
                    <span className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#6C6C74]">
                      Confidence
                    </span>
                  </div>
                </div>
              </div>

              {/* acoustic stats grid */}
              {featureEntries.length > 0 && (
                <div className="mt-8 w-full">
                  <div className="mb-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6C6C74]">
                    <span className="h-px flex-1 bg-white/10" />
                    Acoustic Breakdown
                    <span className="h-px flex-1 bg-white/10" />
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
                          className="flex flex-col items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-2 py-4 transition-all duration-300 hover:-translate-y-1 hover:border-white/15 hover:bg-white/[0.05]"
                          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}
                        >
                          <span style={{ color: meta.accent }}>{meta.icon}</span>
                          <span className="font-mono text-sm font-semibold tabular-nums text-[#F2F2F5]">
                            {meta.format(value)}
                          </span>
                          <span className="text-[10px] uppercase tracking-wide text-[#6C6C74]">
                            {meta.label}
                          </span>
                          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full transition-[width] duration-700 ease-out"
                              style={{
                                width: statsRevealed ? `${meta.meter(value)}%` : "0%",
                                background: meta.accent,
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
                className="flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border border-dashed border-white/10 bg-white/[0.015] px-8 py-16 text-center lg:min-h-[460px] lg:justify-center"
                style={{ animation: "fade-up 0.4s ease-out" }}
              >
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/25"
                  style={{ animation: "float 4s ease-in-out infinite" }}
                >
                  <EqualizerBars active={false} barHeight="h-5" className="text-white/20" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#9A9AA2]">
                    Your prediction will land here
                  </p>
                  <p className="mt-1 max-w-[240px] text-xs text-[#6C6C74]">
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
          <div className="mt-14 w-full">
            <div className="mb-4 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6C6C74]">
              <span className="h-px flex-1 bg-white/10" />
              Recent Analyses
              <span className="h-px flex-1 bg-white/10" />
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
                    className={`flex w-[190px] shrink-0 flex-col gap-2 rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-1 active:scale-[0.98] ${
                      isActive
                        ? "border-[#22E67A]/50 bg-[#22E67A]/[0.06]"
                        : "border-white/8 bg-white/[0.03] hover:border-white/20"
                    }`}
                    style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                        style={{
                          color: entryIsHit ? "#22E67A" : "#E8785C",
                          background: entryIsHit
                            ? "rgba(34,230,122,0.12)"
                            : "rgba(232,120,92,0.1)",
                        }}
                      >
                        {entryIsHit ? "Hit" : "Pass"}
                      </span>
                      <span className="font-mono text-xs text-[#9A9AA2]">
                        {(entry.result.confidence ?? 0).toFixed(0)}%
                      </span>
                    </div>
                    <p className="truncate text-xs font-medium text-[#F2F2F5]">
                      {entry.fileName}
                    </p>
                    {entry.result.genre && (
                      <p className="truncate text-[10px] uppercase tracking-wide text-[#6C6C74]">
                        {entry.result.genre}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes eq-bounce {
          0%, 100% { transform: scaleY(0.35); }
          50% { transform: scaleY(1); }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,230,122,0.35); }
          50% { box-shadow: 0 0 0 10px rgba(34,230,122,0); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes drift-a {
          0%, 100% { transform: translate(-50%, 0) scale(1); opacity: 0.28; }
          50% { transform: translate(-50%, 24px) scale(1.08); opacity: 0.38; }
        }
        @keyframes drift-b {
          0%, 100% { transform: translate(33%, 33%) scale(1); opacity: 0.18; }
          50% { transform: translate(27%, 27%) scale(1.08); opacity: 0.26; }
        }
        @keyframes drift-c {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.14; }
          50% { transform: translate(-24px, 18px) scale(1.12); opacity: 0.22; }
        }
        @keyframes grid-pulse {
          0%, 100% { opacity: 0.14; }
          50% { opacity: 0.22; }
        }
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bar-grow {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>
    </div>
  );
}
