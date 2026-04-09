"use client";

import { useState, useRef, useEffect } from "react";
import { Bookmark, Check, Plus, Trash2, X } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { FilterPreset } from "../../lib/filter-presets";

interface FilterPresetDropdownProps {
  presets: FilterPreset[];
  activePresetId: string | null;
  onApplyPreset?: (preset: FilterPreset) => void;
  onSavePreset?: (name: string) => void;
  onOverwritePreset?: (id: string) => void;
  onDeletePreset?: (id: string) => void;
}

export function FilterPresetDropdown({
  presets,
  activePresetId,
  onApplyPreset,
  onSavePreset,
  onOverwritePreset,
  onDeletePreset,
}: FilterPresetDropdownProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<"idle" | "name" | "confirm">("idle");
  const [saveName, setSaveName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (saving === "name" && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [saving]);

  function handleSaveClick() {
    if (activePresetId) {
      setSaving("confirm");
    } else {
      setSaving("name");
      setSaveName("");
    }
  }

  function handleConfirmSave() {
    const trimmed = saveName.trim();
    if (!trimmed) return;
    onSavePreset?.(trimmed);
    setSaving("idle");
    setSaveName("");
    setOpen(false);
  }

  function handleOverwrite() {
    if (activePresetId) {
      onOverwritePreset?.(activePresetId);
    }
    setSaving("idle");
    setOpen(false);
  }

  function handleSaveAsNew() {
    setSaving("name");
    setSaveName("");
  }

  const activePreset = presets.find((p) => p.id === activePresetId);

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          setSaving("idle");
        }}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1.5",
          "text-[0.72rem] transition-colors duration-fast",
          activePresetId
            ? "text-text-accent bg-accent-950"
            : "text-text-muted hover:text-text-primary hover:bg-surface-2",
        )}
        title={activePreset ? `Preset: ${activePreset.name}` : "Filter presets"}
      >
        <Bookmark className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">
          {activePreset ? activePreset.name : "Presets"}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-56 surface-elevated py-1">
            {/* Preset list */}
            {presets.length > 0 ? (
              <div className="max-h-48 overflow-y-auto tag-scroll-area">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className={cn(
                      "flex items-center gap-1 w-full px-3 py-1.5 text-[0.72rem] transition-colors duration-fast group",
                      preset.id === activePresetId
                        ? "text-text-accent bg-accent-950"
                        : "text-text-muted hover:text-text-primary hover:bg-surface-3",
                    )}
                  >
                    <Check
                      className={cn(
                        "h-3 w-3 shrink-0",
                        preset.id === activePresetId ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <button
                      type="button"
                      className="flex-1 text-left truncate"
                      onClick={() => {
                        onApplyPreset?.(preset);
                        setOpen(false);
                      }}
                    >
                      {preset.name}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePreset?.(preset.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-text-disabled hover:text-error-text transition-opacity duration-fast shrink-0"
                      title="Delete preset"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-3 py-2 text-[0.68rem] text-text-disabled text-center">
                No saved presets
              </div>
            )}

            {/* Divider */}
            <div className="h-px bg-border-subtle my-1" />

            {/* Save actions */}
            {saving === "idle" && (
              <button
                type="button"
                onClick={handleSaveClick}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-[0.72rem] text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors duration-fast"
              >
                <Plus className="h-3 w-3" />
                Save current filters
              </button>
            )}

            {saving === "name" && (
              <div className="px-3 py-2 space-y-2">
                <input
                  ref={nameInputRef}
                  type="text"
                  placeholder="Preset name..."
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmSave();
                    if (e.key === "Escape") setSaving("idle");
                  }}
                  className={cn(
                    "w-full bg-surface-1 border border-border-subtle",
                    "px-2 py-1 text-[0.7rem] text-text-primary",
                    "placeholder:text-text-disabled",
                    "focus:outline-none focus:border-border-accent",
                    "transition-colors duration-fast",
                  )}
                />
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={handleConfirmSave}
                    disabled={!saveName.trim()}
                    className={cn(
                      "flex-1 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wider transition-colors duration-fast",
                      saveName.trim()
                        ? "bg-accent-900/50 text-accent-200 hover:bg-accent-800/50"
                        : "bg-surface-3 text-text-disabled cursor-not-allowed",
                    )}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaving("idle")}
                    className="px-2 py-1 text-[0.65rem] text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors duration-fast"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            {saving === "confirm" && activePreset && (
              <div className="px-3 py-2 space-y-2">
                <div className="text-[0.68rem] text-text-muted">
                  Overwrite <span className="text-text-accent">{activePreset.name}</span>?
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={handleOverwrite}
                    className="flex-1 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wider bg-accent-900/50 text-accent-200 hover:bg-accent-800/50 transition-colors duration-fast"
                  >
                    Overwrite
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAsNew}
                    className="flex-1 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors duration-fast"
                  >
                    Save as new
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSaving("idle")}
                  className="w-full text-center text-[0.6rem] text-text-disabled hover:text-text-muted transition-colors duration-fast"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
