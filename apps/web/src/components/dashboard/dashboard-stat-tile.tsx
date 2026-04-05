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
        "surface-card-sharp no-lift relative overflow-hidden p-3.5 pt-4",
        accent &&
          "border-border-accent border-t-accent-500/20 shadow-[var(--shadow-glow-accent)]"
      )}
    >
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 h-[3px] opacity-90",
          gradientClass
        )}
      />
      <div
        className={cn(
          "relative flex items-center gap-1.5 mb-1.5",
          accent ? "text-text-accent" : "text-text-disabled"
        )}
      >
        {icon}
        <span className="text-kicker" style={{ color: "inherit" }}>
          {label}
        </span>
      </div>
      <div
        className={cn(
          "relative text-lg font-semibold leading-tight tracking-tight",
          accent ? "text-glow-accent" : "text-text-primary"
        )}
      >
        {value}
      </div>
    </div>
  );
}
