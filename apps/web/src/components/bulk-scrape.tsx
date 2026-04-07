"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@obscura/ui/primitives/badge";
import { cn } from "@obscura/ui/lib/utils";
import {
  Check,
  X,
  Loader2,
  ScanSearch,
  Play,
  Square,
  ChevronDown,
  Film,
  Users,
  SkipForward,
  Image as ImageIcon,
  Building2,
  Tag,
} from "lucide-react";
import {
  fetchScenes,
  fetchPerformers,
  fetchStudios,
  fetchTags,
  fetchInstalledScrapers,
  fetchStashBoxEndpoints,
  scrapeScene,
  scrapePerformerApi,
  identifyViaStashBox,
  identifyPerformerViaStashBox,
  lookupStudioViaStashBox,
  lookupTagViaStashBox,
  acceptScrapeResult,
  rejectScrapeResult,
  applyPerformerScrape,
  updateStudio,
  updateTag,
  uploadStudioImageFromUrl,
  uploadTagImageFromUrl,
  findOrCreateStudio,
  toApiUrl,
  type SceneListItem,
  type PerformerItem,
  type StudioItem,
  type TagItem,
  type ScraperPackage,
  type StashBoxEndpoint,
  type ScrapeResult,
  type NormalizedScrapeResult,
  type NormalizedPerformerScrapeResult,
  type NormalizedStudioScrapeResult,
  type NormalizedTagScrapeResult,
} from "../lib/api";
import { ImagePickerModal } from "./image-picker-modal";
import { autoSaveStashId } from "./stash-id-chips";

/** Unified provider that can be either a community scraper or StashBox endpoint */
interface Provider {
  id: string;
  name: string;
  type: "scraper" | "stashbox";
}

/* ─── Types ────────────────────────────────────────────────────── */

type Tab = "scenes" | "performers" | "studios" | "tags";

const SCENE_FIELDS = ["title", "date", "details", "url", "studio", "performers", "tags", "image"] as const;
type SceneField = typeof SCENE_FIELDS[number];

interface SceneRow {
  scene: SceneListItem;
  status: "pending" | "scraping" | "found" | "no-result" | "error" | "accepted" | "rejected";
  result?: ScrapeResult;
  normalized?: NormalizedScrapeResult;
  error?: string;
  matchedScraper?: string;
  selectedFields: Set<SceneField>;
  excludedPerformers: Set<string>;
  excludedTags: Set<string>;
}

interface PerformerRow {
  performer: PerformerItem;
  status: "pending" | "scraping" | "found" | "no-result" | "error" | "accepted" | "rejected";
  result?: NormalizedPerformerScrapeResult;
  error?: string;
  matchedScraper?: string;
  selectedFields: Set<string>;
}

interface StudioRow {
  studio: StudioItem;
  status: "pending" | "scraping" | "found" | "no-result" | "error" | "accepted" | "rejected";
  result?: NormalizedStudioScrapeResult;
  remoteId?: string;
  endpointId?: string;
  error?: string;
  matchedScraper?: string;
  selectedFields: Set<string>;
}

interface TagRow {
  tag: TagItem;
  status: "pending" | "scraping" | "found" | "no-result" | "error" | "accepted" | "rejected";
  result?: NormalizedTagScrapeResult;
  remoteId?: string;
  endpointId?: string;
  error?: string;
  matchedScraper?: string;
  selectedFields: Set<string>;
}

/* ─── Seek timeout ──────────────────────────────────────────────── */
const SEEK_TIMEOUT_MS = 5_000;

function perfFieldsFromResult(result: NormalizedPerformerScrapeResult): Set<string> {
  return new Set(
    Object.entries(result)
      .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0))
      .map(([k]) => k)
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Scraper timeout")), ms)
    ),
  ]);
}

/* ─── Component ─────────────────────────────────────────────────── */

