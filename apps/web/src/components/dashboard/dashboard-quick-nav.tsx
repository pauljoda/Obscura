"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Film, Users, Building2, Tag } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { DASHBOARD_STAT_GRADIENTS } from "./dashboard-utils";
import { useTerms } from "../../lib/terminology";

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
      className="surface-card group relative flex items-center gap-3 overflow-hidden p-3.5"
    >
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 opacity-90",
          gradientClass
        )}
      />
      <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center glass-chip border border-white/8">
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

export function DashboardQuickNav({ videoCount }: { videoCount?: number }) {
  const terms = useTerms();

  const navItems = [
    { href: "/videos", label: terms.scenes, icon: Film, count: videoCount },
    { href: "/performers", label: terms.performers, icon: Users },
    { href: "/studios", label: terms.studios, icon: Building2 },
    { href: "/tags", label: terms.tags, icon: Tag },
  ] satisfies { href: string; label: string; icon: LucideIcon; count?: number }[];

  return (
    <section aria-label="Library sections">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {navItems.map((tile, i) => (
          <NavTile
            key={tile.href}
            href={tile.href}
            icon={tile.icon}
            label={tile.label}
            count={tile.count}
            gradientClass={DASHBOARD_STAT_GRADIENTS[i % DASHBOARD_STAT_GRADIENTS.length]}
          />
        ))}
      </div>
    </section>
  );
}
