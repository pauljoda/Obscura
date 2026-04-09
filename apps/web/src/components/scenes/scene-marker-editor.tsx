"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@obscura/ui/primitives/button";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  MapPin,
  Loader2,
} from "lucide-react";
import {
  createMarker,
  updateMarker,
  deleteMarker,
  type SceneDetail as SceneDetailType,
  type TagItem,
} from "../../lib/api";
import { NsfwTagLabel, tagsVisibleInNsfwMode } from "../nsfw/nsfw-gate";
import { useNsfw } from "../nsfw/nsfw-context";

export interface SceneMarkerEditorProps {
  scene: SceneDetailType;
  allTags: TagItem[];
  currentTimeRef: React.RefObject<number>;
  displayTime: number;
  onRefresh: () => void;
}

function formatSecondsInput(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function parseTimeInput(value: string): number {
  const parts = value.split(":").map(Number);
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  if (parts.length === 3)
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  return Number(value) || 0;
}

function MarkerForm({
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
}: {
  title: string;
  seconds: number;
  endSeconds: number | null;
  tagName: string;
  allTags: TagItem[];
  saving: boolean;
  onTitleChange: (v: string) => void;
  onSecondsChange: (v: number) => void;
  onEndSecondsChange: (v: number | null) => void;
  onTagNameChange: (v: string) => void;
  onSetCurrentTime: () => void;
  onSetCurrentEndTime: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { mode: markerNsfwMode } = useNsfw();
  const [tagFocused, setTagFocused] = useState(false);
  const filteredTags = tagFocused
    ? (tagName.trim()
        ? allTags.filter((t) =>
            t.name.toLowerCase().includes(tagName.toLowerCase()),
          )
        : allTags
      ).slice(0, 10)
    : [];
  const suggestionTags = tagsVisibleInNsfwMode(filteredTags, markerNsfwMode);

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
          Save Marker
        </Button>
      </div>
    </div>
  );
}

export function SceneMarkerEditor({
  scene,
  allTags,
  currentTimeRef,
  displayTime,
  onRefresh,
}: SceneMarkerEditorProps) {
  const { mode: nsfwMode } = useNsfw();

  const [editingMarker, setEditingMarker] = useState<string | null>(null);
  const [markerTitle, setMarkerTitle] = useState("");
  const [markerSeconds, setMarkerSeconds] = useState(0);
  const [markerEndSeconds, setMarkerEndSeconds] = useState<number | null>(null);
  const [markerTagName, setMarkerTagName] = useState("");
  const [savingMarker, setSavingMarker] = useState(false);

  function startNewMarker() {
    setEditingMarker("new");
    setMarkerTitle("");
    setMarkerSeconds(Math.floor(currentTimeRef.current));
    setMarkerEndSeconds(null);
    setMarkerTagName("");
  }

  function startEditMarker(m: SceneDetailType["markers"][0]) {
    setEditingMarker(m.id);
    setMarkerTitle(m.title);
    setMarkerSeconds(m.seconds);
    setMarkerEndSeconds(m.endSeconds);
    setMarkerTagName(m.primaryTag?.name ?? "");
  }

  function cancelMarkerEdit() {
    setEditingMarker(null);
  }

  async function handleSaveMarker() {
    if (!markerTitle.trim()) return;
    setSavingMarker(true);
    try {
      if (editingMarker === "new") {
        await createMarker(scene.id, {
          title: markerTitle.trim(),
          seconds: markerSeconds,
          endSeconds: markerEndSeconds,
          primaryTagName: markerTagName.trim() || null,
        });
      } else if (editingMarker) {
        await updateMarker(editingMarker, {
          title: markerTitle.trim(),
          seconds: markerSeconds,
          endSeconds: markerEndSeconds,
          primaryTagName: markerTagName.trim() || null,
        });
      }
      setEditingMarker(null);
      onRefresh();
    } catch {
      // silent
    } finally {
      setSavingMarker(false);
    }
  }

  async function handleDeleteMarker(markerId: string) {
    try {
      await deleteMarker(markerId);
      onRefresh();
    } catch {
      // silent
    }
  }

  return (
    <div className="space-y-3">
      {/* Add marker button */}
      {editingMarker !== "new" && (
        <Button variant="secondary" size="sm" onClick={startNewMarker}>
          <Plus className="h-3.5 w-3.5" />
          Add Marker at {formatSecondsInput(Math.floor(displayTime))}
        </Button>
      )}

      {/* New marker form */}
      {editingMarker === "new" && (
        <MarkerForm
          title={markerTitle}
          seconds={markerSeconds}
          endSeconds={markerEndSeconds}
          tagName={markerTagName}
          allTags={allTags}
          saving={savingMarker}
          onTitleChange={setMarkerTitle}
          onSecondsChange={setMarkerSeconds}
          onEndSecondsChange={setMarkerEndSeconds}
          onTagNameChange={setMarkerTagName}
          onSetCurrentTime={() =>
            setMarkerSeconds(Math.floor(currentTimeRef.current))
          }
          onSetCurrentEndTime={() =>
            setMarkerEndSeconds(Math.floor(currentTimeRef.current))
          }
          onSave={() => void handleSaveMarker()}
          onCancel={cancelMarkerEdit}
        />
      )}

      {/* Marker list */}
      {scene.markers.length === 0 && editingMarker !== "new" && (
        <div className="surface-well p-8 text-center">
          <p className="text-text-muted text-sm">No markers yet</p>
        </div>
      )}
      {scene.markers.map((marker) => {
        if (editingMarker === marker.id) {
          return (
            <MarkerForm
              key={marker.id}
              title={markerTitle}
              seconds={markerSeconds}
              endSeconds={markerEndSeconds}
              tagName={markerTagName}
              allTags={allTags}
              saving={savingMarker}
              onTitleChange={setMarkerTitle}
              onSecondsChange={setMarkerSeconds}
              onEndSecondsChange={setMarkerEndSeconds}
              onTagNameChange={setMarkerTagName}
              onSetCurrentTime={() =>
                setMarkerSeconds(Math.floor(currentTimeRef.current))
              }
              onSetCurrentEndTime={() =>
                setMarkerEndSeconds(Math.floor(currentTimeRef.current))
              }
              onSave={() => void handleSaveMarker()}
              onCancel={cancelMarkerEdit}
            />
          );
        }

        const startMin = Math.floor(marker.seconds / 60);
        const startSec = Math.floor(marker.seconds % 60);
        const timeStr = `${startMin}:${String(startSec).padStart(2, "0")}`;
        let endStr = "";
        if (marker.endSeconds) {
          const endMin = Math.floor(marker.endSeconds / 60);
          const endSec = Math.floor(marker.endSeconds % 60);
          endStr = ` \u2192 ${endMin}:${String(endSec).padStart(2, "0")}`;
        }

        return (
          <div
            key={marker.id}
            className="surface-card-sharp flex items-center gap-4 p-3 group"
          >
            <span className="text-mono-tabular text-accent-400 w-24 flex-shrink-0">
              {timeStr}
              {endStr && (
                <span className="text-text-disabled">{endStr}</span>
              )}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{marker.title}</p>
            </div>
            {marker.primaryTag &&
              (nsfwMode !== "off" || marker.primaryTag.isNsfw !== true) && (
                <span className="tag-chip tag-chip-accent flex-shrink-0">
                  <NsfwTagLabel isNsfw={marker.primaryTag.isNsfw}>
                    {marker.primaryTag.name}
                  </NsfwTagLabel>
                </span>
              )}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button
                type="button"
                onClick={() => startEditMarker(marker)}
                className="p-1 text-text-muted hover:text-text-accent transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteMarker(marker.id)}
                className="p-1 text-text-muted hover:text-error-text transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
