"use client";

import { cn } from "@obscura/ui";

export function DashboardStatusChannel({
  section,
  ledClass,
  label,
  detail,
  gradientClass,
}: {
  section: string;
  ledClass: string;
  label: string;
  detail: string;
  gradientClass: string;
}) {
  return (
    <div className="surface-card-sharp no-lift relative overflow-hidden p-4">
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-12 h-28 w-28 rotate-12 opacity-35 blur-2xl",
          gradientClass
        )}
      />
      <div className="relative flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={cn(
              "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-sm border border-border-subtle bg-surface-1/80",
              ledClass === "led-active" && "shadow-[0_0_12px_rgba(90,150,112,0.25)]",
              ledClass === "led-warning" && "shadow-[0_0_12px_rgba(184,149,69,0.2)]",
              ledClass === "led-accent" && "shadow-[var(--shadow-glow-accent)]"
            )}
          >
            <span className={`led led-sm ${ledClass}`} />
          </span>
          <span className="text-label text-text-muted truncate">{section}</span>
        </div>
        <span className="glass-chip rounded-sm px-2 py-0.5 text-[0.58rem] font-mono uppercase tracking-widest text-text-disabled flex-shrink-0">
          Live
        </span>
      </div>
      <p className="relative font-heading text-base font-semibold tracking-tight">
        {label}
      </p>
      <p className="relative text-text-muted text-sm mt-1 leading-snug">{detail}</p>
    </div>
  );
}
