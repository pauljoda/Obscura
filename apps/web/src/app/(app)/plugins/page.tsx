"use client";

import { useEffect, useState } from "react";
import { cn } from "@obscura/ui";
import {
  Loader2,
  Package,
  Puzzle,
  Globe,
  Boxes,
  Plug,
} from "lucide-react";
import { fetchInstalledScrapers, fetchStashBoxEndpoints, type ScraperPackage, type StashBoxEndpoint } from "../../../lib/api";
import { useNsfw } from "../../../components/nsfw/nsfw-context";

type PluginsTab = "installed" | "stash-index" | "stashbox";

export default function PluginsPage() {
  const [tab, setTab] = useState<PluginsTab>("installed");
  const [scrapers, setScrapers] = useState<ScraperPackage[]>([]);
  const [endpoints, setEndpoints] = useState<StashBoxEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const { mode } = useNsfw();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [scrapersRes, endpointsRes] = await Promise.all([
          fetchInstalledScrapers(),
          fetchStashBoxEndpoints().catch(() => ({ endpoints: [] })),
        ]);
        setScrapers(scrapersRes.packages);
        setEndpoints(endpointsRes.endpoints);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  const nsfwScraperCount = scrapers.length; // All stash scrapers are NSFW
  const sfwPluginCount = 0; // No Obscura-native plugins installed yet (placeholder)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2.5">
          <Puzzle className="h-5 w-5 text-text-accent" />
          Plugins
        </h1>
        <p className="mt-1 text-text-muted text-[0.78rem]">
          Install and manage identification plugins for metadata matching
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="surface-stat px-3 py-2">
          <span className="text-kicker !text-text-disabled">Installed</span>
          <div className="text-lg font-semibold text-text-primary leading-tight">
            {scrapers.length + sfwPluginCount}
          </div>
        </div>
        <div className="surface-stat px-3 py-2">
          <span className="text-kicker !text-text-disabled">Stash (NSFW)</span>
          <div className="text-lg font-semibold text-text-primary leading-tight">{nsfwScraperCount}</div>
        </div>
        <div className="surface-stat px-3 py-2">
          <span className="text-kicker !text-text-disabled">StashBox Endpoints</span>
          <div className="text-lg font-semibold text-text-primary leading-tight">{endpoints.length}</div>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hidden">
        {([
          { key: "installed" as PluginsTab, label: "Installed", icon: Boxes },
          { key: "stash-index" as PluginsTab, label: "Stash Community", icon: Globe },
          { key: "stashbox" as PluginsTab, label: "StashBox Endpoints", icon: Plug },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-fast",
              tab === key
                ? "bg-accent-950 text-text-accent border border-border-accent shadow-[var(--shadow-glow-accent)]"
                : "text-text-muted border border-transparent hover:text-text-secondary hover:bg-surface-3/40",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "installed" && (
        <InstalledPluginsSection scrapers={scrapers} mode={mode} />
      )}

      {tab === "stash-index" && (
        <div className="surface-card no-lift p-8 text-center">
          <Globe className="h-8 w-8 text-text-disabled mx-auto mb-3" />
          <p className="text-text-muted text-sm">
            Community scraper index browser will be migrated here from the Scrapers page.
          </p>
          <a href="/scrapers" className="text-text-accent text-xs mt-2 inline-block hover:underline">
            Open legacy Scrapers page →
          </a>
        </div>
      )}

      {tab === "stashbox" && (
        <StashBoxSection endpoints={endpoints} />
      )}
    </div>
  );
}

/* ─── Installed Plugins Section ──────────────────────────────── */

function InstalledPluginsSection({
  scrapers,
  mode,
}: {
  scrapers: ScraperPackage[];
  mode: string;
}) {
  if (scrapers.length === 0) {
    return (
      <div className="surface-card no-lift p-8 text-center">
        <Package className="h-8 w-8 text-text-disabled mx-auto mb-3" />
        <p className="text-text-muted text-sm">No plugins installed yet.</p>
        <p className="text-text-disabled text-xs mt-1">
          Install scrapers from the Stash Community tab or add Obscura plugins.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {scrapers.map((scraper) => (
        <div
          key={scraper.id}
          className="surface-card no-lift p-3 flex items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[0.8rem] font-medium truncate">{scraper.name}</p>
              <span className="tag-chip tag-chip-default text-[0.55rem]">Stash</span>
              <span className="tag-chip text-[0.55rem] bg-status-error/10 text-status-error-text border border-status-error/20">
                NSFW
              </span>
              <span className={cn(
                "tag-chip text-[0.55rem]",
                scraper.enabled ? "tag-chip-accent" : "tag-chip-default opacity-50",
              )}>
                {scraper.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <p className="text-text-disabled text-[0.65rem] mt-0.5">
              {scraper.packageId} · v{scraper.version}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── StashBox Endpoints Section ─────────────────────────────── */

function StashBoxSection({ endpoints }: { endpoints: StashBoxEndpoint[] }) {
  if (endpoints.length === 0) {
    return (
      <div className="surface-card no-lift p-8 text-center">
        <Plug className="h-8 w-8 text-text-disabled mx-auto mb-3" />
        <p className="text-text-muted text-sm">No StashBox endpoints configured.</p>
        <p className="text-text-disabled text-xs mt-1">
          Add endpoints in Settings to connect to StashDB, ThePornDB, and other databases.
        </p>
        <a href="/settings" className="text-text-accent text-xs mt-2 inline-block hover:underline">
          Open Settings →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {endpoints.map((ep) => (
        <div
          key={ep.id}
          className="surface-card no-lift p-3 flex items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[0.8rem] font-medium truncate">{ep.name}</p>
              <span className="tag-chip text-[0.55rem] bg-status-error/10 text-status-error-text border border-status-error/20">
                NSFW
              </span>
              <span className={cn(
                "tag-chip text-[0.55rem]",
                ep.enabled ? "tag-chip-accent" : "tag-chip-default opacity-50",
              )}>
                {ep.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <p className="text-text-disabled text-[0.65rem] mt-0.5 truncate">
              {ep.endpoint}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
