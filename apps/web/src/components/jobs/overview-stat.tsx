import { cn } from "@obscura/ui/lib/utils";
import type { Cpu } from "lucide-react";

export function OverviewStat({
  icon: Icon,
  label,
  value,
  detail,
  accent = false,
  danger = false,
}: {
  icon: typeof Cpu;
  label: string;
  value: number;
  detail: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "surface-panel relative overflow-hidden px-3 py-2.5 flex flex-col justify-between min-h-[72px]",
        accent && !danger && "border-border-accent shadow-[var(--shadow-glow-accent)]",
        danger && "border-status-error/30 shadow-[0_0_12px_rgba(179,79,86,0.15)]"
      )}
    >
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[3px] opacity-90",
          danger ? "bg-status-error" : accent ? "bg-accent-500" : "bg-surface-4"
        )}
      />
      <div className="flex items-center justify-between ml-1.5">
        <span className={cn("text-[0.6rem] font-semibold tracking-[0.15em] uppercase", danger ? "text-status-error-text" : "text-text-muted")}>
          {label}
        </span>
        <div className={cn("opacity-70", danger ? "text-status-error-text" : accent ? "text-text-accent" : "text-text-disabled")}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="flex items-end justify-between ml-1.5 mt-1">
        <div
          className={cn(
            "text-lg font-mono tracking-tight",
            danger
              ? "text-status-error-text"
              : accent
                ? "text-glow-accent"
                : "text-text-primary"
          )}
        >
          {value}
        </div>
        <div className="text-[0.6rem] text-text-disabled mb-0.5 truncate max-w-[60%] text-right" title={detail}>
          {detail}
        </div>
      </div>
    </div>
  );
}
