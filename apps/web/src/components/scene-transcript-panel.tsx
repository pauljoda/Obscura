"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Trash2,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type {
  SceneSubtitleTrackDto,
  SubtitleCueDto,
} from "@obscura/contracts";
import {
  deleteSceneSubtitle,
  extractSceneSubtitles,
  fetchSceneSubtitleCues,
  updateSceneSubtitle,
  uploadSceneSubtitle,
} from "../lib/api";

export type TranscriptPanelVariant = "full" | "tracks-only" | "list-only";

interface SceneTranscriptPanelProps {
  sceneId: string;
  tracks: SceneSubtitleTrackDto[];
  activeTrackId: string | null;
  onActiveTrackIdChange: (id: string | null) => void;
  currentTime: number;
  onSeek: (time: number) => void;
  onTracksChanged: () => void;
  /** Which sections of the panel to render. Default "full". */
  variant?: TranscriptPanelVariant;
  /** Whether the panel is currently docked next to the video. */
  isDocked?: boolean;
  /** If provided, renders a dock/undock toggle button (desktop only). */
  onDockToggle?: () => void;
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
  variant = "full",
  isDocked = false,
  onDockToggle,
}: SceneTranscriptPanelProps) {
  const showTrackManagement = variant !== "list-only";
  const showTranscriptList = variant !== "tracks-only";
  const isListOnly = variant === "list-only";
  const [cues, setCues] = useState<SubtitleCueDto[]>([]);
  const [loadingCues, setLoadingCues] = useState(false);
  const [cuesError, setCuesError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadLanguage, setUploadLanguage] = useState("en");
  const [extractState, setExtractState] = useState<"idle" | "queued">("idle");
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editDraftLabel, setEditDraftLabel] = useState("");
  const [editDraftLanguage, setEditDraftLanguage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastUserScrollRef = useRef<number>(0);
  const isAutoScrollingRef = useRef(false);

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

  // Auto-scroll the active cue into view WITHIN the list container only —
  // never the page viewport. We use getBoundingClientRect() rather than
  // offsetTop so this works regardless of which ancestor is the
  // offsetParent. Target: the active cue sits vertically centered in the
  // list's visible area.
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

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    // Distance from the top of the container's visible area to the top of
    // the cue. Positive = cue is below the top; negative = above.
    const elOffsetFromVisibleTop = elRect.top - containerRect.top;
    // Where the cue *should* sit: visually centered.
    const desiredOffset = container.clientHeight / 2 - el.clientHeight / 2;
    // How far the container needs to scroll to put it there.
    const delta = elOffsetFromVisibleTop - desiredOffset;

    if (Math.abs(delta) < 2) return;

    const nextScrollTop = Math.max(
      0,
      Math.min(
        container.scrollTop + delta,
        container.scrollHeight - container.clientHeight,
      ),
    );

    // Flag the next scroll event as programmatic so handleScroll doesn't
    // treat it as a user action and trip the 3-second cooldown.
    isAutoScrollingRef.current = true;
    container.scrollTo({ top: nextScrollTop, behavior: "smooth" });
    // Release the flag a tick later — smooth scroll fires multiple events.
    window.setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, 500);
  }, [currentIndex]);

  const handleScroll = useCallback(() => {
    if (isAutoScrollingRef.current) return;
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

  function startEditingTrack(track: SceneSubtitleTrackDto) {
    setEditingTrackId(track.id);
    setEditDraftLabel(track.label ?? "");
    setEditDraftLanguage(track.language);
  }

  function cancelEditingTrack() {
    setEditingTrackId(null);
    setEditDraftLabel("");
    setEditDraftLanguage("");
  }

  async function saveEditingTrack() {
    if (!editingTrackId) return;
    const trackId = editingTrackId;
    const patch: { language?: string; label?: string | null } = {
      label: editDraftLabel.trim() === "" ? null : editDraftLabel.trim(),
    };
    if (editDraftLanguage.trim()) patch.language = editDraftLanguage.trim();
    try {
      await updateSceneSubtitle(sceneId, trackId, patch);
      cancelEditingTrack();
      onTracksChanged();
    } catch (err) {
      setCuesError((err as Error).message);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col",
        isListOnly ? "h-full min-h-0 space-y-0" : "space-y-4",
      )}
    >
      {/* Track management row */}
      {showTrackManagement && (
      <div className="surface-card-sharp p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.7rem] uppercase tracking-[0.14em] text-text-muted">
            Tracks
          </span>
          {onDockToggle && (
            <button
              type="button"
              onClick={onDockToggle}
              className="hidden lg:inline-flex items-center gap-1.5 border border-border-default px-2 py-0.5 text-[0.65rem] text-text-muted hover:border-border-accent hover:text-text-accent transition-colors duration-fast"
              title={
                isDocked
                  ? "Move transcript back into this tab"
                  : "Dock transcript next to the video"
              }
            >
              {isDocked ? (
                <PanelRightClose className="h-3 w-3" />
              ) : (
                <PanelRightOpen className="h-3 w-3" />
              )}
              {isDocked ? "Undock" : "Dock next to video"}
            </button>
          )}
        </div>
        {tracks.length === 0 ? (
          <div className="text-[0.78rem] text-text-muted">
            No subtitle tracks yet. Upload a .vtt/.srt file or extract from
            the video.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {tracks.map((track) => {
              const isActive = track.id === activeTrackId;
              const isEditing = editingTrackId === track.id;
              const lang = languageLabel(track.language);
              return (
                <div
                  key={track.id}
                  className={cn(
                    "flex items-center gap-2 border px-2.5 py-1.5 transition-colors duration-fast",
                    isActive
                      ? "bg-accent-950 border-border-accent"
                      : "border-border-default hover:border-border-accent",
                  )}
                >
                  {isEditing ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input
                        type="text"
                        value={editDraftLanguage}
                        onChange={(e) => setEditDraftLanguage(e.target.value)}
                        maxLength={8}
                        placeholder="lang"
                        className="w-16 border border-border-default bg-surface-1 px-2 py-0.5 text-[0.72rem] text-text-primary focus:border-border-accent focus:outline-none"
                        aria-label="Track language"
                      />
                      <input
                        type="text"
                        value={editDraftLabel}
                        onChange={(e) => setEditDraftLabel(e.target.value)}
                        maxLength={80}
                        placeholder="Display name (e.g. SDH, Forced)"
                        className="flex-1 border border-border-default bg-surface-1 px-2 py-0.5 text-[0.75rem] text-text-primary focus:border-border-accent focus:outline-none"
                        aria-label="Track display name"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveEditingTrack();
                          if (e.key === "Escape") cancelEditingTrack();
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void saveEditingTrack()}
                        className="text-text-accent hover:text-text-accent-bright transition-colors"
                        title="Save"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditingTrack}
                        className="text-text-muted hover:text-text-primary transition-colors"
                        title="Cancel"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onActiveTrackIdChange(track.id)}
                        className="flex-1 flex items-center gap-2 text-left"
                      >
                        <span
                          className={cn(
                            "text-[0.78rem] font-medium",
                            isActive ? "text-text-accent" : "text-text-primary",
                          )}
                        >
                          {lang}
                        </span>
                        {track.label && (
                          <span
                            className={cn(
                              "text-[0.7rem]",
                              isActive ? "text-text-accent/80" : "text-text-muted",
                            )}
                          >
                            — {track.label}
                          </span>
                        )}
                        <span className="ml-auto flex items-center gap-1.5">
                          <span
                            className="border border-border-default px-1.5 py-px text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-text-muted"
                            title={`Original format: ${track.sourceFormat}`}
                          >
                            {track.sourceFormat}
                          </span>
                          <span className="text-[0.58rem] uppercase tracking-[0.14em] text-text-muted">
                            {track.source}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditingTrack(track)}
                        className="text-text-muted hover:text-text-accent transition-colors"
                        title="Rename track"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(track.id)}
                        className="text-text-muted hover:text-error-text transition-colors"
                        title="Remove track"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

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
      )}

      {/* Transcript */}
      {showTranscriptList && (
      <div
        className={cn(
          "surface-card-sharp flex flex-col",
          isListOnly && "flex-1 min-h-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-border-default px-3 py-2">
          <span className="text-[0.7rem] uppercase tracking-[0.14em] text-text-muted">
            Transcript
          </span>
          <div className="flex items-center gap-2">
            {cues.length > 0 && (
              <span className="text-[0.65rem] text-text-disabled">
                {cues.length} lines
              </span>
            )}
            {isListOnly && onDockToggle && (
              <button
                type="button"
                onClick={onDockToggle}
                className="text-text-muted hover:text-text-accent transition-colors"
                title="Move transcript back into the tab"
                aria-label="Undock transcript"
              >
                <PanelRightClose className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <div
          ref={listRef}
          onScroll={handleScroll}
          className={cn(
            "surface-well overflow-y-auto",
            isListOnly ? "flex-1 min-h-0" : "max-h-[28rem]",
          )}
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
      )}
    </div>
  );
}
