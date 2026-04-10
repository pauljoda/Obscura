"use client";

import { useState, useEffect } from "react";
import { Button } from "@obscura/ui/primitives/button";
import { MapPin, X, Loader2 } from "lucide-react";
import { NsfwTagLabel, tagsVisibleInNsfwMode } from "../nsfw/nsfw-gate";
import { useNsfw } from "../nsfw/nsfw-context";

export interface TagSuggestion {
  id: string;
  name: string;
  isNsfw: boolean;
  sceneCount: number;
}

export interface TimeMarkerFormData {
  title: string;
  seconds: number;
  endSeconds: number | null;
  primaryTagName: string | null;
}

export interface TimeMarkerFormProps {
  title: string;
  seconds: number;
  endSeconds: number | null;
  tagName: string;
  allTags: TagSuggestion[];
  saving: boolean;
  onTitleChange: (v: string) => void;
  onSecondsChange: (v: number) => void;
  onEndSecondsChange: (v: number | null) => void;
  onTagNameChange: (v: string) => void;
  onSetCurrentTime: () => void;
  onSetCurrentEndTime: () => void;
  onSave: (payload: { seconds: number; endSeconds: number | null }) => void;
  onCancel: () => void;
  /** Override the save button label (default: "Save Marker") */
  saveLabel?: string;
}

export function formatSecondsInput(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Parses mm:ss, hh:mm:ss, or raw seconds. Returns null if empty or not parseable. */
export function parseTimeInput(value: string): number | null {
  const v = value.trim();
  if (v === "") return null;
  if (v.includes(":")) {
    const parts = v.split(":").map((p) => p.trim());
    if (parts.some((p) => p !== "" && Number.isNaN(Number(p)))) return null;
    if (parts.length === 2) {
      const m = Number(parts[0]) || 0;
      const s = Number(parts[1]) || 0;
      return m * 60 + s;
    }
    if (parts.length === 3) {
      const h = Number(parts[0]) || 0;
      const m = Number(parts[1]) || 0;
      const s = Number(parts[2]) || 0;
      return h * 3600 + m * 60 + s;
    }
    return null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function TimeMarkerForm({
  title,
  seconds,
  endSeconds,
  tagName,
  allTags,
  saving,
  onTitleChange,
  onSecondsChange,
  onEndSecondsChange,
  onTagNameChange,
  onSetCurrentTime,
  onSetCurrentEndTime,
  onSave,
  onCancel,
  saveLabel = "Save Marker",
}: TimeMarkerFormProps) {
  const { mode: nsfwMode } = useNsfw();
  const [startText, setStartText] = useState(() => formatSecondsInput(seconds));
  const [endText, setEndText] = useState(() =>
    endSeconds != null ? formatSecondsInput(endSeconds) : "",
  );

  useEffect(() => {
    setStartText(formatSecondsInput(seconds));
  }, [seconds]);

  useEffect(() => {
    setEndText(endSeconds != null ? formatSecondsInput(endSeconds) : "");
  }, [endSeconds]);

  function commitStartTime() {
    const parsed = parseTimeInput(startText);
    if (parsed === null) {
      setStartText(formatSecondsInput(seconds));
      return;
    }
    onSecondsChange(Math.max(0, Math.floor(parsed)));
  }

  function commitEndTime() {
    const v = endText.trim();
    if (v === "") {
      onEndSecondsChange(null);
      setEndText("");
      return;
    }
    const parsed = parseTimeInput(v);
    if (parsed === null) {
      setEndText(
        endSeconds != null ? formatSecondsInput(endSeconds) : "",
      );
      return;
    }
    onEndSecondsChange(Math.max(0, Math.floor(parsed)));
  }

  /** Parses draft fields; returns null if start (required) is invalid. */
  function readCommittedTimes(): {
    seconds: number;
    endSeconds: number | null;
  } | null {
    const startParsed = parseTimeInput(startText);
    if (startParsed === null) {
      setStartText(formatSecondsInput(seconds));
      return null;
    }
    const sec = Math.max(0, Math.floor(startParsed));
    if (endText.trim() === "") {
      return { seconds: sec, endSeconds: null };
    }
    const endParsed = parseTimeInput(endText);
    if (endParsed === null) {
      setEndText(
        endSeconds != null ? formatSecondsInput(endSeconds) : "",
      );
      return null;
    }
    return {
      seconds: sec,
      endSeconds: Math.max(0, Math.floor(endParsed)),
    };
  }

  function handleSaveClick() {
    if (!title.trim()) return;
    const payload = readCommittedTimes();
    if (!payload) return;
    onSecondsChange(payload.seconds);
    onEndSecondsChange(payload.endSeconds);
    onSave(payload);
  }

  const [tagFocused, setTagFocused] = useState(false);
  const filteredTags = tagFocused
    ? (tagName.trim()
        ? allTags.filter((t) =>
            t.name.toLowerCase().includes(tagName.toLowerCase()),
          )
        : allTags
      ).slice(0, 10)
    : [];
  const suggestionTags = tagsVisibleInNsfwMode(filteredTags, nsfwMode);

  return (
    <div className="surface-card-sharp p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs text-text-muted">Title</label>
          <input
            className="control-input w-full"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Marker title"
            autoFocus
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-text-muted">Start Time</label>
          <div className="flex items-center gap-2">
            <input
              className="control-input flex-1 min-w-0"
              value={startText}
              onChange={(e) => setStartText(e.target.value)}
              onBlur={() => commitStartTime()}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              placeholder="0:00"
            />
            <button
              type="button"
              onClick={onSetCurrentTime}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-text-muted hover:text-text-accent surface-well hover:border-border-accent transition-colors "
              title="Set to current playback time"
            >
              <MapPin className="h-3 w-3" />
              Now
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-text-muted">End Time (optional)</label>
          <div className="flex items-center gap-2">
            <input
              className="control-input flex-1 min-w-0"
              value={endText}
              onChange={(e) => setEndText(e.target.value)}
              onBlur={() => commitEndTime()}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              placeholder="—"
            />
            <button
              type="button"
              onClick={onSetCurrentEndTime}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-text-muted hover:text-text-accent surface-well hover:border-border-accent transition-colors "
              title="Set to current playback time"
            >
              <MapPin className="h-3 w-3" />
              Now
            </button>
            {endSeconds != null && (
              <button
                type="button"
                onClick={() => onEndSecondsChange(null)}
                className="flex items-center justify-center p-1.5 text-text-muted hover:text-error-text transition-colors "
                title="Clear end time"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs text-text-muted">
            Primary Tag (optional)
          </label>
          <div className="relative">
            <input
              className="control-input w-full"
              value={tagName}
              onChange={(e) => onTagNameChange(e.target.value)}
              onFocus={() => setTagFocused(true)}
              onBlur={() => setTimeout(() => setTagFocused(false), 150)}
              placeholder="Tag name"
            />
            {suggestionTags.length > 0 && (
              <div className="autocomplete-dropdown">
                {suggestionTags.map((t) => (
                  <div
                    key={t.id}
                    className="autocomplete-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onTagNameChange(t.name);
                      setTagFocused(false);
                    }}
                  >
                    <NsfwTagLabel isNsfw={t.isNsfw}>{t.name}</NsfwTagLabel>
                    <span className="autocomplete-item-count">
                      {t.sceneCount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSaveClick}
          disabled={saving || !title.trim()}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
