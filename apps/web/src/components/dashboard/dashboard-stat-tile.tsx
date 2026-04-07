"use client";

import { cn } from "@obscura/ui/lib/utils";

export function DashboardStatTile({
  icon,
  label,
  value,
  accent,
  gradientClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
  gradientClass: string;
}) {
  return (
    <div
      className={cn(
        "surface-panel relative overflow-hidden p-3 flex flex-col justify-between min-h-[88px]",
        accent && "border-border-accent shadow-[var(--shadow-glow-accent)]"
      )}
    >
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[3px] opacity-90",
          gradientClass
        )}
      />
      <div className="flex items-center justify-between ml-1.5">
        <span className="text-[0.65rem] font-semibold tracking-[0.15em] uppercase text-text-muted">
          {label}
        </span>
        <div className={cn("opacity-70", accent ? "text-text-accent" : "text-text-disabled")}>
          {icon}
        </div>
      </div>
      <div
        className={cn(
          "ml-1.5 mt-2 text-xl font-mono tracking-tight",
          accent ? "text-glow-accent" : "text-text-primary"
        )}
      >
        {value}
      </div>
    </div>
  );
}
