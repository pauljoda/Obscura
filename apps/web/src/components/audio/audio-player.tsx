"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  Volume1,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
  Music,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { formatDuration } from "@obscura/contracts";
import type { AudioTrackListItemDto } from "@obscura/contracts";
import { AudioWaveformFilmstrip } from "./audio-waveform-filmstrip";

export type RepeatMode = "off" | "all" | "one";

interface AudioPlayerProps {
  tracks: AudioTrackListItemDto[];
  activeTrackId: string | null;
  onTrackChange: (trackId: string) => void;
  className?: string;
  /** Resolved API URL for the parent audio library cover (album art). */
  libraryCoverUrl?: string;
}

const API_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000")
    : "http://localhost:4000";

export function AudioPlayer({
  tracks,
  activeTrackId,
  onTrackChange,
  className,
  libraryCoverUrl,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [waveformData, setWaveformData] = useState<number[] | null>(null);
  const [repeat, setRepeat] = useState<RepeatMode>("off");
  const [shuffle, setShuffle] = useState(false);
  const [timelineDragging, setTimelineDragging] = useState(false);
  const timelineDraggingRef = useRef(false);

  const activeTrack = tracks.find((t) => t.id === activeTrackId) ?? null;
  const activeIndex = activeTrack ? tracks.findIndex((t) => t.id === activeTrackId) : -1;
  const hasNext = activeIndex >= 0 && activeIndex < tracks.length - 1;
  const hasPrev = activeIndex > 0;

  // ─── Load track into audio element ────────────────────────────

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!activeTrack) {
      audio.removeAttribute("src");
      audio.load();
      setPlaying(false);
      setCurrentTime(0);
      return;
    }

    const newSrc = `${API_BASE}/audio-stream/${activeTrack.id}`;
    // Only reload if the track actually changed
    if (audio.src !== newSrc) {
      audio.src = newSrc;
      setCurrentTime(0);
      setDuration(activeTrack.duration ?? 0);
      // Attempt to play; resolves once enough data is buffered
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // eslint-disable-next-line no-console
          console.error("Audio play failed:", err);
        });
      }
    }
  }, [activeTrack?.id]);

  // ─── Waveform data ────────────────────────────────────────────

  useEffect(() => {
    if (!activeTrack?.waveformPath) {
      setWaveformData(null);
      return;
    }
    const url = `${API_BASE}/assets/${activeTrack.waveformPath}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Waveform fetch failed: ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (json.data && Array.isArray(json.data)) {
          setWaveformData(json.data);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("Failed to load waveform:", err);
        setWaveformData(null);
      });
  }, [activeTrack?.waveformPath]);

  // ─── Refs for callbacks (avoid re-registering event listeners) ─

  const activeTrackIdRef = useRef(activeTrackId);
  activeTrackIdRef.current = activeTrackId;

  const handleTrackEndRef = useRef<() => void>(() => {});
  // Set later after handleTrackEnd is defined

  // ─── Audio event listeners (registered once per mount) ────────

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onDurationChange = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      const trackId = activeTrackIdRef.current;
      if (trackId) {
        fetch(`${API_BASE}/audio-tracks/${trackId}/play`, { method: "POST" }).catch(() => {});
      }
      handleTrackEndRef.current();
    };
    const onError = () => {
      // eslint-disable-next-line no-console
      console.error("Audio element error:", audio.error);
      setPlaying(false);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, []);

  // ─── Track end logic ──────────────────────────────────────────

  const handleTrackEnd = useCallback(() => {
    if (repeat === "one") {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
      return;
    }

    if (shuffle) {
      const otherTracks = tracks.filter((t) => t.id !== activeTrackId);
      if (otherTracks.length > 0) {
        const random = otherTracks[Math.floor(Math.random() * otherTracks.length)];
        onTrackChange(random.id);
      } else if (repeat === "all" && tracks.length > 0) {
        onTrackChange(tracks[0].id);
      }
      return;
    }

    if (activeIndex >= 0 && activeIndex < tracks.length - 1) {
      onTrackChange(tracks[activeIndex + 1].id);
    } else if (repeat === "all" && tracks.length > 0) {
      onTrackChange(tracks[0].id);
    } else {
      setPlaying(false);
    }
  }, [repeat, shuffle, activeTrackId, activeIndex, tracks, onTrackChange]);

  // Keep ref fresh for event listeners
  handleTrackEndRef.current = handleTrackEnd;

  // ─── Playback controls ────────────────────────────────────────

  const playAll = useCallback(() => {
    if (tracks.length > 0) {
      if (shuffle) {
        const random = tracks[Math.floor(Math.random() * tracks.length)];
        onTrackChange(random.id);
      } else {
        onTrackChange(tracks[0].id);
      }
    }
  }, [tracks, shuffle, onTrackChange]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // No track loaded yet — start the first one
    if (!activeTrack) {
      playAll();
      return;
    }

    if (audio.paused) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // eslint-disable-next-line no-console
          console.error("Audio play failed:", err);
        });
      }
    } else {
      audio.pause();
    }
  }, [activeTrack, playAll]);

  const handleNext = useCallback(() => {
    if (shuffle) {
      const otherTracks = tracks.filter((t) => t.id !== activeTrackId);
      if (otherTracks.length > 0) {
        onTrackChange(otherTracks[Math.floor(Math.random() * otherTracks.length)].id);
      }
    } else if (hasNext) {
      onTrackChange(tracks[activeIndex + 1].id);
    } else if (repeat === "all" && tracks.length > 0) {
      onTrackChange(tracks[0].id);
    }
  }, [shuffle, hasNext, activeIndex, tracks, activeTrackId, repeat, onTrackChange]);

  const handlePrev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    if (hasPrev) {
      onTrackChange(tracks[activeIndex - 1].id);
    }
  }, [hasPrev, activeIndex, tracks, onTrackChange]);

  const handleSeek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const v = Number(e.target.value);
    audio.volume = v;
    setVolume(v);
    if (v > 0 && audio.muted) {
      audio.muted = false;
      setMuted(false);
    }
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"));
  }, []);

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn("surface-panel border border-border-subtle", className)}>
      <audio ref={audioRef} preload="auto" />

      {/* ─── Now playing + timeline (scene-style) + waveform film strip ─ */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 mb-3">
          <div
            className={cn(
              "h-10 w-10 flex-shrink-0 overflow-hidden surface-card-sharp",
              !libraryCoverUrl && "flex items-center justify-center bg-surface-3",
            )}
          >
            {libraryCoverUrl ? (
              <img
                src={libraryCoverUrl}
                alt=""
                className="h-full w-full object-cover"
                decoding="async"
              />
            ) : (
              <Music className={cn("h-4 w-4", activeTrack ? "text-accent-500" : "text-text-disabled")} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {activeTrack ? (
              <>
                <p className="text-sm font-medium truncate text-text-primary">{activeTrack.title}</p>
                <p className="text-xs text-text-muted truncate">
                  {activeTrack.embeddedArtist ?? "Unknown artist"}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-text-muted">No track playing</p>
                <p className="text-xs text-text-disabled">Select a track or press play</p>
              </>
            )}
          </div>
          <span className="text-xs font-mono text-text-muted tabular-nums flex-shrink-0">
            {activeTrack ? (
              <>{formatDuration(currentTime) ?? "0:00"}<span className="text-text-disabled"> / {formatDuration(duration) ?? "0:00"}</span></>
            ) : (
              "--:--"
            )}
          </span>
        </div>

        {activeTrack && duration > 0 && (
          <div
            className="video-progress-track group/track mb-2"
            data-dragging={timelineDragging}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              timelineDraggingRef.current = true;
              setTimelineDragging(true);
              const rect = event.currentTarget.getBoundingClientRect();
              const nextPercent = Math.max(
                0,
                Math.min(1, (event.clientX - rect.left) / rect.width),
              );
              handleSeek(nextPercent * duration);
            }}
            onPointerMove={(event) => {
              if (!timelineDraggingRef.current) return;
              const rect = event.currentTarget.getBoundingClientRect();
              const nextPercent = Math.max(
                0,
                Math.min(1, (event.clientX - rect.left) / rect.width),
              );
              handleSeek(nextPercent * duration);
            }}
            onPointerUp={(event) => {
              event.currentTarget.releasePointerCapture(event.pointerId);
              timelineDraggingRef.current = false;
              setTimelineDragging(false);
            }}
            onPointerCancel={() => {
              timelineDraggingRef.current = false;
              setTimelineDragging(false);
            }}
            onPointerLeave={() => {
              if (!timelineDraggingRef.current) {
                setTimelineDragging(false);
              }
            }}
          >
            <div
              className="video-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {activeTrack && waveformData && duration > 0 && (
        <div className="border-t border-border-subtle bg-black overflow-hidden">
          <AudioWaveformFilmstrip
            peaks={waveformData}
            duration={duration}
            audioRef={audioRef}
            onSeek={handleSeek}
          />
        </div>
      )}

      {/* ─── Transport controls ─────────────────────────────────── */}
      <div className="flex items-center px-4 py-2.5 gap-1">
        <button
          type="button"
          onClick={() => setShuffle((s) => !s)}
          title={shuffle ? "Shuffle: on" : "Shuffle: off"}
          className={cn(
            "p-2 transition-colors",
            shuffle ? "text-accent-500" : "text-text-disabled hover:text-text-muted",
          )}
        >
          <Shuffle className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={handlePrev}
          disabled={!activeTrack && tracks.length === 0}
          className="p-2 text-text-muted hover:text-text-primary disabled:text-text-disabled transition-colors"
        >
          <SkipBack className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={togglePlay}
          className={cn(
            "p-3 mx-1 transition-all",
            playing
              ? "bg-accent-500 text-bg shadow-[0_0_12px_rgba(196,154,90,0.3)]"
              : "bg-surface-3 text-text-primary hover:bg-surface-4 hover:text-accent-400",
          )}
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={!activeTrack && tracks.length === 0}
          className="p-2 text-text-muted hover:text-text-primary disabled:text-text-disabled transition-colors"
        >
          <SkipForward className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={cycleRepeat}
          title={repeat === "off" ? "Repeat: off" : repeat === "all" ? "Repeat: all" : "Repeat: one"}
          className={cn(
            "p-2 transition-colors",
            repeat !== "off" ? "text-accent-500" : "text-text-disabled hover:text-text-muted",
          )}
        >
          {repeat === "one" ? <Repeat1 className="h-3.5 w-3.5" /> : <Repeat className="h-3.5 w-3.5" />}
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 group/vol">
          <button
            type="button"
            onClick={toggleMute}
            className="p-1.5 text-text-disabled hover:text-text-muted transition-colors"
          >
            <VolumeIcon className="h-3.5 w-3.5" />
          </button>
          <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-200">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-full h-1 accent-accent-500 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