export function BulkScrape() {
  const [tab, setTab] = useState<Tab>("scenes");
  const [scrapers, setScrapers] = useState<ScraperPackage[]>([]);
  const [stashBoxEndpoints, setStashBoxEndpoints] = useState<StashBoxEndpoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Scene state
  const [sceneRows, setSceneRows] = useState<SceneRow[]>([]);
  const [sceneScrapers, setSceneScrapers] = useState<ScraperPackage[]>([]);

  // Performer state
  const [perfRows, setPerfRows] = useState<PerformerRow[]>([]);
  const [perfScrapers, setPerfScrapers] = useState<ScraperPackage[]>([]);

  // Studio state
  const [studioRows, setStudioRows] = useState<StudioRow[]>([]);

  // Tag state
  const [tagRows, setTagRows] = useState<TagRow[]>([]);

  // All items for show-all toggle
  const [allScenes, setAllScenes] = useState<SceneListItem[]>([]);
  const [allPerformers, setAllPerformers] = useState<PerformerItem[]>([]);
  const [allStudios, setAllStudios] = useState<StudioItem[]>([]);
  const [allTags, setAllTags] = useState<TagItem[]>([]);

  // Shared
  const [running, setRunning] = useState(false);
  const [autoAccept, setAutoAccept] = useState(false);
  const [selectedScraperId, setSelectedScraperId] = useState<string>(""); // "" = seek all
  const [showAll, setShowAll] = useState(false);
  const abortRef = useRef(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    if (tab === "performers") {
      setExpandedIds(new Set(perfRows.map((r) => r.performer.id)));
    } else if (tab === "studios") {
      setExpandedIds(new Set(studioRows.map((r) => r.studio.id)));
    } else if (tab === "tags") {
      setExpandedIds(new Set(tagRows.map((r) => r.tag.id)));
    } else {
      setExpandedIds(new Set(sceneRows.map((r) => r.scene.id)));
    }
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  function toggleSceneField(idx: number, field: SceneField) {
    setSceneRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = new Set(r.selectedFields);
        if (next.has(field)) next.delete(field);
        else next.add(field);
        return { ...r, selectedFields: next };
      })
    );
  }

  function toggleSceneExcludePerformer(idx: number, name: string) {
    setSceneRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = new Set(r.excludedPerformers);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return { ...r, excludedPerformers: next };
      })
    );
  }

  function toggleSceneExcludeTag(idx: number, name: string) {
    setSceneRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = new Set(r.excludedTags);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return { ...r, excludedTags: next };
      })
    );
  }

  function togglePerfField(idx: number, field: string) {
    setPerfRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = new Set(r.selectedFields);
        if (next.has(field)) next.delete(field);
        else next.add(field);
        return { ...r, selectedFields: next };
      })
    );
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [scenesRes, perfRes, studiosRes, tagsRes, scrapersRes, stashBoxRes] = await Promise.all([
        fetchScenes({ sort: "created_at", limit: 500 }),
        fetchPerformers({ sort: "name", order: "asc", limit: 200 }),
        fetchStudios(),
        fetchTags(),
        fetchInstalledScrapers(),
        fetchStashBoxEndpoints().catch(() => ({ endpoints: [] })),
      ]);

      setStashBoxEndpoints(stashBoxRes.endpoints.filter((e) => e.enabled));

      const unorganized = scenesRes.scenes.filter((s) => !s.organized);
      setSceneRows(unorganized.map((scene) => ({ scene, status: "pending", selectedFields: new Set(SCENE_FIELDS), excludedPerformers: new Set(), excludedTags: new Set() })));

      const sparse = perfRes.performers.filter((p) => !p.imagePath || !p.gender);
      setPerfRows(sparse.map((performer) => ({ performer, status: "pending", selectedFields: new Set() })));

      // Studios missing url or image
      const sparseStudios = studiosRes.studios.filter((s) => !s.url || !s.imageUrl);
      setStudioRows(sparseStudios.map((studio) => ({ studio, status: "pending", selectedFields: new Set() })));

      // Tags missing description
      const sparseTags = tagsRes.tags.filter(() => true); // Show all tags for identification
      setTagRows(sparseTags.map((tag) => ({ tag, status: "pending", selectedFields: new Set() })));

      // Store all for show-all toggle
      setAllScenes(scenesRes.scenes);
      setAllPerformers(perfRes.performers);
      setAllStudios(studiosRes.studios);
      setAllTags(tagsRes.tags);

      const enabled = scrapersRes.packages.filter((s) => s.enabled);
      setScrapers(enabled);

      // Filter by capability
      const sceneCapable = enabled.filter((pkg) => {
        const caps = pkg.capabilities as Record<string, boolean> | null;
        return caps && (caps.sceneByURL || caps.sceneByFragment || caps.sceneByName || caps.sceneByQueryFragment);
      });
      setSceneScrapers(sceneCapable);

      const perfCapable = enabled.filter((pkg) => {
        const caps = pkg.capabilities as Record<string, boolean> | null;
        return caps && (caps.performerByURL || caps.performerByName || caps.performerByFragment);
      });
      setPerfScrapers(perfCapable);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Rebuild rows when showAll toggles
  useEffect(() => {
    if (!allScenes.length && !allPerformers.length && !allStudios.length && !allTags.length) return;
    const filteredScenes = showAll ? allScenes : allScenes.filter((s) => !s.organized);
    setSceneRows((prev) => {
      const existing = new Map(prev.map((r) => [r.scene.id, r]));
      return filteredScenes.map((scene) => existing.get(scene.id) ?? { scene, status: "pending", selectedFields: new Set(SCENE_FIELDS), excludedPerformers: new Set(), excludedTags: new Set() });
    });
    const filteredPerfs = showAll ? allPerformers : allPerformers.filter((p) => !p.imagePath || !p.gender);
    setPerfRows((prev) => {
      const existing = new Map(prev.map((r) => [r.performer.id, r]));
      return filteredPerfs.map((performer) => existing.get(performer.id) ?? { performer, status: "pending", selectedFields: new Set() });
    });
    const filteredStudios = showAll ? allStudios : allStudios.filter((s) => !s.url || !s.imageUrl);
    setStudioRows((prev) => {
      const existing = new Map(prev.map((r) => [r.studio.id, r]));
      return filteredStudios.map((studio) => existing.get(studio.id) ?? { studio, status: "pending", selectedFields: new Set() });
    });
    // Tags: show all since we can't easily filter "needs enrichment" without description
    setTagRows((prev) => {
      const existing = new Map(prev.map((r) => [r.tag.id, r]));
      return allTags.map((tag) => existing.get(tag.id) ?? { tag, status: "pending", selectedFields: new Set() });
    });
  }, [showAll, allScenes, allPerformers, allStudios, allTags]);

  /* ─── Scene seek ────────────────────────────────────────────── */

  async function seekSceneViaStashBox(row: SceneRow, endpoints: StashBoxEndpoint[]): Promise<{
    result?: ScrapeResult;
    normalized?: NormalizedScrapeResult;
    matchedScraper?: string;
    matchType?: string;
  }> {
    for (const ep of endpoints) {
      try {
        const res = await withTimeout(
          identifyViaStashBox(ep.id, row.scene.id),
          SEEK_TIMEOUT_MS
        );
        if (res.result && res.normalized) {
          return {
            result: res.result,
            normalized: res.normalized,
            matchedScraper: `${ep.name}${res.matchType === "fingerprint" ? " (fingerprint)" : ""}`,
            matchType: res.matchType,
          };
        }
      } catch {
        // Timeout or error — try next
      }
    }
    return {};
  }

  async function seekScene(row: SceneRow, scraperList: ScraperPackage[], sbEndpoints: StashBoxEndpoint[]): Promise<{
    result?: ScrapeResult;
    normalized?: NormalizedScrapeResult;
    matchedScraper?: string;
    matchType?: string;
  }> {
    // Try StashBox endpoints first (fingerprint matching is highest confidence)
    if (sbEndpoints.length > 0) {
      const sbResult = await seekSceneViaStashBox(row, sbEndpoints);
      if (sbResult.result) return sbResult;
    }

    // Fall back to community scrapers
    for (const scraper of scraperList) {
      try {
        const res = await withTimeout(
          scrapeScene(scraper.id, row.scene.id, "auto"),
          SEEK_TIMEOUT_MS
        );
        if (res.result && res.normalized) {
          return { result: res.result, normalized: res.normalized, matchedScraper: scraper.name };
        }
      } catch {
        // Timeout or error — try next
      }
    }
    return {};
  }

  async function runSceneScrape() {
    setRunning(true);
    abortRef.current = false;

    // Parse selected provider
    const isStashBox = selectedScraperId.startsWith("stashbox:");
    const isScraper = selectedScraperId.startsWith("scraper:");
    const realId = selectedScraperId.replace(/^(stashbox|scraper):/, "");

    // Determine which sources to use
    const scraperList = isScraper
      ? sceneScrapers.filter((s) => s.id === realId)
      : selectedScraperId === "" ? sceneScrapers : [];
    const sbEndpoints = isStashBox
      ? stashBoxEndpoints.filter((e) => e.id === realId)
      : selectedScraperId === "" ? stashBoxEndpoints : [];

    // Reset non-accepted rows
    setSceneRows((prev) =>
      prev.map((r) =>
        r.status === "accepted" ? r : { ...r, status: "pending", result: undefined, normalized: undefined, error: undefined }
      )
    );

    for (let i = 0; i < sceneRows.length; i++) {
      if (abortRef.current) break;
      if (sceneRows[i].status === "accepted") continue;

      setSceneRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "scraping" } : r))
      );

      try {
        const { result, normalized, matchedScraper } = await seekScene(sceneRows[i], scraperList, sbEndpoints);
        if (result && normalized) {
          if (autoAccept) {
            try {
              await acceptScrapeResult(result.id);
              setSceneRows((prev) =>
                prev.map((r, idx) =>
                  idx === i ? { ...r, status: "accepted", result, normalized, matchedScraper } : r
                )
              );
            } catch {
              setSceneRows((prev) =>
                prev.map((r, idx) =>
                  idx === i ? { ...r, status: "found", result, normalized, matchedScraper } : r
                )
              );
            }
          } else {
            setSceneRows((prev) =>
              prev.map((r, idx) =>
                idx === i ? { ...r, status: "found", result, normalized, matchedScraper } : r
              )
            );
          }
        } else {
          setSceneRows((prev) =>
            prev.map((r, idx) => (idx === i ? { ...r, status: "no-result" } : r))
          );
        }
      } catch (err) {
        setSceneRows((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: "error", error: err instanceof Error ? err.message : "Failed" } : r
          )
        );
      }
    }
    setRunning(false);
  }

  /* ─── Performer seek ─────────────────────────────────────────── */

  async function seekPerformer(row: PerformerRow, scraperList: ScraperPackage[], sbEndpoints: StashBoxEndpoint[]): Promise<{
    result?: NormalizedPerformerScrapeResult;
    matchedScraper?: string;
  }> {
    const performerName = row.performer.name.toLowerCase().trim();

    // Try StashBox endpoints first
    for (const ep of sbEndpoints) {
      try {
        const res = await withTimeout(
          identifyPerformerViaStashBox(ep.id, row.performer.id),
          SEEK_TIMEOUT_MS
        );
        if (res.results && res.results.length > 0) {
          const exact = res.results.find(
            (r) => r.name?.toLowerCase().trim() === performerName
          );
          if (exact) {
            return { result: exact, matchedScraper: ep.name };
          }
        }
      } catch {
        // Timeout or error — try next
      }
    }

    // Fall back to community scrapers
    for (const scraper of scraperList) {
      try {
        const res = await withTimeout(
          scrapePerformerApi(scraper.id, row.performer.id, { action: "auto" }),
          SEEK_TIMEOUT_MS
        );

        if (res.result) {
          return { result: res.result, matchedScraper: scraper.name };
        }

        if (res.results && res.results.length > 0) {
          const exact = res.results.find(
            (r) => r.name?.toLowerCase().trim() === performerName
          );
          if (exact) {
            return { result: exact, matchedScraper: scraper.name };
          }
        }
      } catch {
        // Timeout or error — try next
      }
    }
    return {};
  }

  async function runPerformerScrape() {
    setRunning(true);
    abortRef.current = false;

    const isStashBox = selectedScraperId.startsWith("stashbox:");
    const isScraper = selectedScraperId.startsWith("scraper:");
    const realId = selectedScraperId.replace(/^(stashbox|scraper):/, "");

    const scraperList = isScraper
      ? perfScrapers.filter((s) => s.id === realId)
      : selectedScraperId === "" ? perfScrapers : [];
    const sbEndpoints = isStashBox
      ? stashBoxEndpoints.filter((e) => e.id === realId)
      : selectedScraperId === "" ? stashBoxEndpoints : [];

    setPerfRows((prev) =>
      prev.map((r) =>
        r.status === "accepted" ? r : { ...r, status: "pending", result: undefined, error: undefined }
      )
    );

    for (let i = 0; i < perfRows.length; i++) {
      if (abortRef.current) break;
      if (perfRows[i].status === "accepted") continue;

      setPerfRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, status: "scraping" } : r))
      );

      try {
        const { result, matchedScraper } = await seekPerformer(perfRows[i], scraperList, sbEndpoints);
        if (result) {
          if (autoAccept) {
            const allFields = Object.entries(result)
              .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0))
              .map(([k]) => k);
            try {
              await applyPerformerScrape(
                perfRows[i].performer.id,
                result as unknown as Record<string, unknown>,
                allFields
              );
              setPerfRows((prev) =>
                prev.map((r, idx) =>
                  idx === i ? { ...r, status: "accepted", result, matchedScraper } : r
                )
              );
            } catch {
              setPerfRows((prev) =>
                prev.map((r, idx) =>
                  idx === i ? { ...r, status: "found", result, matchedScraper, selectedFields: perfFieldsFromResult(result) } : r
                )
              );
            }
          } else {
            setPerfRows((prev) =>
              prev.map((r, idx) =>
                idx === i ? { ...r, status: "found", result, matchedScraper, selectedFields: perfFieldsFromResult(result) } : r
              )
            );
          }
        } else {
          setPerfRows((prev) =>
            prev.map((r, idx) => (idx === i ? { ...r, status: "no-result" } : r))
          );
        }
      } catch (err) {
        setPerfRows((prev) =>
          prev.map((r, idx) =>
            idx === i ? { ...r, status: "error", error: err instanceof Error ? err.message : "Failed" } : r
          )
        );
      }
    }
    setRunning(false);
  }

  /* ─── Accept / Reject handlers ───────────────────────────────── */

  async function acceptScene(idx: number) {
    const row = sceneRows[idx];
    if (!row.result) return;
    try {
      await acceptScrapeResult(row.result.id, Array.from(row.selectedFields), {
        excludePerformers: Array.from(row.excludedPerformers),
        excludeTags: Array.from(row.excludedTags),
      });
      setSceneRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r))
      );
    } catch { /* keep as found */ }
  }

  async function rejectScene(idx: number) {
    const row = sceneRows[idx];
    if (!row.result) return;
    try {
      await rejectScrapeResult(row.result.id);
      setSceneRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "rejected", result: undefined, normalized: undefined } : r))
      );
    } catch { /* ignore */ }
  }

  async function acceptAllScenes() {
    const found = sceneRows.map((r, i) => ({ row: r, idx: i })).filter(({ row }) => row.status === "found" && row.result);
    for (const { row, idx } of found) {
      try {
        await acceptScrapeResult(row.result!.id);
        setSceneRows((prev) =>
          prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r))
        );
      } catch { /* skip */ }
    }
  }

  async function acceptPerformer(idx: number, overrideImageUrl?: string) {
    const row = perfRows[idx];
    if (!row.result) return;
    const fields = { ...row.result } as Record<string, unknown>;
    if (overrideImageUrl) {
      fields.imageUrl = overrideImageUrl;
    }
    try {
      await applyPerformerScrape(
        row.performer.id,
        fields,
        Array.from(row.selectedFields)
      );
      setPerfRows((prev) =>
        prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r))
      );
    } catch { /* keep as found */ }
  }

  function rejectPerformer(idx: number) {
    setPerfRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, status: "rejected" } : r))
    );
  }

  async function acceptAllPerformers() {
    const found = perfRows.map((r, i) => ({ row: r, idx: i })).filter(({ row }) => row.status === "found" && row.result);
    for (const { idx } of found) {
      await acceptPerformer(idx);
    }
  }

  /* ─── Studio seek ─────────────────────────────────────────────── */

  async function seekStudio(row: StudioRow, sbEndpoints: StashBoxEndpoint[]): Promise<{
    result?: NormalizedStudioScrapeResult;
    remoteId?: string;
    endpointId?: string;
    matchedScraper?: string;
  }> {
    for (const ep of sbEndpoints) {
      try {
        const res = await withTimeout(lookupStudioViaStashBox(ep.id, row.studio.name), SEEK_TIMEOUT_MS);
        if (res.studio) {
          return {
            result: {
              name: res.studio.name,
              url: res.studio.urls?.[0]?.url ?? null,
              imageUrl: res.studio.images?.[0]?.url ?? null,
              parentName: res.studio.parent?.name ?? null,
            },
            remoteId: res.studio.id,
            endpointId: ep.id,
            matchedScraper: ep.name,
          };
        }
      } catch { /* next */ }
    }
    return {};
  }

  async function runStudioScrape() {
    setRunning(true);
    abortRef.current = false;

    const isStashBox = selectedScraperId.startsWith("stashbox:");
    const realId = selectedScraperId.replace(/^stashbox:/, "");
    const sbEndpoints = isStashBox
      ? stashBoxEndpoints.filter((e) => e.id === realId)
      : selectedScraperId === "" ? stashBoxEndpoints : [];

    setStudioRows((prev) =>
      prev.map((r) => r.status === "accepted" ? r : { ...r, status: "pending", result: undefined, error: undefined })
    );

    for (let i = 0; i < studioRows.length; i++) {
      if (abortRef.current) break;
      if (studioRows[i].status === "accepted") continue;

      setStudioRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "scraping" } : r)));

      try {
        const { result, remoteId, endpointId, matchedScraper } = await seekStudio(studioRows[i], sbEndpoints);
        if (result) {
          // Don't auto-select parentName — data quality varies across endpoints
          const fields = new Set(Object.entries(result).filter(([k, v]) => v != null && v !== "" && k !== "parentName").map(([k]) => k));
          if (autoAccept) {
            try {
              const data: Record<string, unknown> = {};
              if (result.url) data.url = result.url;
              await updateStudio(studioRows[i].studio.id, data);
              // Download image from URL
              if (result.imageUrl) {
                try { await uploadStudioImageFromUrl(studioRows[i].studio.id, result.imageUrl); } catch (e) { console.error("Studio image download failed:", e); }
              }
              if (endpointId && remoteId) await autoSaveStashId("studio", studioRows[i].studio.id, endpointId, remoteId);
              setStudioRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "accepted", result, remoteId, endpointId, matchedScraper, selectedFields: fields } : r));
            } catch {
              setStudioRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "found", result, remoteId, endpointId, matchedScraper, selectedFields: fields } : r));
            }
          } else {
            setStudioRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "found", result, remoteId, endpointId, matchedScraper, selectedFields: fields } : r));
          }
        } else {
          setStudioRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "no-result" } : r)));
        }
      } catch (err) {
        setStudioRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "error", error: err instanceof Error ? err.message : "Failed" } : r));
      }
    }
    setRunning(false);
  }

  async function acceptStudio(idx: number) {
    const row = studioRows[idx];
    if (!row.result) return;
    try {
      const data: Record<string, unknown> = {};
      if (row.selectedFields.has("url") && row.result.url) data.url = row.result.url;
      if (row.selectedFields.has("name") && row.result.name) data.name = row.result.name;
      // Resolve parent studio if selected
      if (row.selectedFields.has("parentName") && row.result.parentName) {
        try {
          const parentResult = await findOrCreateStudio({ name: row.result.parentName });
          data.parentId = parentResult.id;
        } catch (e) { console.error("Parent studio resolution failed:", e); }
      }
      await updateStudio(row.studio.id, data);
      // Download image from URL (stores locally)
      if (row.selectedFields.has("imageUrl") && row.result.imageUrl) {
        try { await uploadStudioImageFromUrl(row.studio.id, row.result.imageUrl); } catch (e) { console.error("Studio image download failed:", e); }
      }
      if (row.endpointId && row.remoteId) await autoSaveStashId("studio", row.studio.id, row.endpointId, row.remoteId);
      setStudioRows((prev) => prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r)));
    } catch { /* keep as found */ }
  }

  function rejectStudio(idx: number) {
    setStudioRows((prev) => prev.map((r, i) => (i === idx ? { ...r, status: "rejected" } : r)));
  }

  async function acceptAllStudios() {
    const found = studioRows.map((r, i) => ({ row: r, idx: i })).filter(({ row }) => row.status === "found" && row.result);
    for (const { idx } of found) { await acceptStudio(idx); }
  }

  /* ─── Tag seek ──────────────────────────────────────────────── */

  async function seekTag(row: TagRow, sbEndpoints: StashBoxEndpoint[]): Promise<{
    result?: NormalizedTagScrapeResult;
    remoteId?: string;
    endpointId?: string;
    matchedScraper?: string;
  }> {
    // Build search variants: original name + normalized versions (e.g. "1-on-1" → "1 on 1")
    const original = row.tag.name.trim();
    const variants = new Set([original]);
    if (original.includes("-")) variants.add(original.replace(/-/g, " "));
    if (original.includes("_")) variants.add(original.replace(/_/g, " "));
    if (original.includes(" ")) {
      variants.add(original.replace(/ /g, "-"));
      variants.add(original.replace(/ /g, "_"));
    }

    for (const ep of sbEndpoints) {
      for (const query of variants) {
        try {
          const res = await withTimeout(lookupTagViaStashBox(ep.id, query), SEEK_TIMEOUT_MS);
          if (res.tags && res.tags.length > 0) {
            const queryLower = query.toLowerCase();
            // Strict matching: exact name or alias match against the query variant
            const match = res.tags.find((t) =>
              t.name.toLowerCase().trim() === queryLower ||
              t.aliases?.some((a) => a.toLowerCase().trim() === queryLower)
            );
            if (match) {
              return {
                result: {
                  name: match.name,
                  description: match.description ?? null,
                  aliases: match.aliases?.join(", ") ?? null,
                },
                remoteId: match.id,
                endpointId: ep.id,
                matchedScraper: ep.name,
              };
            }
          }
        } catch { /* next */ }
      }
    }
    return {};
  }

  async function runTagScrape() {
    setRunning(true);
    abortRef.current = false;

    const isStashBox = selectedScraperId.startsWith("stashbox:");
    const realId = selectedScraperId.replace(/^stashbox:/, "");
    const sbEndpoints = isStashBox
      ? stashBoxEndpoints.filter((e) => e.id === realId)
      : selectedScraperId === "" ? stashBoxEndpoints : [];

    setTagRows((prev) =>
      prev.map((r) => r.status === "accepted" ? r : { ...r, status: "pending", result: undefined, error: undefined })
    );

    for (let i = 0; i < tagRows.length; i++) {
      if (abortRef.current) break;
      if (tagRows[i].status === "accepted") continue;

      setTagRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "scraping" } : r)));

      try {
        const { result, remoteId, endpointId, matchedScraper } = await seekTag(tagRows[i], sbEndpoints);
        if (result) {
          const fields = new Set(Object.entries(result).filter(([, v]) => v != null && v !== "").map(([k]) => k));
          if (autoAccept) {
            try {
              const data: Record<string, unknown> = {};
              if (result.description) data.description = result.description;
              if (result.aliases) data.aliases = result.aliases;
              await updateTag(tagRows[i].tag.id, data);
              if (endpointId && remoteId) await autoSaveStashId("tag", tagRows[i].tag.id, endpointId, remoteId);
              setTagRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "accepted", result, remoteId, endpointId, matchedScraper, selectedFields: fields } : r));
            } catch {
              setTagRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "found", result, remoteId, endpointId, matchedScraper, selectedFields: fields } : r));
            }
          } else {
            setTagRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "found", result, remoteId, endpointId, matchedScraper, selectedFields: fields } : r));
          }
        } else {
          setTagRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "no-result" } : r)));
        }
      } catch (err) {
        setTagRows((prev) => prev.map((r, idx) => idx === i ? { ...r, status: "error", error: err instanceof Error ? err.message : "Failed" } : r));
      }
    }
    setRunning(false);
  }

  async function acceptTag(idx: number) {
    const row = tagRows[idx];
    if (!row.result) return;
    try {
      const data: Record<string, unknown> = {};
      if (row.selectedFields.has("description") && row.result.description) data.description = row.result.description;
      if (row.selectedFields.has("aliases") && row.result.aliases) data.aliases = row.result.aliases;
      await updateTag(row.tag.id, data);
      if (row.endpointId && row.remoteId) await autoSaveStashId("tag", row.tag.id, row.endpointId, row.remoteId);
      setTagRows((prev) => prev.map((r, i) => (i === idx ? { ...r, status: "accepted" } : r)));
    } catch { /* keep as found */ }
  }

  function rejectTag(idx: number) {
    setTagRows((prev) => prev.map((r, i) => (i === idx ? { ...r, status: "rejected" } : r)));
  }

  async function acceptAllTags() {
    const found = tagRows.map((r, i) => ({ row: r, idx: i })).filter(({ row }) => row.status === "found" && row.result);
    for (const { idx } of found) { await acceptTag(idx); }
  }

  function toggleStudioField(idx: number, field: string) {
    setStudioRows((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      const next = new Set(r.selectedFields);
      if (next.has(field)) next.delete(field); else next.add(field);
      return { ...r, selectedFields: next };
    }));
  }

  function toggleTagField(idx: number, field: string) {
    setTagRows((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      const next = new Set(r.selectedFields);
      if (next.has(field)) next.delete(field); else next.add(field);
      return { ...r, selectedFields: next };
    }));
  }

  /* ─── Stats ──────────────────────────────────────────────────── */

  const rows = tab === "scenes" ? sceneRows : tab === "performers" ? perfRows : tab === "studios" ? studioRows : tagRows;
  const foundCount = rows.filter((r) => r.status === "found").length;
  const acceptedCount = rows.filter((r) => r.status === "accepted").length;
  const missedCount = rows.filter((r) => r.status === "no-result" || r.status === "error").length;
  const processedCount = rows.filter((r) => r.status !== "pending" && r.status !== "scraping").length;
  const totalCount = rows.length;

  // Studios/tags only use stashbox; scenes/performers also use community scrapers
  const scrapersForTab = tab === "scenes" ? sceneScrapers : tab === "performers" ? perfScrapers : [];

  // Build unified provider list: StashBox first (fingerprint-capable), then scrapers
  const providersForTab: Provider[] = [
    ...stashBoxEndpoints.map((ep) => ({ id: `stashbox:${ep.id}`, name: ep.name, type: "stashbox" as const })),
    ...scrapersForTab.map((s) => ({ id: `scraper:${s.id}`, name: s.name, type: "scraper" as const })),
  ];
  const totalProviderCount = providersForTab.length;

  /* ─── Render ─────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5">
            <ScanSearch className="h-5 w-5 text-text-accent" />
            Identify
          </h1>
          <p className="mt-1 text-text-muted text-[0.78rem]">
            Match scenes and performers against metadata providers
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {([
          { key: "scenes" as Tab, label: "Scenes", icon: Film, count: sceneRows.length },
          { key: "performers" as Tab, label: "Performers", icon: Users, count: perfRows.length },
          { key: "studios" as Tab, label: "Studios", icon: Building2, count: studioRows.length },
          { key: "tags" as Tab, label: "Tags", icon: Tag, count: tagRows.length },
        ]).map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => { if (!running) setTab(key); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-fast",
              tab === key
                ? "bg-accent-950 text-text-accent border border-border-accent shadow-[var(--shadow-glow-accent)]"
                : "text-text-muted border border-transparent hover:text-text-secondary hover:bg-surface-3/40",
              running && tab !== key && "opacity-40 cursor-not-allowed"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            <span className="text-mono-sm text-text-disabled ml-1">{count}</span>
          </button>
        ))}
      </div>

      {/* Stats strip */}
      {processedCount > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <div className="surface-stat px-3 py-2">
            <span className="text-kicker !text-text-disabled">Processed</span>
            <div className="text-lg font-semibold text-text-primary leading-tight">{processedCount}</div>
            {running && (
              <div className="meter-track mt-1.5">
                <div className="meter-fill" style={{ width: `${Math.round((processedCount / totalCount) * 100)}%` }} />
              </div>
            )}
          </div>
          <div className={cn("surface-stat px-3 py-2", foundCount > 0 && "surface-stat-accent")}>
            <span className="text-kicker !text-text-disabled">Found</span>
            <div className={cn("text-lg font-semibold leading-tight", foundCount > 0 ? "text-text-accent" : "text-text-primary")}>
              {foundCount}
            </div>
          </div>
          <div className="surface-stat px-3 py-2">
            <span className="text-kicker !text-text-disabled">Accepted</span>
            <div className="text-lg font-semibold text-status-success-text leading-tight">{acceptedCount}</div>
          </div>
          <div className="surface-stat px-3 py-2">
            <span className="text-kicker !text-text-disabled">Missed</span>
            <div className="text-lg font-semibold text-text-muted leading-tight">{missedCount}</div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="surface-card-sharp no-lift p-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-3">
          {/* Scraper selector */}
          <div className="flex items-center gap-2">
            <select
              value={selectedScraperId}
              onChange={(e) => setSelectedScraperId(e.target.value)}
              className="control-input py-1.5 text-xs min-w-[200px]"
              disabled={running}
            >
              <option value="">Seek all ({totalProviderCount} sources)</option>
              {stashBoxEndpoints.length > 0 && (
                <optgroup label="Stash-Box">
                  {stashBoxEndpoints.map((ep) => (
                    <option key={`stashbox:${ep.id}`} value={`stashbox:${ep.id}`}>{ep.name}</option>
                  ))}
                </optgroup>
              )}
              {totalProviderCount > 0 && (
                <optgroup label="Community Scrapers">
                  {scrapersForTab.map((s) => (
                    <option key={`scraper:${s.id}`} value={`scraper:${s.id}`}>{s.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={autoAccept}
              onChange={(e) => setAutoAccept(e.target.checked)}
              className="accent-[#c79b5c]"
              disabled={running}
            />
            Auto-accept
          </label>

          <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="accent-[#c79b5c]"
              disabled={running}
            />
            Show all
          </label>

          <div className="flex-1" />

          {!running ? (
            <div className="flex items-center gap-2">
              {foundCount > 0 && (
                <button
                  onClick={() => void (
                    tab === "scenes" ? acceptAllScenes() :
                    tab === "performers" ? acceptAllPerformers() :
                    tab === "studios" ? acceptAllStudios() :
                    acceptAllTags()
                  )}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-status-success-text border border-status-success/30 hover:bg-status-success/10 transition-all duration-fast"
                >
                  <Check className="h-3 w-3" />
                  Accept All ({foundCount})
                </button>
              )}
              <button
                onClick={() => void (
                  tab === "scenes" ? runSceneScrape() :
                  tab === "performers" ? runPerformerScrape() :
                  tab === "studios" ? runStudioScrape() :
                  runTagScrape()
                )}
                disabled={totalCount === 0 || totalProviderCount === 0}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium transition-all duration-normal",
                  "bg-gradient-to-r from-accent-900 via-accent-800 to-accent-900",
                  "text-accent-200 border border-border-accent shadow-[var(--shadow-glow-accent)]",
                  "hover:shadow-[var(--shadow-glow-accent-strong)] hover:border-border-accent-strong",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                {selectedScraperId ? <Play className="h-3 w-3" /> : <SkipForward className="h-3 w-3" />}
                {selectedScraperId ? `Identify All (${totalCount - acceptedCount})` : `Seek All (${totalCount - acceptedCount})`}
              </button>
            </div>
          ) : (
            <button
              onClick={() => { abortRef.current = true; }}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-status-error-text border border-status-error/30 hover:bg-status-error/10 transition-all duration-fast"
            >
              <Square className="h-3 w-3" />
              Stop
            </button>
          )}
        </div>

        {!selectedScraperId && (
          <div className="flex items-center gap-1.5 text-[0.65rem] text-text-disabled">
            <SkipForward className="h-3 w-3 text-text-accent" />
            Cycles through all scrapers per item with 5s timeout each — select a specific scraper above to use only one
          </div>
        )}
      </div>

      {/* Empty state */}
      {totalProviderCount === 0 && (
        <div className="surface-card-sharp no-lift p-12 text-center">
          <ScanSearch className="h-10 w-10 text-text-disabled mx-auto mb-3" />
          <p className="text-text-muted text-sm">
            No metadata providers configured for {tab}.
          </p>
          <p className="text-text-disabled text-xs mt-1">
            Add a Stash-Box endpoint or install scrapers in Settings.
          </p>
        </div>
      )}

      {totalCount === 0 && totalProviderCount > 0 && (
        <div className="surface-card-sharp no-lift p-12 text-center">
          <Check className="h-8 w-8 text-status-success-text mx-auto mb-2" />
          <p className="text-text-muted text-sm">
            {tab === "scenes" ? "All scenes are organized!" :
             tab === "performers" ? "All performers have complete metadata." :
             tab === "studios" ? "All studios have complete metadata." :
             "All tags loaded."}
          </p>
        </div>
      )}

      {/* Row list */}
      {totalCount > 0 && totalProviderCount > 0 && (
        <div className="space-y-1">
          {/* Expand all / collapse all */}
          <div className="flex items-center justify-end gap-2 px-1 mb-1">
            <button
              onClick={expandedIds.size > 0 ? collapseAll : expandAll}
              className="text-[0.65rem] text-text-muted hover:text-text-primary transition-colors"
            >
              {expandedIds.size > 0 ? "Collapse all" : "Expand all"}
            </button>
          </div>

          {tab === "scenes"
            ? sceneRows.map((row, idx) => (
                <SceneRowCard
                  key={row.scene.id}
                  row={row}
                  expanded={expandedIds.has(row.scene.id)}
                  onToggleExpand={() => toggleExpanded(row.scene.id)}
                  onAccept={() => void acceptScene(idx)}
                  onReject={() => void rejectScene(idx)}
                  onToggleField={(field) => toggleSceneField(idx, field)}
                  onTogglePerformer={(name) => toggleSceneExcludePerformer(idx, name)}
                  onToggleTag={(name) => toggleSceneExcludeTag(idx, name)}
                />
              ))
            : tab === "performers"
            ? perfRows.map((row, idx) => (
                <PerformerRowCard
                  key={row.performer.id}
                  row={row}
                  expanded={expandedIds.has(row.performer.id)}
                  onToggleExpand={() => toggleExpanded(row.performer.id)}
                  onAccept={(imageUrl) => void acceptPerformer(idx, imageUrl)}
                  onReject={() => rejectPerformer(idx)}
                  onToggleField={(field) => togglePerfField(idx, field)}
                />
              ))
            : tab === "studios"
            ? studioRows.map((row, idx) => (
                <StudioRowCard
                  key={row.studio.id}
                  row={row}
                  expanded={expandedIds.has(row.studio.id)}
                  onToggleExpand={() => toggleExpanded(row.studio.id)}
                  onAccept={() => void acceptStudio(idx)}
                  onReject={() => rejectStudio(idx)}
                  onToggleField={(field) => toggleStudioField(idx, field)}
                />
              ))
            : tagRows.map((row, idx) => (
                <TagRowCard
                  key={row.tag.id}
                  row={row}
                  expanded={expandedIds.has(row.tag.id)}
                  onToggleExpand={() => toggleExpanded(row.tag.id)}
                  onAccept={() => void acceptTag(idx)}
                  onReject={() => rejectTag(idx)}
                  onToggleField={(field) => toggleTagField(idx, field)}
                />
              ))}
        </div>
      )}
    </div>
  );
}

/* ─── Scene row ────────────────────────────────────────────────── */

function SceneRowCard({
  row,
  expanded,
  onToggleExpand,
  onAccept,
  onReject,
  onToggleField,
  onTogglePerformer,
  onToggleTag,
}: {
  row: SceneRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onAccept: () => void;
  onReject: () => void;
  onToggleField: (field: SceneField) => void;
  onTogglePerformer: (name: string) => void;
  onToggleTag: (name: string) => void;
}) {
  return (
    <div>
      <div
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleExpand(); }}
        className={cn(
          "w-full text-left surface-card-sharp no-lift p-3 flex items-center gap-3 transition-all duration-fast cursor-pointer",
          expanded && "border-border-accent/40",
          row.status === "accepted" && "opacity-50",
          row.status === "rejected" && "opacity-30"
        )}
      >
        <StatusDot status={row.status} />

        {/* Thumbnail */}
        {row.scene.thumbnailPath ? (
          <img
            src={toApiUrl(row.scene.thumbnailPath)}
            alt=""
            className="w-16 h-10 object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-10 bg-surface-3 flex-shrink-0" />
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[0.8rem] font-medium truncate">{row.scene.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-text-disabled text-[0.65rem]">{row.scene.durationFormatted ?? "—"}</span>
            {row.scene.resolution && (
              <span className="pill-accent px-1 py-0 text-[0.55rem]">{row.scene.resolution}</span>
            )}
            {row.normalized?.studioName && (
              <span className="text-text-accent text-[0.65rem]">{row.normalized.studioName}</span>
            )}
            {row.matchedScraper && row.status !== "pending" && (
              <span className="text-text-disabled text-[0.6rem] font-mono">via {row.matchedScraper}</span>
            )}
          </div>
        </div>

        {/* Actions for found */}
        {row.status === "found" && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onAccept(); }}
              className="p-1.5 hover:bg-status-success/15 text-status-success-text transition-colors"
              title="Accept"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onReject(); }}
              className="p-1.5 hover:bg-status-error/10 text-text-disabled hover:text-status-error-text transition-colors"
              title="Reject"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {row.status === "accepted" && (
          <Badge variant="accent" className="text-[0.55rem] flex-shrink-0">Applied</Badge>
        )}

        <ChevronDown
          className={cn(
            "h-3 w-3 text-text-disabled flex-shrink-0 transition-transform duration-fast",
            expanded && "rotate-180"
          )}
        />
      </div>

      {/* Expanded detail */}
      {expanded && row.normalized && (
        <div className="surface-card-sharp no-lift ml-1 mr-1 mb-1 p-4 border-border-accent/20">
          <div className="flex gap-4">
            {/* Large thumbnail on left */}
            {row.normalized.imageUrl && (
              <div
                className={cn(
                  "flex-shrink-0 cursor-pointer transition-opacity",
                  !row.selectedFields.has("image") && "opacity-40"
                )}
                onClick={(e) => { e.stopPropagation(); onToggleField("image"); }}
              >
                <div className="relative">
                  <img
                    src={row.normalized.imageUrl}
                    alt=""
                    className={cn(
                      "w-40 h-24 object-cover border transition-all",
                      row.selectedFields.has("image")
                        ? "border-border-accent/40"
                        : "border-border-subtle grayscale"
                    )}
                  />
                  <div className="absolute top-1 left-1">
                    <input
                      type="checkbox"
                      checked={row.selectedFields.has("image")}
                      onChange={() => onToggleField("image")}
                      className="accent-[#c79b5c]"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Fields on right */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* Row 1: Title + Date */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {row.normalized.title && (
                  <ToggleableField field="title" label="Title" value={row.normalized.title} enabled={row.selectedFields.has("title")} onToggle={() => onToggleField("title")} />
                )}
                {row.normalized.date && (
                  <ToggleableField field="date" label="Date" value={row.normalized.date} enabled={row.selectedFields.has("date")} onToggle={() => onToggleField("date")} />
                )}
                {row.normalized.studioName && (
                  <ToggleableField field="studio" label="Studio" value={row.normalized.studioName} enabled={row.selectedFields.has("studio")} onToggle={() => onToggleField("studio")} />
                )}
                {row.normalized.url && (
                  <ToggleableField field="url" label="URL" value={row.normalized.url} enabled={row.selectedFields.has("url")} onToggle={() => onToggleField("url")} />
                )}
              </div>

              {/* Performers as removable chips */}
              {row.normalized.performerNames.length > 0 && (
                <div className={cn("transition-opacity", !row.selectedFields.has("performers") && "opacity-40")}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <input
                      type="checkbox"
                      checked={row.selectedFields.has("performers")}
                      onChange={() => onToggleField("performers")}
                      className="accent-[#c79b5c]"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-kicker">Performers</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {row.normalized.performerNames.map((name) => {
                      const excluded = row.excludedPerformers.has(name);
                      return (
                        <span
                          key={name}
                          className={cn(
                            "inline-flex items-center gap-1 tag-chip transition-all",
                            excluded
                              ? "tag-chip-default opacity-40 line-through"
                              : "tag-chip-accent"
                          )}
                        >
                          {name}
                          <button
                            onClick={(e) => { e.stopPropagation(); onTogglePerformer(name); }}
                            className="hover:text-status-error-text transition-colors"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tags as removable chips */}
              {row.normalized.tagNames.length > 0 && (
                <div className={cn("transition-opacity", !row.selectedFields.has("tags") && "opacity-40")}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <input
                      type="checkbox"
                      checked={row.selectedFields.has("tags")}
                      onChange={() => onToggleField("tags")}
                      className="accent-[#c79b5c]"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-kicker">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {row.normalized.tagNames.map((name) => {
                      const excluded = row.excludedTags.has(name);
                      return (
                        <span
                          key={name}
                          className={cn(
                            "inline-flex items-center gap-1 tag-chip transition-all",
                            excluded
                              ? "tag-chip-default opacity-40 line-through"
                              : "tag-chip-default"
                          )}
                        >
                          {name}
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggleTag(name); }}
                            className="hover:text-status-error-text transition-colors"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {expanded && row.error && (
        <div className="surface-card-sharp no-lift ml-6 mr-1 mb-1 p-3 border-status-error/20">
          <p className="text-[0.7rem] text-status-error-text">{row.error}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Performer row ────────────────────────────────────────────── */

function PerformerRowCard({
  row,
  expanded,
  onToggleExpand,
  onAccept,
  onReject,
  onToggleField,
}: {
  row: PerformerRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onAccept: (imageUrl?: string) => void;
  onReject: () => void;
  onToggleField: (field: string) => void;
}) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

  // All available images: imageUrls array + imageUrl single
  const allImages = row.result
    ? [...new Set([
        ...(row.result.imageUrl ? [row.result.imageUrl] : []),
        ...(row.result.imageUrls ?? []),
      ].filter((u) => u.startsWith("http") || u.startsWith("data:image/")))]
    : [];

  const effectiveImageUrl = allImages[selectedImageIndex] ?? allImages[0] ?? null;
  return (
    <div>
      <div
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleExpand(); }}
        className={cn(
          "surface-card-sharp no-lift flex items-center gap-3 px-3 py-2.5 transition-all duration-fast cursor-pointer",
          expanded && "border-border-accent/40",
          row.status === "accepted" && "opacity-50",
          row.status === "rejected" && "opacity-30"
        )}
      >
        <StatusDot status={row.status} />

        {/* Image */}
        <div className="flex-shrink-0 h-10 w-8 overflow-hidden bg-surface-3">
          {row.performer.imagePath ? (
            <img src={toApiUrl(row.performer.imagePath)!} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-3 w-3 text-text-disabled/40" />
            </div>
          )}
        </div>

        {/* Name + scraped summary */}
        <div className="flex-1 min-w-0">
          <div className="text-[0.8rem] font-medium text-text-primary truncate">{row.performer.name}</div>
          {row.result && (row.status === "found" || row.status === "accepted") && (
            <div className="text-[0.62rem] text-text-muted truncate mt-0.5">
              {[row.result.gender, row.result.country, row.result.birthdate].filter(Boolean).join(" | ")}
            </div>
          )}
          {row.matchedScraper && row.status !== "pending" && (
            <span className="text-text-disabled text-[0.58rem] font-mono">via {row.matchedScraper}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {row.status === "scraping" && (
            <Loader2 className="h-3.5 w-3.5 text-text-accent animate-spin" />
          )}
          {row.status === "found" && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onAccept(effectiveImageUrl ?? undefined); }}
                className="flex items-center gap-1 px-2 py-1 text-[0.62rem] text-status-success-text border border-status-success/25 hover:bg-status-success/10 transition-colors"
              >
                <Check className="h-2.5 w-2.5" />
                Accept
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onReject(); }}
                className="p-1 text-text-disabled hover:text-status-error-text transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          )}
          {row.status === "no-result" && <span className="text-[0.62rem] text-text-disabled">No result</span>}
          {row.status === "error" && <span className="text-[0.62rem] text-status-error-text">Error</span>}
          {row.status === "accepted" && (
            <Badge variant="accent" className="text-[0.55rem]">Applied</Badge>
          )}
          {row.status === "rejected" && <span className="text-[0.62rem] text-text-disabled">Skipped</span>}
        </div>

        <ChevronDown
          className={cn(
            "h-3 w-3 text-text-disabled flex-shrink-0 transition-transform duration-fast",
            expanded && "rotate-180"
          )}
        />
      </div>

      {/* Expanded performer detail */}
      {expanded && row.result && (
        <div className="surface-card-sharp no-lift ml-6 mr-1 mb-1 p-3 border-border-accent/20">
          <div className="flex gap-4">
            {/* Image selection */}
            {allImages.length > 0 && (
              <div className="flex-shrink-0 space-y-2 flex flex-col items-center">
                {/* Selected/primary image — click to browse */}
                <button
                  onClick={(e) => { e.stopPropagation(); if (allImages.length > 1) setImagePickerOpen(true); }}
                  className="w-24 h-32 overflow-hidden bg-surface-3 border border-border-subtle hover:border-border-accent transition-all"
                >
                  {effectiveImageUrl && (
                    <img src={effectiveImageUrl} alt="" className="w-full h-full object-cover" />
                  )}
                </button>
                {allImages.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setImagePickerOpen(true); }}
                    className="text-[0.6rem] text-text-accent hover:text-text-accent-bright transition-colors text-center"
                  >
                    Browse all ({allImages.length})
                  </button>
                )}
                {imagePickerOpen && (
                  <ImagePickerModal
                    images={allImages}
                    selectedIndex={selectedImageIndex}
                    onSelect={setSelectedImageIndex}
                    onClose={() => setImagePickerOpen(false)}
                    title="Select Performer Image"
                  />
                )}
              </div>
            )}

            {/* Metadata fields */}
            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-[0.8rem]">
                {row.result.name && <ToggleableField field="name" label="Name" value={row.result.name} enabled={row.selectedFields.has("name")} onToggle={() => onToggleField("name")} />}
                {row.result.gender && <ToggleableField field="gender" label="Gender" value={row.result.gender} enabled={row.selectedFields.has("gender")} onToggle={() => onToggleField("gender")} />}
                {row.result.birthdate && <ToggleableField field="birthdate" label="Birthdate" value={row.result.birthdate} enabled={row.selectedFields.has("birthdate")} onToggle={() => onToggleField("birthdate")} />}
                {row.result.country && <ToggleableField field="country" label="Country" value={row.result.country} enabled={row.selectedFields.has("country")} onToggle={() => onToggleField("country")} />}
                {row.result.ethnicity && <ToggleableField field="ethnicity" label="Ethnicity" value={row.result.ethnicity} enabled={row.selectedFields.has("ethnicity")} onToggle={() => onToggleField("ethnicity")} />}
                {row.result.height && <ToggleableField field="height" label="Height" value={row.result.height} enabled={row.selectedFields.has("height")} onToggle={() => onToggleField("height")} />}
                {row.result.weight && <ToggleableField field="weight" label="Weight" value={String(row.result.weight)} enabled={row.selectedFields.has("weight")} onToggle={() => onToggleField("weight")} />}
                {row.result.hairColor && <ToggleableField field="hairColor" label="Hair" value={row.result.hairColor} enabled={row.selectedFields.has("hairColor")} onToggle={() => onToggleField("hairColor")} />}
                {row.result.eyeColor && <ToggleableField field="eyeColor" label="Eyes" value={row.result.eyeColor} enabled={row.selectedFields.has("eyeColor")} onToggle={() => onToggleField("eyeColor")} />}
                {row.result.measurements && <ToggleableField field="measurements" label="Measurements" value={row.result.measurements} enabled={row.selectedFields.has("measurements")} onToggle={() => onToggleField("measurements")} />}
                {row.result.aliases && <ToggleableField field="aliases" label="Aliases" value={row.result.aliases} enabled={row.selectedFields.has("aliases")} onToggle={() => onToggleField("aliases")} />}
                {row.result.tattoos && <ToggleableField field="tattoos" label="Tattoos" value={row.result.tattoos} enabled={row.selectedFields.has("tattoos")} onToggle={() => onToggleField("tattoos")} />}
                {row.result.piercings && <ToggleableField field="piercings" label="Piercings" value={row.result.piercings} enabled={row.selectedFields.has("piercings")} onToggle={() => onToggleField("piercings")} />}
                {row.result.tagNames.length > 0 && (
                  <ToggleableField field="tagNames" label="Tags" value={row.result.tagNames.join(", ")} enabled={row.selectedFields.has("tagNames")} onToggle={() => onToggleField("tagNames")} />
                )}
                {allImages.length > 0 && (
                  <ToggleableField field="imageUrl" label="Image" value={`${allImages.length} available`} enabled={row.selectedFields.has("imageUrl")} onToggle={() => onToggleField("imageUrl")} />
                )}
              </div>
              {row.result.details && (
                <div className="mt-2">
                  <ToggleableField field="details" label="Details" value={row.result.details.slice(0, 200) + (row.result.details.length > 200 ? "..." : "")} enabled={row.selectedFields.has("details")} onToggle={() => onToggleField("details")} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {expanded && row.error && (
        <div className="surface-card-sharp no-lift ml-6 mr-1 mb-1 p-3 border-status-error/20">
          <p className="text-[0.7rem] text-status-error-text">{row.error}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Studio row ──────────────────────────────────────────────── */

function StudioRowCard({
  row,
  expanded,
  onToggleExpand,
  onAccept,
  onReject,
  onToggleField,
}: {
  row: StudioRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onAccept: () => void;
  onReject: () => void;
  onToggleField: (field: string) => void;
}) {
  return (
    <div>
      <div
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleExpand(); }}
        className={cn(
          "surface-card-sharp no-lift flex items-center gap-3 px-3 py-2.5 transition-all duration-fast cursor-pointer",
          expanded && "border-border-accent/40",
          row.status === "accepted" && "opacity-50",
          row.status === "rejected" && "opacity-30"
        )}
      >
        <StatusDot status={row.status} />
        <Building2 className="h-4 w-4 text-text-disabled flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[0.8rem] font-medium text-text-primary truncate">{row.studio.name}</div>
          {row.result && row.status === "found" && (
            <div className="text-[0.62rem] text-text-muted truncate mt-0.5">
              {[row.result.url, row.result.parentName].filter(Boolean).join(" | ")}
            </div>
          )}
          {row.matchedScraper && row.status !== "pending" && (
            <span className="text-text-disabled text-[0.58rem] font-mono">via {row.matchedScraper}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {row.status === "scraping" && <Loader2 className="h-3.5 w-3.5 text-text-accent animate-spin" />}
          {row.status === "found" && (
            <>
              <button onClick={(e) => { e.stopPropagation(); onAccept(); }} className="flex items-center gap-1 px-2 py-1 text-[0.62rem] text-status-success-text border border-status-success/25 hover:bg-status-success/10 transition-colors">
                <Check className="h-2.5 w-2.5" /> Accept
              </button>
              <button onClick={(e) => { e.stopPropagation(); onReject(); }} className="p-1 text-text-disabled hover:text-status-error-text transition-colors">
                <X className="h-3 w-3" />
              </button>
            </>
          )}
          {row.status === "no-result" && <span className="text-[0.62rem] text-text-disabled">No result</span>}
          {row.status === "error" && <span className="text-[0.62rem] text-status-error-text">Error</span>}
          {row.status === "accepted" && <Badge variant="accent" className="text-[0.55rem]">Applied</Badge>}
        </div>

        <ChevronDown className={cn("h-3 w-3 text-text-disabled flex-shrink-0 transition-transform duration-fast", expanded && "rotate-180")} />
      </div>

      {expanded && row.result && (
        <div className="surface-card-sharp no-lift ml-6 mr-1 mb-1 p-3 border-border-accent/20">
          <div className="flex gap-4">
            {/* Image preview */}
            {row.result.imageUrl && (
              <div
                className={cn("flex-shrink-0 cursor-pointer transition-opacity", !row.selectedFields.has("imageUrl") && "opacity-40")}
                onClick={(e) => { e.stopPropagation(); onToggleField("imageUrl"); }}
              >
                <div className="relative">
                  <img
                    src={row.result.imageUrl}
                    alt=""
                    className={cn(
                      "w-32 h-20 object-contain border transition-all",
                      row.selectedFields.has("imageUrl") ? "border-border-accent/40" : "border-border-subtle grayscale"
                    )}
                  />
                  <div className="absolute top-1 left-1">
                    <input type="checkbox" checked={row.selectedFields.has("imageUrl")} onChange={() => onToggleField("imageUrl")} className="accent-[#c79b5c]" onClick={(e) => e.stopPropagation()} />
                  </div>
                </div>
              </div>
            )}
            {/* Fields */}
            <div className="flex-1 min-w-0 grid grid-cols-2 gap-x-6 gap-y-2 text-[0.8rem]">
              {row.result.name && <ToggleableField field="name" label="Name" value={row.result.name} enabled={row.selectedFields.has("name")} onToggle={() => onToggleField("name")} />}
              {row.result.url && <ToggleableField field="url" label="URL" value={row.result.url} enabled={row.selectedFields.has("url")} onToggle={() => onToggleField("url")} />}
              {row.result.parentName && <ToggleableField field="parentName" label="Parent" value={row.result.parentName} enabled={row.selectedFields.has("parentName")} onToggle={() => onToggleField("parentName")} />}
            </div>
          </div>
        </div>
      )}

      {expanded && row.error && (
        <div className="surface-card-sharp no-lift ml-6 mr-1 mb-1 p-3 border-status-error/20">
          <p className="text-[0.7rem] text-status-error-text">{row.error}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Tag row ─────────────────────────────────────────────────── */

function TagRowCard({
  row,
  expanded,
  onToggleExpand,
  onAccept,
  onReject,
  onToggleField,
}: {
  row: TagRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onAccept: () => void;
  onReject: () => void;
  onToggleField: (field: string) => void;
}) {
  return (
    <div>
      <div
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggleExpand(); }}
        className={cn(
          "surface-card-sharp no-lift flex items-center gap-3 px-3 py-2.5 transition-all duration-fast cursor-pointer",
          expanded && "border-border-accent/40",
          row.status === "accepted" && "opacity-50",
          row.status === "rejected" && "opacity-30"
        )}
      >
        <StatusDot status={row.status} />
        <Tag className="h-4 w-4 text-text-disabled flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[0.8rem] font-medium text-text-primary truncate">{row.tag.name}</div>
          {row.result && row.status === "found" && row.result.description && (
            <div className="text-[0.62rem] text-text-muted truncate mt-0.5">
              {row.result.description.slice(0, 80)}
            </div>
          )}
          {row.matchedScraper && row.status !== "pending" && (
            <span className="text-text-disabled text-[0.58rem] font-mono">via {row.matchedScraper}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {row.status === "scraping" && <Loader2 className="h-3.5 w-3.5 text-text-accent animate-spin" />}
          {row.status === "found" && (
            <>
              <button onClick={(e) => { e.stopPropagation(); onAccept(); }} className="flex items-center gap-1 px-2 py-1 text-[0.62rem] text-status-success-text border border-status-success/25 hover:bg-status-success/10 transition-colors">
                <Check className="h-2.5 w-2.5" /> Accept
              </button>
              <button onClick={(e) => { e.stopPropagation(); onReject(); }} className="p-1 text-text-disabled hover:text-status-error-text transition-colors">
                <X className="h-3 w-3" />
              </button>
            </>
          )}
          {row.status === "no-result" && <span className="text-[0.62rem] text-text-disabled">No result</span>}
          {row.status === "error" && <span className="text-[0.62rem] text-status-error-text">Error</span>}
          {row.status === "accepted" && <Badge variant="accent" className="text-[0.55rem]">Applied</Badge>}
        </div>

        <ChevronDown className={cn("h-3 w-3 text-text-disabled flex-shrink-0 transition-transform duration-fast", expanded && "rotate-180")} />
      </div>

      {expanded && row.result && (
        <div className="surface-card-sharp no-lift ml-6 mr-1 mb-1 p-3 border-border-accent/20">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[0.8rem]">
            {row.result.name && <ToggleableField field="name" label="Name" value={row.result.name} enabled={row.selectedFields.has("name")} onToggle={() => onToggleField("name")} />}
            {row.result.description && <ToggleableField field="description" label="Description" value={row.result.description.slice(0, 200)} enabled={row.selectedFields.has("description")} onToggle={() => onToggleField("description")} />}
            {row.result.aliases && <ToggleableField field="aliases" label="Aliases" value={row.result.aliases} enabled={row.selectedFields.has("aliases")} onToggle={() => onToggleField("aliases")} />}
          </div>
        </div>
      )}

      {expanded && row.error && (
        <div className="surface-card-sharp no-lift ml-6 mr-1 mb-1 p-3 border-status-error/20">
          <p className="text-[0.7rem] text-status-error-text">{row.error}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Shared small components ──────────────────────────────────── */

function StatusDot({ status }: { status: string }) {
  return (
    <div className="flex-shrink-0 w-4">
      {status === "scraping" && <Loader2 className="h-3.5 w-3.5 animate-spin text-text-accent" />}
      {status === "found" && <div className="led led-active" />}
      {status === "accepted" && <div className="led led-accent" />}
      {(status === "error" || status === "no-result") && <div className="led led-idle" />}
      {status === "rejected" && <div className="led led-idle" />}
      {status === "pending" && <div className="led led-idle" />}
    </div>
  );
}

function ToggleableField({
  field,
  label,
  value,
  enabled,
  onToggle,
}: {
  field: string;
  label: string;
  value: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "col-span-2 sm:col-span-1 flex items-start gap-2 cursor-pointer transition-opacity",
        !enabled && "opacity-40"
      )}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={onToggle}
        className="accent-[#c79b5c] mt-0.5 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="min-w-0">
        <span className="text-text-disabled text-[0.6rem] uppercase tracking-wider font-semibold">{label}</span>
        <p className={cn("truncate text-[0.78rem]", enabled ? "text-text-primary" : "text-text-disabled line-through")}>{value}</p>
      </div>
    </div>
  );
}
