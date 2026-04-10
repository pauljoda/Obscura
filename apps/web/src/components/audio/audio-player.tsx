"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { formatDuration } from "@obscura/contracts";
import type { AudioTrackListItemDto } from "@obscura/contracts";
import { toApiUrl } from "../../lib/api";
import { AudioWaveformCanvas } from "./audio-waveform-canvas";

interface AudioPlayerProps {
  track: AudioTrackListItemDto;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

const API_BASE =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000")
    : "http://localhost:4000";

export function AudioPlayer({
  track,
  onNext,
  onPrev,
  hasNext = false,
  hasPrev = false,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(track.duration ?? 0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [waveformData, setWaveformData] = useState<number[] | null>(null);
  const prevTrackIdRef = useRef(track.id);

  // Load new track when it changes
  useEffect(() => {
    if (prevTrackIdRef.current !== track.id) {
      prevTrackIdRef.current = track.id;
      setCurrentTime(0);
      setPlaying(true);
    }
  }, [track.id]);

  // Load waveform data
  useEffect(() => {
    if (!track.waveformPath) {
      setWaveformData(null);
      return;
    }
    const url = `${API_BASE}/assets/${track.waveformPath}`;
    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        if (json.data && Array.isArray(json.data)) {
          setWaveformData(json.data);
        }
      })
      .catch(() => setWaveformData(null));
  }, [track.waveformPath]);

  // Audio element event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || track.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      // Record play
      fetch(`${API_BASE}/audio-tracks/${track.id}/play`, { method: "POST" }).catch(() => {});
      onNext?.();
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [track.id, track.duration, onNext]);

  // Auto-play on track change
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = `${API_BASE}/audio-stream/${track.id}`;
    if (playing) {
      audio.play().catch(() => {});
    }
  }, [track.id]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, []);

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

  return (
    <div className="surface-card-sharp p-4 space-y-3">
      <audio ref={audioRef} preload="metadata" />

      {/* Track info */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{track.title}</p>
          {track.embeddedArtist && (
            <p className="text-xs text-text-muted truncate">{track.embeddedArtist}</p>
          )}
        </div>
      </div>

      {/* Waveform / progress bar */}
      {waveformData ? (
        <AudioWaveformCanvas
          peaks={waveformData}
          duration={duration}
          currentTime={currentTime}
          onSeek={handleSeek}
        />
      ) : (
        <div className="relative h-10 surface-well overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-accent-500/20"
            style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%" }}
          />
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-4">
        {/* Time */}
        <span className="text-xs font-mono text-text-muted w-20">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </span>

        {/* Transport */}
        <div className="flex items-center gap-2 flex-1 justify-center">
          <button
            type="button"
            onClick={onPrev}
            disabled={!hasPrev}
            className="p-1.5 text-text-muted hover:text-text-primary disabled:text-text-disabled transition-colors"
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="p-2.5 surface-card-sharp hover:border-border-accent text-accent-500 transition-colors"
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!hasNext}
            className="p-1.5 text-text-muted hover:text-text-primary disabled:text-text-disabled transition-colors"
          >
            <SkipForward className="h-4 w-4" />
          </button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 w-28">
          <button type="button" onClick={toggleMute} className="text-text-muted hover:text-text-primary transition-colors">
            {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={handleVolumeChange}
            className="flex-1 h-1 accent-accent-500"
          />
        </div>
      </div>
    </div>
  );
}
