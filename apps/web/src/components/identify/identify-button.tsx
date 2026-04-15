"use client";

/**
 * Identify-on-detail-page button.
 *
 * Renders a compact button + popover for individual movie / episode
 * / series identification from the detail pages. Spec §9.4 calls for
 * "Identify Movie" / "Identify Series" / "Re-identify this episode"
 * entry points on the respective detail surfaces — this component
 * is the single implementation behind all three.
 *
 * Flow:
 *
 *   1. On mount, list enabled plugins and filter to ones whose
 *      manifest capabilities include the action we need for this
 *      entity kind (movie → movieByName, episode → episodeByName /
 *      episodeByFragment, series → seriesCascade / seriesByName).
 *   2. Click → popover lists eligible plugins. One click runs
 *      `executePlugin` against the chosen plugin with the right
 *      input shape and `saveResult: true`, which persists a
 *      `scrape_results` row with the normalized payload in
 *      `proposedResult`.
 *   3. As soon as the plugin returns, open the existing
 *      `CascadeReviewDrawer` keyed on the resulting scrape-result
 *      id. The drawer handles image selection, per-field masking,
 *      and the `/video/{movies,series,episodes}/:id/accept-scrape`
 *      submit.
 */

import { useEffect, useState } from "react";
import { cn } from "@obscura/ui/lib/utils";
import { Loader2, ScanSearch, AlertCircle } from "lucide-react";
import {
  executePlugin,
  fetchInstalledPlugins,
  type InstalledPlugin,
} from "../../lib/api/scrapers";
import { useNsfwAwareProviders } from "../../hooks/use-nsfw-aware-providers";
import { CascadeReviewDrawer } from "./cascade-review-drawer";

type EntityKind = "video_series" | "video_movie" | "video_episode";

export interface IdentifyButtonProps {
  /** Which entity is being identified (drives plugin filter + drawer mode). */
  entityKind: EntityKind;
  entityId: string;
  /** Display title — passed to the drawer header and used as plugin seek input. */
  title: string;
  /**
   * Optional label override. Defaults to "Identify Movie" / "Identify Series"
   * / "Re-identify" depending on kind.
   */
  label?: string;
  className?: string;
}

/** Which plugin capability keys are relevant for each entity kind. */
const CAPABILITY_BY_KIND: Record<EntityKind, string[]> = {
  video_series: ["seriesCascade", "seriesByName", "folderByName"],
  video_movie: ["movieByName", "videoByName"],
  video_episode: ["episodeByName", "episodeByFragment", "videoByName"],
};

/** Which plugin action we execute per kind. The first match wins. */
const ACTION_BY_KIND: Record<EntityKind, string[]> = {
  video_series: ["seriesCascade", "seriesByName", "folderByName"],
  video_movie: ["movieByName", "videoByName"],
  video_episode: ["episodeByName", "episodeByFragment", "videoByName"],
};

export function IdentifyButton({
  entityKind,
  entityId,
  title,
  label,
  className,
}: IdentifyButtonProps) {
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [loadingPlugins, setLoadingPlugins] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<string | null>(null);

  // Lazily load the plugin list the first time the popover opens.
  useEffect(() => {
    if (!open || plugins.length > 0 || loadingPlugins) return;
    setLoadingPlugins(true);
    fetchInstalledPlugins()
      .then((list) => setPlugins(list.filter((p) => p.enabled)))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load plugins"),
      )
      .finally(() => setLoadingPlugins(false));
  }, [open, plugins.length, loadingPlugins]);

  // Hide NSFW plugins while the user is in SFW mode. `useNsfwAwareProviders`
  // is a pure derived hook — it reads the current nsfw mode from context
  // and filters the list so the popover never offers an NSFW provider
  // the user is explicitly trying to avoid.
  const visiblePlugins = useNsfwAwareProviders(plugins);

  const eligibleCapabilities = CAPABILITY_BY_KIND[entityKind];
  const eligible = visiblePlugins.filter((p) => {
    const caps = p.capabilities ?? {};
    return eligibleCapabilities.some((key) => !!caps[key]);
  });

  const defaultLabel =
    label ??
    (entityKind === "video_movie"
      ? "Identify Movie"
      : entityKind === "video_series"
        ? "Identify Series"
        : "Re-identify");

  /** Pick the first action the plugin supports for this kind. */
  function actionFor(plugin: InstalledPlugin): string | null {
    const caps = plugin.capabilities ?? {};
    for (const a of ACTION_BY_KIND[entityKind]) {
      if (caps[a]) return a;
    }
    return null;
  }

  async function runPlugin(plugin: InstalledPlugin) {
    setBusy(true);
    setError(null);
    try {
      const action = actionFor(plugin);
      if (!action) {
        throw new Error(
          `${plugin.name} does not advertise a ${entityKind} lookup capability.`,
        );
      }
      const res = await executePlugin(
        plugin.id,
        action,
        {
          title,
          name: title,
        },
        { saveResult: true, entityId },
      );
      if (!res.ok) {
        throw new Error(`${plugin.name} returned no result.`);
      }
      const saved = res.result as { id?: string } | null;
      if (!saved?.id) {
        throw new Error(`${plugin.name} did not persist a scrape result.`);
      }
      setDrawerOpen(saved.id);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Identify failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={cn("relative", className)}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={busy}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-[0.72rem] font-medium transition-colors surface-card",
            "hover:border-border-accent",
            busy && "opacity-50 cursor-not-allowed",
          )}
          title={defaultLabel}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ScanSearch className="h-3.5 w-3.5" />
          )}
          {defaultLabel}
        </button>

        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <div className="absolute right-0 top-full z-50 mt-1 w-72 surface-elevated py-2">
              <div className="px-3 pb-1 text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
                Run identify plugin
              </div>
              {loadingPlugins && (
                <div className="flex items-center gap-2 px-3 py-2 text-[0.7rem] text-text-muted">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading plugins…
                </div>
              )}
              {!loadingPlugins && eligible.length === 0 && (
                <div className="flex items-start gap-2 px-3 py-2 text-[0.7rem] text-text-muted">
                  <AlertCircle className="h-3 w-3 flex-shrink-0" />
                  <span>
                    No enabled plugin supports{" "}
                    <code className="font-mono text-text-accent">
                      {entityKindReadable(entityKind)}
                    </code>{" "}
                    lookup. Install a compatible plugin and try again.
                  </span>
                </div>
              )}
              {!loadingPlugins &&
                eligible.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void runPlugin(p)}
                    disabled={busy}
                    className="w-full px-3 py-1.5 text-left text-[0.72rem] text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
                  >
                    <div className="truncate font-medium text-text-primary">
                      {p.name}
                    </div>
                    <div className="truncate text-[0.6rem] text-text-disabled">
                      {actionFor(p) ?? "—"}
                      {p.version ? ` · ${p.version}` : ""}
                    </div>
                  </button>
                ))}
              {error && (
                <div className="mx-3 my-2 border border-status-error/30 bg-status-error/10 px-2 py-1 text-[0.68rem] text-status-error-text">
                  {error}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {drawerOpen && (
        <CascadeReviewDrawer
          scrapeResultId={drawerOpen}
          entityKind={entityKind}
          entityId={entityId}
          label={title}
          onAccepted={() => {
            setDrawerOpen(null);
            if (typeof window !== "undefined") window.location.reload();
          }}
          onClose={() => setDrawerOpen(null)}
        />
      )}
    </>
  );
}

function entityKindReadable(kind: EntityKind): string {
  if (kind === "video_movie") return "movie";
  if (kind === "video_series") return "series";
  return "episode";
}
