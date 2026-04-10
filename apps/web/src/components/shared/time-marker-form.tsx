"use client";

import { useState } from "react";
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
  onSave: () => void;
  onCancel: () => void;
  /** Override the save button label (default: "Save Marker") */
  saveLabel?: string;
}

export function formatSecondsInput(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function parseTimeInput(value: string): number {
  const parts = value.split(":").map(Number);
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  if (parts.length === 3)
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  return Number(value) || 0;
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
              className="control-input flex-1"
              value={formatSecondsInput(seconds)}
              onChange={(e) => onSecondsChange(parseTimeInput(e.target.value))}
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
              className="control-input flex-1"
              value={endSeconds != null ? formatSecondsInput(endSeconds) : ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                onEndSecondsChange(v ? parseTimeInput(v) : null);
              }}
              placeholder="\u2014"
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
          onClick={onSave}
          disabled={saving || !title.trim()}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}
