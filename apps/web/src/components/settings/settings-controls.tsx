"use client";

import { useEffect, useState } from "react";
import { cn } from "@obscura/ui/lib/utils";
import { Minus, Plus } from "lucide-react";

export function ToggleCard({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "surface-card no-lift p-3.5 text-left transition-all duration-normal group flex flex-col justify-between min-h-[100px]",
        checked ? "border-border-accent/40 bg-surface-2/30" : "opacity-85 hover:opacity-100",
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2 w-full">
        <p className={cn("text-sm font-medium transition-colors", checked ? "text-text-primary" : "text-text-secondary")}>{label}</p>
        <div className={cn("relative w-9 h-5 border transition-colors duration-fast shrink-0", checked ? "border-border-accent bg-accent-950/30" : "border-border-default bg-surface-1 shadow-well")}>
          <div className={cn("absolute top-0.5 bottom-0.5 w-3.5 bg-surface-3 border border-border-subtle transition-all duration-fast flex items-center justify-center shadow-sm", checked ? "left-[1.1rem] border-border-accent" : "left-0.5")}>
            <div className={cn("led led-sm", checked ? "led-active" : "led-idle")} />
          </div>
        </div>
      </div>
      <p className="text-[0.72rem] text-text-muted leading-relaxed">{description}</p>
    </button>
  );
}

function qualityLabel(value: number): string {
  if (value <= 1) return "Native";
  if (value <= 2) return "High";
  if (value <= 5) return "Good";
  if (value <= 10) return "Medium";
  if (value <= 15) return "Low";
  if (value <= 20) return "Very Low";
  return "Minimum";
}

export function QualitySlider({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <div className="surface-card no-lift p-3.5 flex flex-col justify-between min-h-[100px]">
      <div className="flex items-start justify-between mb-4">
        <div>
          <label className="control-label">{label}</label>
          <p className="text-[0.65rem] text-text-muted mt-1">1 is native, 31 is smallest</p>
        </div>
        <span className="text-mono-sm px-2 py-0.5 bg-surface-1 border border-border-subtle text-text-accent shadow-well">
          {qualityLabel(draft)} ({draft})
        </span>
      </div>
      <div className="relative pt-2 pb-1">
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 bg-surface-4 border border-border-subtle shadow-well" />
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-gradient-to-r from-accent-700 to-accent-500 shadow-[0_0_8px_rgba(199,155,92,0.3)]" style={{ width: `${((draft - 1) / 30) * 100}%` }} />
        <input
          type="range"
          min={1}
          max={31}
          step={1}
          value={draft}
          onChange={(event) => setDraft(Number(event.target.value))}
          onMouseUp={commit}
          onTouchEnd={commit}
          onKeyUp={commit}
          className="relative w-full h-1.5 appearance-none bg-transparent cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:bg-surface-2 [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-border-accent [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(0,0,0,0.8)] z-10"
        />
      </div>
    </div>
  );
}

export function NumberStepper({
  label,
  description,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="surface-card no-lift p-3.5 flex flex-col justify-between min-h-[100px]">
      <div className="mb-3">
        <label className="control-label mb-1">{label}</label>
        <p className="text-[0.68rem] text-text-muted">{description}</p>
      </div>
      <div className="flex items-center bg-surface-1 border border-border-default shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="px-3 py-1.5 text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors border-r border-border-subtle"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 text-center font-mono text-[0.85rem] text-text-primary py-1.5">
          {value}
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          className="px-3 py-1.5 text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors border-l border-border-subtle"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function StorageStat({
  accent,
  label,
  value,
  gradientClass,
}: {
  accent?: boolean;
  label: string;
  value: string;
  gradientClass?: string;
}) {
  return (
    <div
      className={cn(
        "surface-panel relative overflow-hidden px-3 py-2.5 flex flex-col justify-between min-h-[72px]",
        accent && "border-border-accent shadow-[var(--shadow-glow-accent)]"
      )}
    >
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[3px] opacity-90",
          gradientClass || (accent ? "bg-accent-500" : "bg-surface-4")
        )}
      />
      <div className="flex items-center justify-between ml-1.5">
        <span className="text-[0.6rem] font-semibold tracking-[0.15em] uppercase text-text-muted">
          {label}
        </span>
      </div>
      <div
        className={cn(
          "ml-1.5 mt-1 text-lg font-mono tracking-tight",
          accent ? "text-glow-accent" : "text-text-primary"
        )}
      >
        {value}
      </div>
    </div>
  );
}
