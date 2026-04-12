"use client";

import { useEffect, useState } from "react";
import { cn } from "@obscura/ui/lib/utils";
import { Captions } from "lucide-react";
import {
  defaultSubtitleAppearance,
  subtitleDisplayStyles,
  type SubtitleAppearance,
  type SubtitleDisplayStyle,
} from "@obscura/contracts";
import { SubtitleCaptionOverlay } from "../subtitle-caption-overlay";
import type { LibrarySettings } from "../../lib/api";
import { ToggleCard } from "./settings-controls";

const STYLE_LABELS: Record<SubtitleDisplayStyle, string> = {
  stylized: "Stylized",
  classic: "Classic",
  outline: "Outline",
};

const STYLE_DESCRIPTIONS: Record<SubtitleDisplayStyle, string> = {
  stylized: "Dark Room brass-edged plate",
  classic: "Flat black box, plain white text",
  outline: "White text with black stroke, no box",
};

export function SubtitlesSection({
  settings,
  onToggleAutoEnable,
  onLanguagesCommit,
  onAppearanceCommit,
}: {
  settings: LibrarySettings;
  onToggleAutoEnable: (checked: boolean) => void;
  onLanguagesCommit: (value: string) => void;
  onAppearanceCommit: (next: SubtitleAppearance) => void;
}) {
  const appearance: SubtitleAppearance = {
    style: (settings.subtitleStyle ?? defaultSubtitleAppearance.style) as SubtitleDisplayStyle,
    fontScale: settings.subtitleFontScale ?? defaultSubtitleAppearance.fontScale,
    positionPercent:
      settings.subtitlePositionPercent ?? defaultSubtitleAppearance.positionPercent,
    opacity: settings.subtitleOpacity ?? defaultSubtitleAppearance.opacity,
  };

  const [langDraft, setLangDraft] = useState(
    settings.subtitlesPreferredLanguages ?? "en,eng",
  );

  useEffect(() => {
    setLangDraft(settings.subtitlesPreferredLanguages ?? "en,eng");
  }, [settings.subtitlesPreferredLanguages]);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5 px-1">
        <Captions className="h-4 w-4 text-text-accent" />
        <div>
          <h2 className="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">
            Subtitles
          </h2>
          <p className="text-[0.68rem] text-text-muted">
            Defaults applied to the video player when a scene has subtitle tracks
          </p>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <ToggleCard
          label="Auto-enable on load"
          description="Turn on subtitles automatically when a scene has a track matching your preferred languages."
          checked={settings.subtitlesAutoEnable ?? false}
          onChange={onToggleAutoEnable}
        />
        <div className="surface-card no-lift p-3.5 flex flex-col justify-between min-h-[100px]">
          <div>
            <label className="control-label" htmlFor="subtitle-lang-input">
              Preferred languages
            </label>
            <p className="text-[0.68rem] text-text-muted mt-1">
              Comma-separated priority list (e.g. <code className="text-text-accent">en,eng,en-US</code>). First match wins.
            </p>
          </div>
          <input
            id="subtitle-lang-input"
            type="text"
            value={langDraft}
            onChange={(e) => setLangDraft(e.target.value)}
            onBlur={() => {
              const next = langDraft.trim();
              if (next !== (settings.subtitlesPreferredLanguages ?? "")) {
                onLanguagesCommit(next);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
            className="mt-3 border border-border-default bg-surface-1 px-2.5 py-1.5 text-[0.82rem] text-text-primary focus:border-border-accent focus:outline-none"
            placeholder="en,eng"
          />
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="surface-card no-lift p-3.5 space-y-3">
          <div>
            <label className="control-label">Display style</label>
            <p className="text-[0.68rem] text-text-muted mt-1">
              The preview on the right updates live as you change these.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            {subtitleDisplayStyles.map((style) => {
              const isActive = appearance.style === style;
              return (
                <button
                  key={style}
                  type="button"
                  onClick={() => onAppearanceCommit({ ...appearance, style })}
                  className={cn(
                    "flex w-full items-start justify-between gap-2 border px-2.5 py-2 text-left transition-colors duration-fast",
                    isActive
                      ? "border-border-accent bg-accent-950/30 text-text-primary"
                      : "border-border-default text-text-secondary hover:border-border-accent/60",
                  )}
                >
                  <div>
                    <div className="text-[0.8rem] font-medium">{STYLE_LABELS[style]}</div>
                    <div className="text-[0.65rem] text-text-muted">
                      {STYLE_DESCRIPTIONS[style]}
                    </div>
                  </div>
                  {isActive && (
                    <span className="text-[0.58rem] uppercase tracking-[0.16em] text-text-accent">
                      On
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[0.7rem] text-text-muted uppercase tracking-[0.14em]">
                Text size
              </span>
              <span className="text-mono-sm text-text-accent">
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
                onAppearanceCommit({
                  ...appearance,
                  fontScale: Number(e.target.value),
                })
              }
              className="w-full accent-accent-500"
              aria-label="Subtitle text size"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[0.7rem] text-text-muted uppercase tracking-[0.14em]">
                Vertical position
              </span>
              <span className="text-mono-sm text-text-accent">
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
                onAppearanceCommit({
                  ...appearance,
                  positionPercent: Number(e.target.value),
                })
              }
              className="w-full accent-accent-500"
              aria-label="Subtitle vertical position"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[0.7rem] text-text-muted uppercase tracking-[0.14em]">
                Transparency
              </span>
              <span className="text-mono-sm text-text-accent">
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
                onAppearanceCommit({
                  ...appearance,
                  opacity: Number(e.target.value),
                })
              }
              className="w-full accent-accent-500"
              aria-label="Subtitle transparency"
            />
          </div>
        </div>

        {/* Live preview */}
        <div className="surface-card no-lift p-3.5 flex flex-col">
          <div>
            <label className="control-label">Preview</label>
            <p className="text-[0.68rem] text-text-muted mt-1">
              Shows how captions will render on top of a scene.
            </p>
          </div>
          <div className="relative mt-3 aspect-video w-full overflow-hidden border border-border-subtle bg-black">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#1a1f2b_0%,#0e1118_45%,#2a1f14_100%)]" />
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, rgba(255,255,255,0.6) 0, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 32px), repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 32px)",
              }}
            />
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/80 to-transparent" />
            <SubtitleCaptionOverlay
              text="This is how your subtitles will look."
              appearance={appearance}
              alwaysVisible
            />
          </div>
        </div>
      </div>
    </section>
  );
}
