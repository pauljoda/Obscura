"use client";

import { useCallback, useState } from "react";
import { Button, Badge } from "@obscura/ui";
import {
  Check,
  X,
  GitCompareArrows,
  Loader2,
  RefreshCw,
  Plus,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import {
  fetchScrapeResults,
  acceptScrapeResult,
  rejectScrapeResult,
  type ScrapeResult,
} from "../../lib/api";

interface ReviewPageClientProps {
  initialResults: ScrapeResult[];
}

export function ReviewPageClient({ initialResults }: ReviewPageClientProps) {
  const [results, setResults] = useState(initialResults);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadResults = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetchScrapeResults({ status: "pending", limit: 100 });
      setResults(res.results);
    } finally {
      setRefreshing(false);
    }
  }, []);

  async function handleAccept(result: ScrapeResult) {
    setProcessingId(result.id);
    setMessage(null);
    try {
      await acceptScrapeResult(result.id);
      setResults((prev) => prev.filter((r) => r.id !== result.id));
      setMessage("Metadata applied successfully.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(result: ScrapeResult) {
    setProcessingId(result.id);
    try {
      await rejectScrapeResult(result.id);
      setResults((prev) => prev.filter((r) => r.id !== result.id));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleAcceptAll() {
    setMessage(null);
    const applied: string[] = [];
    const failed: string[] = [];

    for (const result of results) {
      try {
        await acceptScrapeResult(result.id);
        applied.push(result.id);
      } catch {
        failed.push(result.id);
      }
    }

    setResults((prev) => prev.filter((r) => !applied.includes(r.id)));

    if (failed.length > 0) {
      setMessage(`Applied ${applied.length} result(s). ${failed.length} failed.`);
    } else {
      setMessage(`Applied ${applied.length} result(s).`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1>Review</h1>
          <p className="mt-1 text-text-muted text-sm">
            Review and apply pending scrape results
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="accent">{results.length} pending</Badge>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadResults()}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
          {results.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleAcceptAll()}
            >
              <Check className="h-3.5 w-3.5" />
              Accept All
            </Button>
          )}
        </div>
      </div>

      {message && (
        <div className="surface-panel border border-border-accent p-3 text-text-secondary text-sm">
          {message}
        </div>
      )}

      {results.length === 0 ? (
        <div className="surface-well flex flex-col items-center justify-center py-16">
          <GitCompareArrows className="h-12 w-12 text-text-disabled mb-3" />
          <p className="text-text-muted text-sm">No pending results to review.</p>
          <p className="text-text-disabled text-xs mt-1">
            Scrape scenes from the{" "}
            <a href="/resolve" className="text-text-accent hover:underline">
              Resolve queue
            </a>{" "}
            to generate results.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((result) => (
            <div key={result.id} className="surface-panel p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs text-text-disabled">
                    Scene {result.sceneId.slice(0, 8)}... · {result.action}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleReject(result)}
                    disabled={processingId === result.id}
                  >
                    <X className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => void handleAccept(result)}
                    disabled={processingId === result.id}
                  >
                    {processingId === result.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Accept
                  </Button>
                </div>
              </div>

              <div className="surface-well p-3 space-y-0">
                {result.proposedTitle && <ReviewField label="Title" value={result.proposedTitle} />}
                {result.proposedDate && (
                  <>
                    <div className="separator" />
                    <ReviewField label="Date" value={result.proposedDate} />
                  </>
                )}
                {result.proposedStudioName && (
                  <>
                    <div className="separator" />
                    <ReviewField label="Studio" value={result.proposedStudioName} />
                  </>
                )}
                {result.proposedPerformerNames && result.proposedPerformerNames.length > 0 && (
                  <>
                    <div className="separator" />
                    <ReviewField label="Performers" value={result.proposedPerformerNames.join(", ")} />
                  </>
                )}
                {result.proposedTagNames && result.proposedTagNames.length > 0 && (
                  <>
                    <div className="separator" />
                    <ReviewField label="Tags" value={result.proposedTagNames.join(", ")} />
                  </>
                )}
                {result.proposedUrl && (
                  <>
                    <div className="separator" />
                    <ReviewField label="URL" value={result.proposedUrl} />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-success-muted/30 text-success-text">
        <Plus className="h-3 w-3" />
      </span>
      <span className="text-label text-text-muted w-24">{label}</span>
      <span className="text-mono-sm text-success-text">{value}</span>
    </div>
  );
}
