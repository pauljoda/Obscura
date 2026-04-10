"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { StudioItem } from "../../lib/api";
import { tagsVisibleInNsfwMode } from "../nsfw/nsfw-gate";
import type { NsfwMode } from "../nsfw/nsfw-context";

interface AudioLibraryStudioFieldProps {
  value: string;
  onChange: (value: string) => void;
  allStudios: StudioItem[];
  nsfwMode: NsfwMode;
  disabled?: boolean;
}

export function AudioLibraryStudioField({
  value,
  onChange,
  allStudios,
  nsfwMode,
  disabled,
}: AudioLibraryStudioFieldProps) {
  const [focused, setFocused] = useState(false);
  const visible = tagsVisibleInNsfwMode(allStudios, nsfwMode);
  const suggestions = visible.map((s) => ({ name: s.name }));
  const filtered = focused
    ? (value.trim()
        ? suggestions.filter(
            (s) =>
              s.name.toLowerCase().includes(value.toLowerCase()) &&
              s.name.toLowerCase() !== value.toLowerCase(),
          )
        : suggestions)
    : [];

  return (
    <div className="relative">
      <div className="text-kicker mb-1.5 flex items-center gap-2">
        <Building2 className="h-3.5 w-3.5" />
        Studio
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        disabled={disabled}
        placeholder="Studio name"
        className={cn(
          "w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-sm text-text-primary",
          "focus:outline-none focus:border-accent-500 disabled:opacity-50",
        )}
      />
      {filtered.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 top-full mt-0.5 surface-panel border border-border-subtle max-h-40 overflow-auto shadow-lg">
          {filtered.slice(0, 8).map((s) => (
            <li key={s.name}>
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 text-xs text-text-primary hover:bg-surface-2"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(s.name);
                  setFocused(false);
                }}
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
