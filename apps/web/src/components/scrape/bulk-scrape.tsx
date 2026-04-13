"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Checkbox } from "@obscura/ui/primitives/checkbox";
import { cn } from "@obscura/ui/lib/utils";
import {
  Check,
  Fingerprint,
  Loader2,
  ScanSearch,
  Play,
  Square,
  SkipForward,
  Film,
  FolderOpen,
  Images,
  Image,
  Library,
  Music,
  Users,
  Building2,
  Tag,
} from "lucide-react";
import {
  fetchAllScenes,
  fetchAllPerformers,
  fetchStudios,
  fetchTags,
  fetchInstalledScrapers,
  fetchInstalledPlugins,
  fetchStashBoxEndpoints,
  fetchSceneFolders,
  fetchGalleries,
  fetchImages,
  fetchAudioLibraries,
  type InstalledPlugin,
} from "../../lib/api";
import { entityTerms } from "../../lib/terminology";
import type {
  Tab,
  Provider,
  SceneRow,
  PerformerRow,
  StudioRow,
  TagRow,
  ScraperPackage,
  StashBoxEndpoint,
  SceneListItem,
  PerformerItem,
  StudioItem,
  TagItem,
} from "./types";
import { SCENE_FIELDS, tabEntityLabel } from "./types";

import { ScrapeSceneRows, runSceneScrape, acceptAllScenes } from "./scrape-scenes-tab";
import { ScrapePerformerRows, runPerformerScrape, acceptAllPerformers } from "./scrape-performers-tab";
import { ScrapeStudioRows, runStudioScrape, acceptAllStudios } from "./scrape-studios-tab";
import { ScrapeTagRows, runTagScrape, acceptAllTags } from "./scrape-tags-tab";
import { ScrapePhashesTab } from "./scrape-phashes-tab";

import type { VideoFolderRow, GalleryRow, ImageRow, AudioLibraryRow, AudioTrackRow } from "../identify/types";
import { VIDEO_FOLDER_FIELDS, GALLERY_FIELDS, IMAGE_FIELDS, AUDIO_LIBRARY_FIELDS, AUDIO_TRACK_FIELDS } from "../identify/types";
import { IdentifyVideoFolderRows, runVideoFolderIdentify, acceptAllVideoFolders } from "../identify/identify-video-folders-tab";
import { IdentifyGalleryRows } from "../identify/identify-galleries-tab";
import { IdentifyImageRows } from "../identify/identify-images-tab";
import { IdentifyAudioLibraryRows } from "../identify/identify-audio-libraries-tab";
import { IdentifyAudioTrackRows } from "../identify/identify-audio-tracks-tab";

/* ─── Component ─────────────────────────────────────────────────── */

