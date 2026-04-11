"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2, Upload, Wand2, Trash2 } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type {
  SceneSubtitleTrackDto,
  SubtitleCueDto,
} from "@obscura/contracts";
import {
  deleteSceneSubtitle,
  extractSceneSubtitles,
  fetchSceneSubtitleCues,
  uploadSceneSubtitle,
} from "../lib/api";

interface SceneTranscriptPanelProps {
  sceneId: string;
  tracks: SceneSubtitleTrackDto[];
  activeTrackId: string | null;
  onActiveTrackIdChange: (id: string | null) => void;
  currentTime: number;
  onSeek: (time: number) => void;
  onTracksChanged: () => void;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function languageLabel(language: string): string {
  if (!language || language === "und") return "Unknown";
  try {
    const dn = new Intl.DisplayNames(undefined, { type: "language" });
    return dn.of(language) ?? language.toUpperCase();
  } catch {
    return language.toUpperCase();
  }
}

export function SceneTranscriptPanel({
  sceneId,
  tracks,
  activeTrackId,
  onActiveTrackIdChange,
  currentTime,
  onSeek,
  onTracksChanged,
}: SceneTranscriptPanelProps) {
  const [cues, setCues] = useState<SubtitleCueDto[]>([]);
  const [loadingCues, setLoadingCues] = useState(false);
  const [cuesError, setCuesError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadLanguage, setUploadLanguage] = useState("en");
  const [extractState, setExtractState] = useState<"idle" | "queued">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastUserScrollRef = useRef<number>(0);

  // Default-select the first track when available.
  useEffect(() => {
    if (tracks.length > 0 && !activeTrackId) {
      onActiveTrackIdChange(tracks[0]!.id);
    }
  }, [tracks, activeTrackId, onActiveTrackIdChange]);

  // Load cues for active track.
  useEffect(() => {
    if (!activeTrackId) {
      setCues([]);
      setCuesError(null);
      return;
    }
    let cancelled = false;
    setLoadingCues(true);
    setCuesError(null);
    fetchSceneSubtitleCues(sceneId, activeTrackId)
      .then((res) => {
        if (cancelled) return;
        setCues(res.cues);
      })
      .catch((err) => {
        if (cancelled) return;
        setCuesError((err as Error).message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingCues(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sceneId, activeTrackId]);

  // Find the index of the current cue based on playback time.
  const currentIndex = useMemo(() => {
    if (cues.length === 0) return -1;
    // Last cue whose start <= currentTime and end > currentTime.
    for (let i = cues.length - 1; i >= 0; i--) {
      const c = cues[i]!;
      if (currentTime >= c.start && currentTime < c.end) return i;
    }
    return -1;
  }, [cues, currentTime]);

  // Auto-scroll the active cue into view, but pause auto-scroll briefly
  // after a manual scroll so we don't fight the user.
  useEffect(() => {
    if (currentIndex < 0) return;
    const sinceLastUserScroll = Date.now() - lastUserScrollRef.current;
    if (sinceLastUserScroll < 3000) return;
    const container = listRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(
      `[data-cue-index="${currentIndex}"]`,
    );
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [currentIndex]);

  const handleScroll = useCallback(() => {
    lastUserScrollRef.current = Date.now();
  }, []);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadSceneSubtitle(sceneId, file, uploadLanguage);
      onTracksChanged();
    } catch (err) {
      setCuesError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleExtract() {
    if (extractState !== "idle") return;
    setExtractState("queued");
    try {
      await extractSceneSubtitles(sceneId);
    } catch (err) {
      setCuesError((err as Error).message);
    }
    setTimeout(() => {
      setExtractState("idle");
      onTracksChanged();
    }, 2500);
  }

  async function handleDelete(trackId: string) {
    try {
      await deleteSceneSubtitle(sceneId, trackId);
      if (activeTrackId === trackId) {
        onActiveTrackIdChange(null);
      }
      onTracksChanged();
    } catch (err) {
      setCuesError((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      {/* Track management row */}
      <div className="surface-card-sharp p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.7rem] uppercase tracking-[0.14em] text-text-muted">
            Tracks
          </span>
          {tracks.length === 0 ? (
            <span className="text-[0.78rem] text-text-muted">
              No subtitle tracks yet. Upload a .vtt/.srt file or extract from
              the video.
            </span>
          ) : (
            tracks.map((track) => {
              const isActive = track.id === activeTrackId;
              return (
                <div
                  key={track.id}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-1 border transition-colors duration-fast",
                    isActive
                      ? "bg-accent-950 border-border-accent text-text-accent"
                      : "border-border-default text-text-secondary hover:border-border-accent",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onActiveTrackIdChange(track.id)}
                    className="flex items-center gap-1.5 text-[0.78rem]"
                  >
                    <span>{track.label ?? languageLabel(track.language)}</span>
                    <span className="text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
                      {track.source}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(track.id)}
                    className="text-text-muted hover:text-error-text transition-colors"
                    title="Remove track"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".vtt,.srt,.ass,.ssa,text/vtt"
            className="hidden"
            onChange={(e) => void handleUpload(e)}
          />
          <input
            type="text"
            value={uploadLanguage}
            onChange={(e) => setUploadLanguage(e.target.value)}
            maxLength={8}
            placeholder="lang"
            className="w-16 border border-border-default bg-surface-1 px-2 py-1 text-[0.75rem] text-text-primary focus:border-border-accent focus:outline-none"
            aria-label="Upload language"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 border border-border-default px-2.5 py-1 text-[0.75rem] text-text-secondary hover:border-border-accent hover:text-text-accent transition-colors duration-fast disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload subtitle
          </button>
          <button
            type="button"
            onClick={() => void handleExtract()}
            disabled={extractState !== "idle"}
            className="flex items-center gap-1.5 border border-border-default px-2.5 py-1 text-[0.75rem] text-text-secondary hover:border-border-accent hover:text-text-accent transition-colors duration-fast disabled:opacity-60"
          >
            <Wand2 className="h-3.5 w-3.5" />
            {extractState === "idle" ? "Extract embedded" : "Queued"}
          </button>
        </div>
      </div>

      {/* Transcript */}
      <div className="surface-card-sharp">
        <div className="flex items-center justify-between border-b border-border-default px-3 py-2">
          <span className="text-[0.7rem] uppercase tracking-[0.14em] text-text-muted">
            Transcript
          </span>
          {cues.length > 0 && (
            <span className="text-[0.65rem] text-text-disabled">
              {cues.length} lines
            </span>
          )}
        </div>
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="surface-well max-h-[28rem] overflow-y-auto"
        >
          {loadingCues && (
            <div className="flex items-center justify-center py-10 text-text-muted text-[0.78rem]">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading cues…
            </div>
          )}
          {!loadingCues && cuesError && (
            <div className="px-3 py-6 text-[0.78rem] text-error-text">
              {cuesError}
            </div>
          )}
          {!loadingCues && !cuesError && !activeTrackId && (
            <div className="px-3 py-8 text-[0.78rem] text-text-muted text-center">
              Select a subtitle track to view its transcript.
            </div>
          )}
          {!loadingCues && !cuesError && activeTrackId && cues.length === 0 && (
            <div className="px-3 py-8 text-[0.78rem] text-text-muted text-center">
              No cues in this track.
            </div>
          )}
          {!loadingCues &&
            !cuesError &&
            cues.map((cue, idx) => {
              const isCurrent = idx === currentIndex;
              const isPast = currentIndex >= 0
                ? idx < currentIndex
                : cue.end <= currentTime;
              return (
                <button
                  key={`${cue.start}-${idx}`}
                  type="button"
                  data-cue-index={idx}
                  onClick={() => onSeek(cue.start)}
                  className={cn(
                    "block w-full text-left border-l-2 px-3 py-2 text-[0.82rem] leading-snug transition-colors duration-fast",
                    isCurrent
                      ? "border-accent-500 bg-accent-950/60 text-text-primary text-shadow-cue"
                      : isPast
                        ? "border-transparent text-text-muted opacity-60 hover:opacity-100 hover:bg-surface-2"
                        : "border-transparent text-text-secondary hover:bg-surface-2 hover:text-text-primary",
                  )}
                >
                  <span className="text-mono-tabular text-[0.65rem] uppercase tracking-[0.1em] text-text-disabled mr-2">
                    {formatTime(cue.start)}
                  </span>
                  <span className="whitespace-pre-line">{cue.text}</span>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
