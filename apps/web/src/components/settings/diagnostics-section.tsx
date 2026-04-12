"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Wrench } from "lucide-react";
import { backfillPhashes, rebuildPreviews } from "../../lib/api";
import { useNsfw } from "../nsfw/nsfw-context";
import { entityTerms } from "../../lib/terminology";

export function DiagnosticsSection() {
  const [rebuilding, setRebuilding] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [backfillingPhash, setBackfillingPhash] = useState(false);
  const [phashResult, setPhashResult] = useState<string | null>(null);
  const { mode: nsfwMode } = useNsfw();

  const handleRebuildPreviews = async () => {
    setRebuilding(true);
    setResult(null);
    try {
      const res = await rebuildPreviews(nsfwMode);
      setResult(
        `Queued ${res.enqueued} ${res.enqueued === 1 ? "video" : "videos"} for forced preview regeneration (metadata re-probed from disk)`
      );
    } catch {
      setResult("Failed to queue rebuild");
    } finally {
      setRebuilding(false);
    }
  };

  const handleBackfillPhashes = async () => {
    setBackfillingPhash(true);
    setPhashResult(null);
    try {
      const res = await backfillPhashes(nsfwMode);
      setPhashResult(
        `Queued ${res.enqueued} ${res.enqueued === 1 ? "video" : "videos"} for pHash generation`,
      );
    } catch {
      setPhashResult("Failed to queue backfill");
    } finally {
      setBackfillingPhash(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5 px-1">
        <Wrench className="h-4 w-4 text-text-accent" />
        <div>
          <h2 className="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">Diagnostics</h2>
          <p className="text-[0.68rem] text-text-muted">Maintenance actions for troubleshooting</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="surface-card p-3 space-y-2">
          <div>
            <p className="text-[0.78rem] font-medium text-status-error-text">
              Force rebuild all previews
            </p>
            <p className="text-[0.68rem] text-text-muted">
              Re-probe each file on disk (resolution, duration, codecs, size), then clear and regenerate thumbnails, preview
              clips, and trickplay sprites for every {entityTerms.scene.toLowerCase()}. Use this after replacing a source file
              with a different resolution, after quality setting changes, or to fix corrupt sprites. Heavy maintenance job.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRebuildPreviews}
              disabled={rebuilding}
              className="inline-flex items-center gap-1.5 border border-status-error/25 bg-status-error/[0.12] px-3 py-1.5 text-[0.72rem] font-medium text-status-error-text transition-colors hover:bg-status-error/[0.18] disabled:opacity-50"
            >
              {rebuilding ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              {rebuilding ? "Queuing..." : "Force rebuild previews"}
            </button>
            {result && (
              <p className="text-[0.68rem] text-text-muted">{result}</p>
            )}
          </div>
        </div>
        <div className="surface-card p-3 space-y-2">
          <div>
            <p className="text-[0.78rem] font-medium text-text-primary">
              Backfill perceptual hashes
            </p>
            <p className="text-[0.68rem] text-text-muted">
              Queue a Stash-compatible pHash generation job for every {entityTerms.scene.toLowerCase()} that has a
              known duration but no stored phash. Required before you can contribute those hashes to StashDB /
              ThePornDB from the Identify → pHashes tab. CPU-heavy (25 ffmpeg frame extractions per scene).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBackfillPhashes}
              disabled={backfillingPhash}
              className="inline-flex items-center gap-1.5 border border-border-accent/40 bg-accent-950/30 px-3 py-1.5 text-[0.72rem] font-medium text-text-accent transition-colors hover:bg-accent-950/50 hover:shadow-[var(--shadow-glow-accent)] disabled:opacity-50"
            >
              {backfillingPhash ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              {backfillingPhash ? "Queuing..." : "Backfill pHashes"}
            </button>
            {phashResult && (
              <p className="text-[0.68rem] text-text-muted">{phashResult}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