export function BulkScrape() {
  const [tab, setTab] = useState<Tab>("scenes");
  const [stashBoxEndpoints, setStashBoxEndpoints] = useState<StashBoxEndpoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Scene state
  const [sceneRows, setSceneRows] = useState<SceneRow[]>([]);
  const [sceneScrapers, setSceneScrapers] = useState<ScraperPackage[]>([]);

  // Performer state
  const [perfRows, setPerfRows] = useState<PerformerRow[]>([]);
  const [perfScrapers, setPerfScrapers] = useState<ScraperPackage[]>([]);

  // Obscura plugins
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);

  // Studio state
  const [studioRows, setStudioRows] = useState<StudioRow[]>([]);

  // Tag state
  const [tagRows, setTagRows] = useState<TagRow[]>([]);

  // New entity states
  const [folderRows, setFolderRows] = useState<VideoFolderRow[]>([]);
  const [galleryRows, setGalleryRows] = useState<GalleryRow[]>([]);
  const [imageRows, setImageRows] = useState<ImageRow[]>([]);
  const [audioLibraryRows, setAudioLibraryRows] = useState<AudioLibraryRow[]>([]);
  const [audioTrackRows, setAudioTrackRows] = useState<AudioTrackRow[]>([]);

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
    if (tab === "scenes") setExpandedIds(new Set(sceneRows.map((r) => r.scene.id)));
    else if (tab === "video-folders") setExpandedIds(new Set(folderRows.map((r) => r.folder.id)));
    else if (tab === "galleries") setExpandedIds(new Set(galleryRows.map((r) => r.gallery.id)));
    else if (tab === "images") setExpandedIds(new Set(imageRows.map((r) => r.image.id)));
    else if (tab === "audio-libraries") setExpandedIds(new Set(audioLibraryRows.map((r) => r.library.id)));
    else if (tab === "audio-tracks") setExpandedIds(new Set(audioTrackRows.map((r) => r.track.id)));
    else if (tab === "performers") setExpandedIds(new Set(perfRows.map((r) => r.performer.id)));
    else if (tab === "studios") setExpandedIds(new Set(studioRows.map((r) => r.studio.id)));
    else if (tab === "tags") setExpandedIds(new Set(tagRows.map((r) => r.tag.id)));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [scenesRes, perfRes, studiosRes, tagsRes, scrapersRes, stashBoxRes, foldersRes, galleriesRes, imagesRes, audioRes, pluginsRes] = await Promise.all([
        fetchAllScenes({ sort: "created_at" }),
        fetchAllPerformers({ sort: "name", order: "asc" }),
        fetchStudios(),
        fetchTags(),
        fetchInstalledScrapers(),
        fetchStashBoxEndpoints().catch(() => ({ endpoints: [] })),
        fetchSceneFolders({ root: "all", limit: 500 }).catch(() => ({ items: [], total: 0, limit: 500, offset: 0 })),
        fetchGalleries({}).catch(() => ({ galleries: [], total: 0, limit: 100, offset: 0 })),
        fetchImages({}).catch(() => ({ images: [], total: 0, limit: 100, offset: 0 })),
        fetchAudioLibraries({}).catch(() => ({ items: [], total: 0 })),
        fetchInstalledPlugins().catch(() => [] as InstalledPlugin[]),
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

      // Store installed Obscura plugins (only enabled ones with auth OK)
      setPlugins(pluginsRes.filter((p) => p.enabled));

      // Initialize new entity rows
      setFolderRows(foldersRes.items.map((folder) => ({
        folder,
        status: "pending" as const,
        selectedFields: new Set(VIDEO_FOLDER_FIELDS),
        wizardStep: "idle" as const,
      })));
      setGalleryRows(galleriesRes.galleries.map((gallery) => ({
        gallery,
        status: "pending" as const,
        selectedFields: new Set(GALLERY_FIELDS),
      })));
      setImageRows(imagesRes.images.filter((img) => !img.organized).map((image) => ({
        image,
        status: "pending" as const,
        selectedFields: new Set(IMAGE_FIELDS),
      })));
      setAudioLibraryRows(audioRes.items.map((library) => ({
        library,
        status: "pending" as const,
        selectedFields: new Set(AUDIO_LIBRARY_FIELDS),
      })));
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

  /* ─── Stats ──────────────────────────────────────────────────── */

  const rows =
    tab === "scenes" ? sceneRows
    : tab === "video-folders" ? folderRows
    : tab === "galleries" ? galleryRows
    : tab === "images" ? imageRows
    : tab === "audio-libraries" ? audioLibraryRows
    : tab === "audio-tracks" ? audioTrackRows
    : tab === "performers" ? perfRows
    : tab === "studios" ? studioRows
    : tab === "tags" ? tagRows
    : [];
  const foundCount = rows.filter((r) => r.status === "found").length;
  const acceptedCount = rows.filter((r) => r.status === "accepted").length;
  const missedCount = rows.filter((r) => r.status === "no-result" || r.status === "error").length;
  const processedCount = rows.filter((r) => r.status !== "pending" && r.status !== "scraping").length;
  const totalCount = rows.length;

  // Studios/tags only use stashbox; scenes/performers also use community scrapers
  const scrapersForTab = tab === "scenes" ? sceneScrapers : tab === "performers" ? perfScrapers : [];

  // Filter Obscura plugins by capabilities relevant to the current tab
  const pluginsForTab = plugins.filter((p) => {
    const caps = p.capabilities ?? {};
    switch (tab) {
      case "scenes": return caps.videoByURL || caps.videoByName || caps.videoByFragment;
      case "video-folders": return caps.folderByName || caps.folderByFragment || caps.folderCascade;
      case "galleries": return caps.galleryByURL || caps.galleryByFragment;
      case "images": return caps.imageByURL;
      case "audio-libraries": return caps.audioLibraryByName;
      case "audio-tracks": return caps.audioByURL || caps.audioByFragment;
      case "performers": return caps.performerByURL || caps.performerByName || caps.performerByFragment;
      default: return false;
    }
  });

  // Build unified provider list: StashBox first, then Obscura plugins, then stash scrapers
  const providersForTab: Provider[] = [
    ...stashBoxEndpoints.map((ep) => ({ id: `stashbox:${ep.id}`, name: ep.name, type: "stashbox" as const })),
    ...pluginsForTab.map((p) => ({ id: `plugin:${p.id}`, name: p.name, type: "scraper" as const })),
    ...scrapersForTab.map((s) => ({ id: `scraper:${s.id}`, name: s.name, type: "scraper" as const })),
  ];
  const totalProviderCount = providersForTab.length;

  /* ─── Run / accept dispatchers ──────────────────────────────── */

  const sharedTabProps = {
    stashBoxEndpoints,
    selectedScraperId,
    autoAccept,
    running,
    setRunning,
    abortRef,
    expandedIds,
    toggleExpanded,
  };

  function handleRun() {
    if (tab === "scenes") {
      void runSceneScrape({ ...sharedTabProps, sceneRows, setSceneRows, sceneScrapers, plugins: pluginsForTab });
    } else if (tab === "video-folders") {
      void runVideoFolderIdentify({
        rows: folderRows,
        setRows: setFolderRows,
        plugins: pluginsForTab,
        selectedProviderId: selectedScraperId,
        autoAccept,
        abortRef,
        setRunning,
      });
    } else if (tab === "performers") {
      void runPerformerScrape({ ...sharedTabProps, perfRows, setPerfRows, perfScrapers });
    } else if (tab === "studios") {
      void runStudioScrape({ ...sharedTabProps, studioRows, setStudioRows });
    } else if (tab === "tags") {
      void runTagScrape({ ...sharedTabProps, tagRows, setTagRows });
    }
  }

  function handleAcceptAll() {
    if (tab === "scenes") void acceptAllScenes(sceneRows, setSceneRows);
    else if (tab === "video-folders") void acceptAllVideoFolders(folderRows, setFolderRows);
    else if (tab === "performers") void acceptAllPerformers(perfRows, setPerfRows);
    else if (tab === "studios") void acceptAllStudios(studioRows, setStudioRows);
    else if (tab === "tags") void acceptAllTags(tagRows, setTagRows);
  }

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
            Match media against metadata providers and identification plugins
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hidden">
        {([
          { key: "scenes" as Tab, label: entityTerms.scenes, icon: Film, count: sceneRows.length },
          { key: "video-folders" as Tab, label: "Folders", icon: FolderOpen, count: folderRows.length },
          { key: "galleries" as Tab, label: "Galleries", icon: Images, count: galleryRows.length },
          { key: "images" as Tab, label: "Images", icon: Image, count: imageRows.length },
          { key: "audio-libraries" as Tab, label: "Albums", icon: Library, count: audioLibraryRows.length },
          { key: "audio-tracks" as Tab, label: "Tracks", icon: Music, count: audioTrackRows.length },
          { key: "performers" as Tab, label: entityTerms.performers, icon: Users, count: perfRows.length },
          { key: "studios" as Tab, label: "Studios", icon: Building2, count: studioRows.length },
          { key: "tags" as Tab, label: "Tags", icon: Tag, count: tagRows.length },
          { key: "phashes" as Tab, label: "pHashes", icon: Fingerprint, count: null as number | null },
        ])
        .filter(({ key, count }) => {
          // Hide empty new entity tabs (no data in library)
          if (["video-folders", "galleries", "images", "audio-libraries", "audio-tracks"].includes(key) && count === 0 && tab !== key) return false;
          return true;
        })
        .map(({ key, label, icon: Icon, count }) => (
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
            {count !== null && (
              <span className="text-mono-sm text-text-disabled ml-1">{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* pHashes tab is self-contained — skips the shared stats/controls/run pipeline */}
      {tab === "phashes" && <ScrapePhashesTab />}

      {tab !== "phashes" && (
        <>
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
      <div className="surface-card no-lift p-3 space-y-2.5">
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
              {pluginsForTab.length > 0 && (
                <optgroup label="Obscura Plugins">
                  {pluginsForTab.map((p) => (
                    <option key={`plugin:${p.id}`} value={`plugin:${p.id}`}>{p.name}</option>
                  ))}
                </optgroup>
              )}
              {stashBoxEndpoints.length > 0 && (
                <optgroup label="Stash-Box">
                  {stashBoxEndpoints.map((ep) => (
                    <option key={`stashbox:${ep.id}`} value={`stashbox:${ep.id}`}>{ep.name}</option>
                  ))}
                </optgroup>
              )}
              {scrapersForTab.length > 0 && (
                <optgroup label="Community Scrapers">
                  {scrapersForTab.map((s) => (
                    <option key={`scraper:${s.id}`} value={`scraper:${s.id}`}>{s.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
            <Checkbox
              checked={autoAccept}
              onChange={(e) => setAutoAccept(e.target.checked)}
              disabled={running}
            />
            Auto-accept
          </label>

          <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
            <Checkbox
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              disabled={running}
            />
            Show all
          </label>

          <div className="flex-1" />

          {!running ? (
            <div className="flex items-center gap-2">
              {foundCount > 0 && (
                <button
                  onClick={handleAcceptAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-status-success-text border border-status-success/30 hover:bg-status-success/10 transition-all duration-fast"
                >
                  <Check className="h-3 w-3" />
                  Accept All ({foundCount})
                </button>
              )}
              <button
                onClick={handleRun}
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
        <div className="surface-card no-lift p-12 text-center">
          <ScanSearch className="h-10 w-10 text-text-disabled mx-auto mb-3" />
          <p className="text-text-muted text-sm">
            No metadata providers configured for {tabEntityLabel(tab)}.
          </p>
          <p className="text-text-disabled text-xs mt-1">
            Add a Stash-Box endpoint or install scrapers in Settings.
          </p>
        </div>
      )}

      {totalCount === 0 && totalProviderCount > 0 && (
        <div className="surface-card no-lift p-12 text-center">
          <Check className="h-8 w-8 text-status-success-text mx-auto mb-2" />
          <p className="text-text-muted text-sm">
            {tab === "scenes" ? `All ${entityTerms.scenes.toLowerCase()} are organized!` :
             tab === "performers" ? `All ${entityTerms.performers.toLowerCase()} have complete metadata.` :
             tab === "studios" ? `All ${entityTerms.studios.toLowerCase()} have complete metadata.` :
             `All ${entityTerms.tags.toLowerCase()} loaded.`}
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

          {tab === "scenes" && (
            <ScrapeSceneRows
              sceneRows={sceneRows}
              setSceneRows={setSceneRows}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
            />
          )}
          {tab === "video-folders" && (
            <IdentifyVideoFolderRows
              rows={folderRows}
              setRows={setFolderRows}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
            />
          )}
          {tab === "galleries" && (
            <IdentifyGalleryRows
              rows={galleryRows}
              setRows={setGalleryRows}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
            />
          )}
          {tab === "images" && (
            <IdentifyImageRows
              rows={imageRows}
              setRows={setImageRows}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
            />
          )}
          {tab === "audio-libraries" && (
            <IdentifyAudioLibraryRows
              rows={audioLibraryRows}
              setRows={setAudioLibraryRows}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
            />
          )}
          {tab === "audio-tracks" && (
            <IdentifyAudioTrackRows
              rows={audioTrackRows}
              setRows={setAudioTrackRows}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
            />
          )}
          {tab === "performers" && (
            <ScrapePerformerRows
              perfRows={perfRows}
              setPerfRows={setPerfRows}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
            />
          )}
          {tab === "studios" && (
            <ScrapeStudioRows
              studioRows={studioRows}
              setStudioRows={setStudioRows}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
            />
          )}
          {tab === "tags" && (
            <ScrapeTagRows
              tagRows={tagRows}
              setTagRows={setTagRows}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
            />
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
}
