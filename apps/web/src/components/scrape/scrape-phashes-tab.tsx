"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  Loader2,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { createStashId, deleteStashId, fetchStashBoxEndpoints } from "../../lib/api";
import type { StashBoxEndpoint } from "../../lib/api";
import {
  listPhashContributions,
  submitFingerprintsToEndpoint,
  type FingerprintAlgorithm,
  type PhashContributionItem,
  type PhashContributionSubmission,
} from "../../lib/api/phash-contributions";

const ALGORITHMS: FingerprintAlgorithm[] = ["MD5", "OSHASH", "PHASH"];
const PAGE_SIZE = 25;

function truncateHash(hash: string | null, length = 12): string {
  if (!hash) return "—";
  return hash.length > length ? `${hash.slice(0, length)}…` : hash;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "—";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return iso;
  const diff = Date.now() - then;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/* ─── Component ─────────────────────────────────────────────────── */

export function ScrapePhashesTab() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PhashContributionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [endpoints, setEndpoints] = useState<StashBoxEndpoint[]>([]);
  const [submitting, setSubmitting] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const [contribs, epRes] = await Promise.all([
        listPhashContributions({ page: nextPage, pageSize: PAGE_SIZE }),
        fetchStashBoxEndpoints().catch(() => ({ endpoints: [] })),
      ]);
      setItems(contribs.items);
      setTotal(contribs.total);
      setPage(contribs.page);
      setEndpoints(epRes.endpoints.filter((e) => e.enabled));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contributions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /* ─── Submission helpers ────────────────────────────────────── */

  const applySubmissionResults = useCallback(
    (
      sceneId: string,
      endpointId: string,
      submissions: PhashContributionSubmission[],
    ) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.scene.id !== sceneId) return item;
          // Merge incoming submissions, replacing any existing row for the
          // same (endpoint, algorithm, hash) tuple.
          const merged = [...item.submissions];
          for (const incoming of submissions) {
            const idx = merged.findIndex(
              (m) =>
                m.endpointId === endpointId &&
                m.algorithm === incoming.algorithm &&
                m.hash === incoming.hash,
            );
            if (idx >= 0) merged[idx] = incoming;
            else merged.push(incoming);
          }
          return { ...item, submissions: merged };
        }),
      );
    },
    [],
  );

  const submitOne = useCallback(
    async (sceneId: string, endpointId: string): Promise<void> => {
      const key = `${sceneId}:${endpointId}`;
      setSubmitting((prev) => new Set(prev).add(key));
      try {
        const res = await submitFingerprintsToEndpoint(endpointId, sceneId);
        const now = new Date().toISOString();
        const stamped: PhashContributionSubmission[] = res.submissions.map((s) => ({
          endpointId,
          algorithm: s.algorithm,
          hash: s.hash,
          status: s.status,
          error: s.error ?? null,
          submittedAt: now,
        }));
        applySubmissionResults(sceneId, endpointId, stamped);
      } catch (err) {
        const now = new Date().toISOString();
        const message = err instanceof Error ? err.message : "Submission failed";
        // Surface a synthetic error submission for each algorithm so the UI
        // shows a red pill instead of silently doing nothing.
        applySubmissionResults(
          sceneId,
          endpointId,
          ALGORITHMS.map((alg) => ({
            endpointId,
            algorithm: alg,
            hash: "",
            status: "error" as const,
            error: message,
            submittedAt: now,
          })),
        );
      } finally {
        setSubmitting((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [applySubmissionResults],
  );

  const submitRow = useCallback(
    async (item: PhashContributionItem) => {
      for (const link of item.stashIds) {
        await submitOne(item.scene.id, link.endpointId);
      }
    },
    [submitOne],
  );

  const submitAll = useCallback(async () => {
    // Fan out (scene, endpoint) pairs sequentially. Parallelism would race the
    // per-endpoint token bucket on the API side and defeat the 240 rpm cap.
    const tasks: Array<{ sceneId: string; endpointId: string }> = [];
    for (const item of items) {
      for (const link of item.stashIds) {
        tasks.push({ sceneId: item.scene.id, endpointId: link.endpointId });
      }
    }
    if (tasks.length === 0) return;

    setBulkProgress({ current: 0, total: tasks.length });
    for (let i = 0; i < tasks.length; i++) {
      await submitOne(tasks[i].sceneId, tasks[i].endpointId);
      setBulkProgress({ current: i + 1, total: tasks.length });
    }
    setBulkProgress(null);
  }, [items, submitOne]);

  /* ─── Stash ID chip CRUD ─────────────────────────────────────── */

  const removeStashId = useCallback(
    async (itemId: string, linkId: string) => {
      try {
        await deleteStashId(linkId);
        setItems((prev) =>
          prev.map((item) =>
            item.scene.id !== itemId
              ? item
              : { ...item, stashIds: item.stashIds.filter((l) => l.id !== linkId) },
          ),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove link");
      }
    },
    [],
  );

  const addStashId = useCallback(
    async (sceneId: string, endpointId: string, stashId: string) => {
      const trimmed = stashId.trim();
      if (!trimmed || !endpointId) return;
      try {
        const created = await createStashId({
          entityType: "scene",
          entityId: sceneId,
          stashBoxEndpointId: endpointId,
          stashId: trimmed,
        });
        setItems((prev) =>
          prev.map((item) => {
            if (item.scene.id !== sceneId) return item;
            const withoutSameEndpoint = item.stashIds.filter(
              (l) => l.endpointId !== endpointId,
            );
            return {
              ...item,
              stashIds: [
                ...withoutSameEndpoint,
                {
                  id: created.id,
                  endpointId: created.endpointId,
                  endpointName: created.endpointName,
                  stashId: created.stashId,
                },
              ],
            };
          }),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add link");
      }
    },
    [],
  );

  /* ─── Render ──────────────────────────────────────────────────── */

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  const anySubmittable = items.some((i) => i.stashIds.length > 0);

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="surface-card no-lift p-3 flex flex-wrap items-center gap-3">
        <div className="text-xs text-text-muted flex items-center gap-2">
          <Fingerprint className="h-3.5 w-3.5 text-text-accent" />
          <span>
            {total} {total === 1 ? "scene" : "scenes"} linked to StashBox endpoints
          </span>
        </div>

        <div className="flex-1" />

        {bulkProgress ? (
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Submitting {bulkProgress.current} / {bulkProgress.total}…
          </div>
        ) : (
          <button
            onClick={() => void submitAll()}
            disabled={!anySubmittable}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium transition-all duration-normal",
              "bg-gradient-to-r from-accent-900 via-accent-800 to-accent-900",
              "text-accent-200 border border-border-accent shadow-[var(--shadow-glow-accent)]",
              "hover:shadow-[var(--shadow-glow-accent-strong)] hover:border-border-accent-strong",
              "disabled:opacity-40 disabled:cursor-not-allowed",
            )}
          >
            <UploadCloud className="h-3 w-3" />
            Submit all
          </button>
        )}

        {/* Pagination */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => void load(page - 1)}
            disabled={page <= 1 || loading}
            className="p-1.5 text-text-muted border border-border-subtle hover:text-text-primary hover:border-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <div className="text-mono-sm text-text-disabled px-1">
            {page} / {totalPages}
          </div>
          <button
            onClick={() => void load(page + 1)}
            disabled={page >= totalPages || loading}
            className="p-1.5 text-text-muted border border-border-subtle hover:text-text-primary hover:border-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="surface-card no-lift p-3 border border-status-error/40 text-status-error-text text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-text-muted hover:text-text-primary">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {items.length === 0 && !loading && (
        <div className="surface-card no-lift p-12 text-center">
          <Fingerprint className="h-10 w-10 text-text-disabled mx-auto mb-3" />
          <p className="text-text-muted text-sm">No scenes linked to StashBox endpoints yet.</p>
          <p className="text-text-disabled text-xs mt-1">
            Run Identify and accept a match to link scenes, then return here to contribute their fingerprints.
          </p>
        </div>
      )}

      {/* Row list */}
      <div className="space-y-1.5">
        {items.map((item) => (
          <PhashRow
            key={item.scene.id}
            item={item}
            endpoints={endpoints}
            submitting={submitting}
            onSubmit={() => void submitRow(item)}
            onRemoveStashId={(linkId) => void removeStashId(item.scene.id, linkId)}
            onAddStashId={(endpointId, stashId) => void addStashId(item.scene.id, endpointId, stashId)}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Row component ─────────────────────────────────────────────── */

interface PhashRowProps {
  item: PhashContributionItem;
  endpoints: StashBoxEndpoint[];
  submitting: Set<string>;
  onSubmit: () => void;
  onRemoveStashId: (linkId: string) => void;
  onAddStashId: (endpointId: string, stashId: string) => void;
}

function PhashRow({ item, endpoints, submitting, onSubmit, onRemoveStashId, onAddStashId }: PhashRowProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newEndpointId, setNewEndpointId] = useState<string>("");
  const [newStashId, setNewStashId] = useState<string>("");

  const hashes: Array<{ algorithm: FingerprintAlgorithm; value: string | null }> = [
    { algorithm: "MD5", value: item.scene.checksumMd5 },
    { algorithm: "OSHASH", value: item.scene.oshash },
    { algorithm: "PHASH", value: item.scene.phash },
  ];

  const rowSubmitting = useMemo(
    () => item.stashIds.some((l) => submitting.has(`${item.scene.id}:${l.endpointId}`)),
    [item.stashIds, item.scene.id, submitting],
  );

  // Latest submission per (endpoint, algorithm) for the pill grid.
  const latestByKey = useMemo(() => {
    const map = new Map<string, PhashContributionSubmission>();
    for (const s of item.submissions) {
      const key = `${s.endpointId}:${s.algorithm}`;
      const existing = map.get(key);
      if (!existing || new Date(s.submittedAt) > new Date(existing.submittedAt)) {
        map.set(key, s);
      }
    }
    return map;
  }, [item.submissions]);

  const availableEndpoints = endpoints.filter(
    (e) => !item.stashIds.some((l) => l.endpointId === e.id),
  );

  return (
    <div className="surface-card no-lift p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-text-primary truncate">{item.scene.title}</div>
          <div className="text-mono-sm text-text-disabled mt-0.5">
            {formatDuration(item.scene.duration)}
          </div>
        </div>

        <button
          onClick={onSubmit}
          disabled={rowSubmitting || item.stashIds.length === 0}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all duration-normal",
            "text-text-accent border border-border-accent hover:shadow-[var(--shadow-glow-accent)]",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
          {rowSubmitting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <UploadCloud className="h-3 w-3" />
          )}
          Submit
        </button>
      </div>

      {/* Stash ID chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {item.stashIds.map((link) => (
          <div
            key={link.id}
            className="flex items-center gap-1.5 px-2 py-1 bg-surface-3/60 border border-border-subtle text-xs"
          >
            <span className="text-text-muted">{link.endpointName}</span>
            <span className="text-text-disabled">·</span>
            <span className="text-mono-sm text-text-primary">{truncateHash(link.stashId, 10)}</span>
            <button
              onClick={() => onRemoveStashId(link.id)}
              className="text-text-disabled hover:text-status-error-text transition-colors"
              title="Remove link"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}

        {availableEndpoints.length > 0 && !showAdd && (
          <button
            onClick={() => {
              setShowAdd(true);
              setNewEndpointId(availableEndpoints[0].id);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted border border-dashed border-border-subtle hover:text-text-accent hover:border-border-accent transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add link
          </button>
        )}

        {showAdd && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-3/60 border border-border text-xs">
            <select
              value={newEndpointId}
              onChange={(e) => setNewEndpointId(e.target.value)}
              className="control-input py-0.5 text-xs"
            >
              {availableEndpoints.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.name}
                </option>
              ))}
            </select>
            <input
              value={newStashId}
              onChange={(e) => setNewStashId(e.target.value)}
              placeholder="remote scene UUID"
              className="control-input py-0.5 text-xs w-56"
            />
            <button
              onClick={() => {
                onAddStashId(newEndpointId, newStashId);
                setNewStashId("");
                setShowAdd(false);
              }}
              disabled={!newStashId.trim() || !newEndpointId}
              className="text-text-accent hover:text-accent-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setNewStashId("");
              }}
              className="text-text-muted hover:text-text-primary"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Hash badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        {hashes.map(({ algorithm, value }) => (
          <div
            key={algorithm}
            className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 border text-xs",
              value
                ? "bg-surface-2/60 border-border-subtle text-text-secondary"
                : "bg-surface-1/40 border-border-subtle text-text-disabled",
            )}
          >
            <span className="font-medium">{algorithm}</span>
            <span className="text-mono-sm">{truncateHash(value, 10)}</span>
          </div>
        ))}
      </div>

      {/* Submission pills — only render when scene is linked */}
      {item.stashIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {item.stashIds.flatMap((link) =>
            ALGORITHMS.filter((alg) => {
              // Skip algorithms the scene doesn't actually have.
              if (alg === "MD5") return !!item.scene.checksumMd5;
              if (alg === "OSHASH") return !!item.scene.oshash;
              return !!item.scene.phash;
            }).map((alg) => {
              const key = `${link.endpointId}:${alg}`;
              const submission = latestByKey.get(key);
              const state = submission?.status ?? "pending";
              return (
                <div
                  key={`${link.id}:${alg}`}
                  title={submission?.error ?? undefined}
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 border text-[0.65rem] font-medium",
                    state === "success" &&
                      "bg-surface-2/60 border-border-accent text-text-accent shadow-[var(--shadow-glow-accent)]",
                    state === "error" && "bg-status-error/10 border-status-error/40 text-status-error-text",
                    state === "pending" && "bg-surface-1/40 border-border-subtle text-text-disabled",
                  )}
                >
                  <span>{link.endpointName}</span>
                  <span>·</span>
                  <span>{alg}</span>
                  <span>·</span>
                  <span>
                    {state === "success"
                      ? submission
                        ? formatRelative(submission.submittedAt)
                        : "ok"
                      : state === "error"
                      ? "failed"
                      : "pending"}
                  </span>
                </div>
              );
            }),
          )}
        </div>
      )}
    </div>
  );
}
