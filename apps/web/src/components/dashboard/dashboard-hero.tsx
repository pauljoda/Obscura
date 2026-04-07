import { Logo } from "../logo";
import { Film, Clock, HardDrive, TrendingUp } from "lucide-react";
import { DashboardStatTile } from "./dashboard-stat-tile";
import { DASHBOARD_STAT_GRADIENTS } from "./dashboard-utils";
import type { SceneStats } from "../../lib/api";

export interface DashboardHeroProps {
  stats: SceneStats | null;
}

export function DashboardHero({ stats }: DashboardHeroProps) {
  return (
    <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 pt-2 pb-1">
      <div className="flex justify-center lg:justify-start w-full lg:w-auto">
        <Logo size={48} className="gap-4" textClassName="text-2xl tracking-[0.18em]" />
      </div>
      
      <div className="w-full lg:w-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <DashboardStatTile
            icon={<Film className="h-4 w-4" />}
            label="Scenes"
            value={String(stats?.totalScenes ?? 0)}
            gradientClass={DASHBOARD_STAT_GRADIENTS[0]}
          />
          <DashboardStatTile
            icon={<Clock className="h-4 w-4" />}
            label="Duration"
            value={stats?.totalDurationFormatted ?? "—"}
            gradientClass={DASHBOARD_STAT_GRADIENTS[1]}
          />
          <DashboardStatTile
            icon={<HardDrive className="h-4 w-4" />}
            label="Storage"
            value={stats?.totalSizeFormatted ?? "—"}
            gradientClass={DASHBOARD_STAT_GRADIENTS[2]}
          />
          <DashboardStatTile
            icon={<TrendingUp className="h-4 w-4" />}
            label="This Week"
            value={`+${stats?.recentCount ?? 0}`}
            accent
            gradientClass={DASHBOARD_STAT_GRADIENTS[3]}
          />
        </div>
      </div>
    </header>
  );
}
