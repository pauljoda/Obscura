"use client";

import { useState } from "react";
import { Button } from "@obscura/ui/primitives/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  createMarker,
  updateMarker,
  deleteMarker,
  type SceneDetail as SceneDetailType,
} from "../../lib/api";
import {
  TimeMarkerForm,
  formatSecondsInput,
} from "../shared/time-marker-form";

export interface SceneMarkerEditorProps {
  scene: SceneDetailType;
  currentTimeRef: React.RefObject<number>;
  displayTime: number;
  onRefresh: () => void;
}

export function SceneMarkerEditor({
  scene,
  currentTimeRef,
  displayTime,
  onRefresh,
}: SceneMarkerEditorProps) {
  const [editingMarker, setEditingMarker] = useState<string | null>(null);
  const [markerTitle, setMarkerTitle] = useState("");
  const [markerSeconds, setMarkerSeconds] = useState(0);
  const [markerEndSeconds, setMarkerEndSeconds] = useState<number | null>(null);
  const [savingMarker, setSavingMarker] = useState(false);

  function startNewMarker() {
    setEditingMarker("new");
    setMarkerTitle("");
    setMarkerSeconds(Math.floor(currentTimeRef.current));
    setMarkerEndSeconds(null);
  }

  function startEditMarker(m: SceneDetailType["markers"][0]) {
    setEditingMarker(m.id);
    setMarkerTitle(m.title);
    setMarkerSeconds(m.seconds);
    setMarkerEndSeconds(m.endSeconds);
  }

  function cancelMarkerEdit() {
    setEditingMarker(null);
  }

  async function handleSaveMarker(payload: {
    seconds: number;
    endSeconds: number | null;
  }) {
    if (!markerTitle.trim()) return;
    setSavingMarker(true);
    try {
      if (editingMarker === "new") {
        await createMarker(scene.id, {
          title: markerTitle.trim(),
          seconds: payload.seconds,
          endSeconds: payload.endSeconds,
        });
      } else if (editingMarker) {
        await updateMarker(editingMarker, {
          title: markerTitle.trim(),
          seconds: payload.seconds,
          endSeconds: payload.endSeconds,
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

  const markerFormProps = {
    title: markerTitle,
    seconds: markerSeconds,
    endSeconds: markerEndSeconds,
    saving: savingMarker,
    onTitleChange: setMarkerTitle,
    onSecondsChange: setMarkerSeconds,
    onEndSecondsChange: setMarkerEndSeconds,
    onSetCurrentTime: () =>
      setMarkerSeconds(Math.floor(currentTimeRef.current)),
    onSetCurrentEndTime: () =>
      setMarkerEndSeconds(Math.floor(currentTimeRef.current)),
    onSave: (payload: { seconds: number; endSeconds: number | null }) =>
      void handleSaveMarker(payload),
    onCancel: cancelMarkerEdit,
  };

  return (
    <div className="space-y-3">
      {editingMarker !== "new" && (
        <Button variant="secondary" size="sm" onClick={startNewMarker}>
          <Plus className="h-3.5 w-3.5" />
          Add Marker at {formatSecondsInput(Math.floor(displayTime))}
        </Button>
      )}

      {editingMarker === "new" && <TimeMarkerForm {...markerFormProps} />}

      {scene.markers.length === 0 && editingMarker !== "new" && (
        <div className="surface-well p-8 text-center">
          <p className="text-text-muted text-sm">No markers yet</p>
        </div>
      )}
      {scene.markers.map((marker) => {
        if (editingMarker === marker.id) {
          return <TimeMarkerForm key={marker.id} {...markerFormProps} />;
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
