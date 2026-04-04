"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Film, Users, Building2, Tag } from "lucide-react";
import { cn } from "@obscura/ui";
import { DASHBOARD_STAT_GRADIENTS } from "./dashboard-utils";

function NavTile({
  href,
  icon: Icon,
  label,
  count,
  gradientClass,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  count?: number;
  gradientClass: string;
}) {
  return (
    <Link
      href={href}
      className="surface-card-sharp group relative flex items-center gap-3 overflow-hidden p-3.5"
    >
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 opacity-90",
          gradientClass
        )}
      />
      <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-sm glass-chip border border-white/8">
        <Icon className="h-4 w-4 text-text-muted transition-colors duration-fast group-hover:text-text-accent" />
      </div>
      <div className="relative min-w-0 flex-1">
        <span className="text-sm font-medium text-text-secondary transition-colors duration-fast group-hover:text-text-primary">
          {label}
        </span>
        {count !== undefined && (
          <p className="text-mono-sm text-text-disabled mt-0.5">{count} items</p>
        )}
      </div>
      <span className="relative text-text-disabled text-xs font-mono opacity-0 transition-opacity duration-fast group-hover:opacity-100">
        →
      </span>
    </Link>
  );
}

const NAV_ITEMS: {
  href: string;
  label: string;
  icon: LucideIcon;
  countKey?: "scenes";
}[] = [
  { href: "/scenes", label: "Scenes", icon: Film, countKey: "scenes" },
  { href: "/performers", label: "Performers", icon: Users },
  { href: "/studios", label: "Studios", icon: Building2 },
  { href: "/tags", label: "Tags", icon: Tag },
];

export function DashboardQuickNav({ sceneCount }: { sceneCount?: number }) {
  return (
    <section>
      <h4 className="text-kicker mb-3">Browse</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
        {NAV_ITEMS.map((tile, i) => (
          <NavTile
            key={tile.href}
            href={tile.href}
            icon={tile.icon}
            label={tile.label}
            count={tile.countKey === "scenes" ? sceneCount : undefined}
            gradientClass={DASHBOARD_STAT_GRADIENTS[i % DASHBOARD_STAT_GRADIENTS.length]}
          />
        ))}
      </div>
    </section>
  );
}
