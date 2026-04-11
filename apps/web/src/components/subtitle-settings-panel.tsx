"use client";

import { X, RotateCcw } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import {
  subtitleDisplayStyles,
  type SubtitleAppearance,
  type SubtitleDisplayStyle,
} from "@obscura/contracts";

interface SubtitleSettingsPanelProps {
  appearance: SubtitleAppearance;
  onChange: (next: SubtitleAppearance) => void;
  onClose: () => void;
  onReset: () => void;
  /** True when the user has a local override active (enables the Reset button). */
  hasLocalOverride: boolean;
}

const STYLE_LABELS: Record<SubtitleDisplayStyle, string> = {
  stylized: "Stylized",
  classic: "Classic",
  outline: "Outline",
};

const STYLE_DESCRIPTIONS: Record<SubtitleDisplayStyle, string> = {
  stylized: "Dark Room brass-edged plate",
  classic: "Flat black box, white text",
  outline: "White text with black stroke, no box",
};

export function SubtitleSettingsPanel({
  appearance,
  onChange,
  onClose,
  onReset,
  hasLocalOverride,
}: SubtitleSettingsPanelProps) {
  return (
    <div
      className="absolute right-0 top-0 bottom-0 z-20 w-[min(22rem,85%)] player-dropdown flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/80">
          Subtitle style
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-white/60 hover:text-white transition-colors"
          aria-label="Close subtitle settings"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {/* Style pickers */}
        <div className="space-y-2">
          <span className="text-[0.62rem] uppercase tracking-[0.16em] text-white/50">
            Style
          </span>
          <div className="grid grid-cols-1 gap-1.5">
            {subtitleDisplayStyles.map((style) => {
              const isActive = appearance.style === style;
              return (
                <button
                  key={style}
                  type="button"
                  onClick={() => onChange({ ...appearance, style })}
                  className={cn(
                    "flex w-full items-start justify-between gap-2 border px-2.5 py-2 text-left transition-colors duration-fast",
                    isActive
                      ? "border-accent-500/50 bg-accent-500/15 text-accent-100"
                      : "border-white/10 text-white/75 hover:border-white/25 hover:text-white",
                  )}
                >
                  <div>
                    <div className="text-[0.78rem] font-medium">
                      {STYLE_LABELS[style]}
                    </div>
                    <div className="text-[0.64rem] text-white/55">
                      {STYLE_DESCRIPTIONS[style]}
                    </div>
                  </div>
                  {isActive && (
                    <span className="text-[0.58rem] uppercase tracking-[0.16em]">
                      On
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Font scale */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[0.62rem] uppercase tracking-[0.16em] text-white/50">
              Text size
            </span>
            <span className="text-mono-tabular text-[0.7rem] text-white/80">
              {appearance.fontScale.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.05}
            value={appearance.fontScale}
            onChange={(e) =>
              onChange({ ...appearance, fontScale: Number(e.target.value) })
            }
            className="w-full accent-accent-500"
            aria-label="Subtitle text size"
          />
        </div>

        {/* Vertical position */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[0.62rem] uppercase tracking-[0.16em] text-white/50">
              Vertical position
            </span>
            <span className="text-mono-tabular text-[0.7rem] text-white/80">
              {Math.round(appearance.positionPercent)}%
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={98}
            step={1}
            value={appearance.positionPercent}
            onChange={(e) =>
              onChange({
                ...appearance,
                positionPercent: Number(e.target.value),
              })
            }
            className="w-full accent-accent-500"
            aria-label="Subtitle vertical position"
          />
        </div>

        {/* Transparency */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[0.62rem] uppercase tracking-[0.16em] text-white/50">
              Transparency
            </span>
            <span className="text-mono-tabular text-[0.7rem] text-white/80">
              {Math.round(appearance.opacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={appearance.opacity}
            onChange={(e) =>
              onChange({
                ...appearance,
                opacity: Number(e.target.value),
              })
            }
            className="w-full accent-accent-500"
            aria-label="Subtitle transparency"
          />
        </div>

        <button
          type="button"
          onClick={onReset}
          disabled={!hasLocalOverride}
          className={cn(
            "flex items-center justify-center gap-1.5 w-full border px-3 py-1.5 text-[0.72rem] transition-colors",
            hasLocalOverride
              ? "border-white/15 text-white/78 hover:border-white/30 hover:text-white"
              : "border-white/5 text-white/30 cursor-not-allowed",
          )}
        >
          <RotateCcw className="h-3 w-3" />
          Reset to library defaults
        </button>
      </div>
    </div>
  );
}
