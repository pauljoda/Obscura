"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { cn } from "@obscura/ui";

export interface DashboardHeroProps {
  loading: boolean;
  sceneCount: number | null;
  scheduleEnabled: boolean;
  intervalMinutes: number;
  queueCount: number;
}

function useLocalClock(tickMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  return now;
}

export function DashboardHero({
  loading,
  sceneCount,
  scheduleEnabled,
  intervalMinutes,
  queueCount,
}: DashboardHeroProps) {
  const now = useLocalClock();
  const timeStr = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <section className="relative overflow-hidden rounded-sm border border-border-accent/30 shadow-[var(--shadow-glow-accent)]">
      <div className="pointer-events-none absolute -right-28 -top-32 h-80 w-80 rounded-sm bg-accent-600/15 blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 gradient-thumb-5 opacity-45 blur-[70px]" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-500/35 to-transparent"
      />

      <div className="relative border-b border-border-accent/10 bg-surface-2/80 backdrop-blur-xl">
        <div className="px-5 py-6 md:px-8 md:py-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-4 min-w-0">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-sm glass-chip-accent shadow-[var(--shadow-glow-accent)]">
                <Activity className="h-7 w-7 text-accent-400" />
              </div>
              <div className="min-w-0">
                <p className="text-kicker text-accent-400/90 mb-1">Overview</p>
                <h1 className="text-2xl font-semibold tracking-tight md:text-[1.65rem]">
                  Dashboard
                </h1>
                <p className="mt-1.5 max-w-md text-[0.8rem] text-text-muted leading-relaxed">
                  Quick readout: counts, what just landed, queues, and jobs.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row lg:flex-col lg:items-end">
              <div className="glass-chip rounded-sm px-4 py-3 text-right min-w-[200px] border border-white/5">
                <p className="text-mono-sm text-text-disabled uppercase tracking-widest">
                  Local time
                </p>
                <p className="text-mono-tabular text-lg text-text-primary mt-0.5 tabular-nums">
                  {timeStr}
                </p>
                <p className="text-[0.7rem] text-text-muted mt-0.5">{dateStr}</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <span className="glass-chip rounded-sm px-2.5 py-1 text-[0.65rem] font-medium text-text-muted border border-white/5">
                  {loading ? "…" : `${sceneCount ?? 0} scenes indexed`}
                </span>
                <span
                  className={cn(
                    "rounded-sm px-2.5 py-1 text-[0.65rem] font-medium border",
                    scheduleEnabled
                      ? "glass-chip-accent text-accent-100"
                      : "glass-chip text-text-muted border-white/5"
                  )}
                >
                  Auto scan {scheduleEnabled ? `· ${intervalMinutes}m` : "off"}
                </span>
                <span className="glass-chip rounded-sm px-2.5 py-1 text-[0.65rem] font-mono text-text-muted border border-white/5">
                  {queueCount} queue{queueCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
