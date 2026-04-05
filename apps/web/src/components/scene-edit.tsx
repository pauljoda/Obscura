"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from "react";
import { Button } from "@obscura/ui/primitives/button";
import { cn } from "@obscura/ui/lib/utils";
import {
  ArrowLeft,
  Save,
  Loader2,
  Search,
  X,
  Wand2,
  Pencil,
  Star,
  Calendar,
  Link2,
  User,
  Tag as TagIcon,
  Image as ImageIcon,
  Upload,
  Building2,
  FileText,
  Droplets,
  CheckCircle2,
  Clapperboard,
  SkipForward,
} from "lucide-react";
import Link from "next/link";
import {
  fetchSceneDetail,
  updateScene,
  fetchInstalledScrapers,
  fetchTags,
  fetchPerformers,
  fetchStudios,
  scrapeScene,
  uploadThumbnail,
  uploadThumbnailFromUrl,
  generateThumbnailFromFrame,
  deleteThumbnail,
  toApiUrl,
  type SceneDetail,
  type ScraperPackage,
  type NormalizedScrapeResult,
  type TagItem,
  type PerformerItem,
  type StudioItem,
} from "../lib/api";

interface SceneEditProps {
  id: string;
  inline?: boolean;
  onSaved?: () => void;
  currentPlaybackTime?: number;
}

// ─── ChipInput ─────────────────────────────────────────────────

interface ChipInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  suggestions: { name: string; count?: number }[];
  placeholder?: string;
  newItems?: Set<string>;
}

function ChipInput({
  values,
  onChange,
  suggestions,
  placeholder,
  newItems,
}: ChipInputProps) {
  const [input, setInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Show all non-selected suggestions on focus, filter when typing
  const available = suggestions.filter(
    (s) => !values.some((v) => v.toLowerCase() === s.name.toLowerCase())
  );
  const filtered = input.trim()
    ? available.filter((s) =>
        s.name.toLowerCase().includes(input.toLowerCase())
      )
    : available;

  // Show "Add X" option when typing something not in suggestions
  const inputTrimmed = input.trim();
  const showAddOption =
    inputTrimmed &&
    !suggestions.some(
      (s) => s.name.toLowerCase() === inputTrimmed.toLowerCase()
    ) &&
    !values.some((v) => v.toLowerCase() === inputTrimmed.toLowerCase());

  const addValue = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (
        trimmed &&
        !values.some((v) => v.toLowerCase() === trimmed.toLowerCase())
      ) {
        onChange([...values, trimmed]);
      }
      setInput("");
      setShowDropdown(false);
      setActiveIndex(-1);
      inputRef.current?.focus();
    },
    [values, onChange]
  );

  const removeValue = useCallback(
    (idx: number) => {
      onChange(values.filter((_, i) => i !== idx));
    },
    [values, onChange]
  );

  // Total items in dropdown: filtered suggestions + optional "Add" item
  const displayItems = filtered.slice(0, 12);
  const totalDropdownItems = displayItems.length + (showAddOption ? 1 : 0);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < displayItems.length) {
        addValue(displayItems[activeIndex].name);
      } else if (activeIndex === displayItems.length && showAddOption) {
        addValue(inputTrimmed);
      } else if (inputTrimmed) {
        addValue(inputTrimmed);
      }
    } else if (e.key === "Backspace" && !input && values.length > 0) {
      removeValue(values.length - 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, totalDropdownItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const isNewItem = (name: string) =>
    newItems?.has(name.toLowerCase()) ?? false;

  return (
    <div className="relative" ref={containerRef}>
      <div
        className="chip-input-container"
        onClick={() => inputRef.current?.focus()}
      >
        {values.map((v, i) => (
          <span
            key={v}
            className={cn(
              "chip-removable",
              isNewItem(v) && "chip-removable-new"
            )}
          >
            {v}
            <button
              type="button"
              className="chip-remove-btn"
              onClick={(e) => {
                e.stopPropagation();
                removeValue(i);
              }}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowDropdown(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder={values.length === 0 ? placeholder : ""}
        />
      </div>

      {showDropdown && totalDropdownItems > 0 && (
        <div className="autocomplete-dropdown">
          {displayItems.map((s, i) => (
            <div
              key={s.name}
              className={cn(
                "autocomplete-item",
                i === activeIndex && "autocomplete-item-active"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                addValue(s.name);
              }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              {s.name}
              {s.count != null && (
                <span className="autocomplete-item-count">{s.count}</span>
              )}
            </div>
          ))}
          {showAddOption && (
            <div
              className={cn(
                "autocomplete-item border-t border-border-subtle text-text-accent",
                activeIndex === displayItems.length && "autocomplete-item-active"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                addValue(inputTrimmed);
              }}
              onMouseEnter={() => setActiveIndex(displayItems.length)}
            >
              + Add &ldquo;{inputTrimmed}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── StarRatingPicker ──────────────────────────────────────────

function StarRatingPicker({
  value,
  onChange,
  readOnly,
}: {
  value: number | null;
  onChange?: (value: number | null) => void;
  readOnly?: boolean;
}) {
  const stars = value ? Math.round(value / 20) : 0;
  const [hovered, setHovered] = useState(0);

  if (readOnly) {
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "h-4 w-4",
              i < stars
                ? "fill-accent-500 text-accent-500"
                : "text-text-disabled"
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="star-rating-picker"
      onMouseLeave={() => setHovered(0)}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const starIdx = i + 1;
        const active = hovered > 0 ? starIdx <= hovered : starIdx <= stars;
        return (
          <button
            key={i}
            type="button"
            onMouseEnter={() => setHovered(starIdx)}
            onClick={() => {
              const newVal = starIdx === stars ? null : starIdx * 20;
              onChange?.(newVal);
            }}
          >
            <Star
              className={cn(
                "h-5 w-5 transition-colors duration-fast",
                active
                  ? "fill-accent-500 text-accent-500"
                  : "text-text-disabled hover:text-accent-800"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

// ─── MetadataRow (view mode) ───────────────────────────────────

function MetadataRow({
  label,
  icon: Icon,
  children,
  className,
}: {
  label: string;
  icon?: typeof Star;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 py-2.5 border-b border-border-subtle last:border-b-0",
        className
      )}
    >
      <div className="flex items-center gap-2 w-28 flex-shrink-0 pt-0.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-text-disabled" />}
        <span className="text-xs text-text-muted font-medium">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────

export function SceneEdit({
  id,
  inline,
  onSaved,
  currentPlaybackTime,
}: SceneEditProps) {
  const [scene, setScene] = useState<SceneDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [date, setDate] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [url, setUrl] = useState("");
  const [studioName, setStudioName] = useState("");
  const [performerNames, setPerformerNames] = useState<string[]>([]);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [orgasmCount, setOrgasmCount] = useState(0);
  const [studioFocused, setStudioFocused] = useState(false);

  // Suggestions for autocomplete
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [allPerformers, setAllPerformers] = useState<PerformerItem[]>([]);
  const [allStudios, setAllStudios] = useState<StudioItem[]>([]);

  // Scraper state
  const [scrapers, setScrapers] = useState<ScraperPackage[]>([]);
  const [selectedScraper, setSelectedScraper] = useState("");
  const [scraping, setScraping] = useState(false);
  const [newFromScrape, setNewFromScrape] = useState<{
    tags: Set<string>;
    performers: Set<string>;
    studio: boolean;
  }>({ tags: new Set(), performers: new Set(), studio: false });
  const [seekIndex, setSeekIndex] = useState(0);
  const [seeking, setSeeking] = useState(false);

  // Thumbnail upload
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [generatingFrameThumb, setGeneratingFrameThumb] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchSceneDetail(id),
      fetchInstalledScrapers(),
      fetchTags(),
      fetchPerformers(),
      fetchStudios(),
    ])
      .then(([sceneData, scrapersData, tagsData, performersData, studiosData]) => {
        setScene(sceneData);
        populateForm(sceneData);

        const enabled = scrapersData.packages.filter((p) => p.enabled);
        setScrapers(enabled);
        if (enabled.length > 0) setSelectedScraper(enabled[0].id);

        setAllTags(tagsData.tags);
        setAllPerformers(performersData.performers);
        setAllStudios(studiosData.studios);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function populateForm(data: SceneDetail) {
    setTitle(data.title);
    setDetails(data.details ?? "");
    setDate(data.date ?? "");
    setRating(data.rating);
    setUrl(data.url ?? "");
    setStudioName(data.studio?.name ?? "");
    setPerformerNames(data.performers.map((p) => p.name));
    setTagNames(data.tags.map((t) => t.name));
    setOrgasmCount(data.orgasmCount ?? 0);
  }

  function enterEditMode() {
    if (scene) populateForm(scene);
    setNewFromScrape({ tags: new Set(), performers: new Set(), studio: false });
    setError(null);
    setMessage(null);
    setEditing(true);
  }

  function cancelEdit() {
    if (scene) populateForm(scene);
    setNewFromScrape({ tags: new Set(), performers: new Set(), studio: false });
    setError(null);
    setMessage(null);
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await updateScene(id, {
        title: title.trim(),
        details: details.trim() || null,
        date: date.trim() || null,
        rating: rating,
        url: url.trim() || null,
        orgasmCount: orgasmCount,
        studioName: studioName.trim() || null,
        performerNames: performerNames,
        tagNames: tagNames,
      });

      setMessage("Saved");
      const updated = await fetchSceneDetail(id);
      setScene(updated);
      populateForm(updated);
      setEditing(false);

      // Refresh autocomplete data
      const [tagsData, performersData, studiosData] = await Promise.all([
        fetchTags(),
        fetchPerformers(),
        fetchStudios(),
      ]);
      setAllTags(tagsData.tags);
      setAllPerformers(performersData.performers);
      setAllStudios(studiosData.studios);

      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleScrape() {
    if (!selectedScraper) return;

    setScraping(true);
    setError(null);

    try {
      const res = await scrapeScene(selectedScraper, id, "auto", {
        url: url || undefined,
      });

      let result: NormalizedScrapeResult | null = null;
      if (res.normalized) {
        result = res.normalized;
      } else if (res.results && res.results.length > 0) {
        result = res.results[0];
      } else {
        setError("Scraper returned no results");
        return;
      }

      // Determine which items are new (don't exist in system)
      const tagNamesLower = new Set(allTags.map((t) => t.name.toLowerCase()));
      const perfNamesLower = new Set(allPerformers.map((p) => p.name.toLowerCase()));
      const studioNamesLower = new Set(allStudios.map((s) => s.name.toLowerCase()));

      const newTags = new Set<string>();
      const newPerfs = new Set<string>();
      let isNewStudio = false;

      for (const t of result.tagNames) {
        if (!tagNamesLower.has(t.toLowerCase())) newTags.add(t.toLowerCase());
      }
      for (const p of result.performerNames) {
        if (!perfNamesLower.has(p.toLowerCase())) newPerfs.add(p.toLowerCase());
      }
      if (result.studioName && !studioNamesLower.has(result.studioName.toLowerCase())) {
        isNewStudio = true;
      }

      setNewFromScrape({ tags: newTags, performers: newPerfs, studio: isNewStudio });

      // Apply values inline immediately — user can edit before saving
      if (result.title) setTitle(result.title);
      if (result.details) setDetails(result.details);
      if (result.date) setDate(result.date);
      if (result.url) setUrl(result.url);
      if (result.studioName) setStudioName(result.studioName);

      // Merge performers: keep existing, add new
      if (result.performerNames.length > 0) {
        setPerformerNames((prev) => {
          const existing = new Set(prev.map((n) => n.toLowerCase()));
          const merged = [...prev];
          for (const name of result.performerNames) {
            if (!existing.has(name.toLowerCase())) {
              merged.push(name);
              existing.add(name.toLowerCase());
            }
          }
          return merged;
        });
      }

      // Merge tags: keep existing, add new
      if (result.tagNames.length > 0) {
        setTagNames((prev) => {
          const existing = new Set(prev.map((n) => n.toLowerCase()));
          const merged = [...prev];
          for (const name of result.tagNames) {
            if (!existing.has(name.toLowerCase())) {
              merged.push(name);
              existing.add(name.toLowerCase());
            }
          }
          return merged;
        });
      }

      // If the scraper returned a valid image URL, download it as custom thumbnail
      if (
        result.imageUrl &&
        (result.imageUrl.startsWith("http://") ||
          result.imageUrl.startsWith("https://"))
      ) {
        try {
          await uploadThumbnailFromUrl(id, result.imageUrl);
          const updated = await fetchSceneDetail(id);
          setScene(updated);
          onSaved?.();
        } catch {
          // Non-fatal — scraped image may be unreachable
        }
      }

      setMessage("Scrape result applied. Review and save to persist.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scrape failed");
    } finally {
      setScraping(false);
    }
  }

  async function handleSeek() {
    if (scrapers.length === 0) return;
    setSeeking(true);
    setError(null);

    let tried = 0;
    let idx = seekIndex;

    while (tried < scrapers.length) {
      const scraper = scrapers[idx];
      setSelectedScraper(scraper.id);
      setMessage(`Trying ${scraper.name}...`);

      try {
        const res = await Promise.race([
          scrapeScene(scraper.id, id, "auto", {
            url: url || undefined,
          }),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 5000)
          ),
        ]);

        let result: NormalizedScrapeResult | null = null;
        if (res?.normalized) result = res.normalized;
        else if (res?.results && res.results.length > 0) result = res.results[0];

        if (result) {
          // Apply the same logic as handleScrape
          const tagNamesLower = new Set(allTags.map((t) => t.name.toLowerCase()));
          const perfNamesLower = new Set(allPerformers.map((p) => p.name.toLowerCase()));
          const studioNamesLower = new Set(allStudios.map((s) => s.name.toLowerCase()));

          const newTags = new Set<string>();
          const newPerfs = new Set<string>();
          let isNewStudio = false;

          for (const t of result.tagNames) {
            if (!tagNamesLower.has(t.toLowerCase())) newTags.add(t.toLowerCase());
          }
          for (const p of result.performerNames) {
            if (!perfNamesLower.has(p.toLowerCase())) newPerfs.add(p.toLowerCase());
          }
          if (result.studioName && !studioNamesLower.has(result.studioName.toLowerCase())) {
            isNewStudio = true;
          }

          setNewFromScrape({ tags: newTags, performers: newPerfs, studio: isNewStudio });

          if (result.title) setTitle(result.title);
          if (result.details) setDetails(result.details);
          if (result.date) setDate(result.date);
          if (result.url) setUrl(result.url);
          if (result.studioName) setStudioName(result.studioName);

          if (result.performerNames.length > 0) {
            setPerformerNames((prev) => {
              const existing = new Set(prev.map((n) => n.toLowerCase()));
              const merged = [...prev];
              for (const name of result!.performerNames) {
                if (!existing.has(name.toLowerCase())) {
                  merged.push(name);
                  existing.add(name.toLowerCase());
                }
              }
              return merged;
            });
          }

          if (result.tagNames.length > 0) {
            setTagNames((prev) => {
              const existing = new Set(prev.map((n) => n.toLowerCase()));
              const merged = [...prev];
              for (const name of result!.tagNames) {
                if (!existing.has(name.toLowerCase())) {
                  merged.push(name);
                  existing.add(name.toLowerCase());
                }
              }
              return merged;
            });
          }

          if (
            result.imageUrl &&
            (result.imageUrl.startsWith("http://") || result.imageUrl.startsWith("https://"))
          ) {
            try {
              await uploadThumbnailFromUrl(id, result.imageUrl);
              const updated = await fetchSceneDetail(id);
              setScene(updated);
              onSaved?.();
            } catch {
              // Non-fatal
            }
          }

          setMessage(`Found result from ${scraper.name}. Review and save to persist.`);
          setSeekIndex((idx + 1) % scrapers.length);
          setSeeking(false);
          return;
        }
      } catch {
        // Scraper failed — continue to next
      }

      idx = (idx + 1) % scrapers.length;
      tried++;
    }

    setMessage(null);
    setError("No scrapers returned results");
    setSeekIndex(0);
    setSeeking(false);
  }

  async function handleThumbnailUpload(file: File) {
    setUploadingThumb(true);
    setError(null);
    try {
      await uploadThumbnail(id, file);
      const updated = await fetchSceneDetail(id);
      setScene(updated);
      onSaved?.();
      setMessage("Thumbnail updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingThumb(false);
    }
  }

  const hasCustomThumbnail = scene?.thumbnailPath?.includes("thumb-custom") ?? false;
  const hasPlaybackFrameTime =
    typeof currentPlaybackTime === "number" &&
    Number.isFinite(currentPlaybackTime);
  const playbackFrameTime = hasPlaybackFrameTime ? currentPlaybackTime : null;
  const playbackFrameTimeLabel =
    playbackFrameTime != null ? formatSecondsLabel(playbackFrameTime) : "";

  async function handleClearThumbnail() {
    setUploadingThumb(true);
    setError(null);
    try {
      await deleteThumbnail(id);
      const updated = await fetchSceneDetail(id);
      setScene(updated);
      onSaved?.();
      setMessage("Reverted to generated thumbnail");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear thumbnail");
    } finally {
      setUploadingThumb(false);
    }
  }

  async function handleThumbnailFromCurrentFrame() {
    if (playbackFrameTime == null) {
      setError("Current playback frame is unavailable");
      return;
    }

    const seconds = Math.max(0, playbackFrameTime);
    setGeneratingFrameThumb(true);
    setError(null);
    try {
      await generateThumbnailFromFrame(id, seconds);
      const updated = await fetchSceneDetail(id);
      setScene(updated);
      onSaved?.();
      setMessage(`Thumbnail captured at ${formatSecondsLabel(seconds)}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to capture thumbnail from current frame"
      );
    } finally {
      setGeneratingFrameThumb(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 text-text-accent animate-spin" />
      </div>
    );
  }

  if (!scene) {
    return (
      <div className="surface-well flex flex-col items-center justify-center py-16">
        <p className="text-text-muted text-sm">{error ?? "Scene not found"}</p>
      </div>
    );
  }

  // Studio autocomplete
  const studioSuggestions = allStudios.map((s) => ({ name: s.name }));
  const filteredStudios = studioFocused
    ? (studioName.trim()
        ? studioSuggestions.filter(
            (s) =>
              s.name.toLowerCase().includes(studioName.toLowerCase()) &&
              s.name.toLowerCase() !== studioName.toLowerCase()
          )
        : studioSuggestions)
    : [];

  // ─── VIEW MODE ─────────────────────────────────────────────────

  if (!editing) {
    return (
      <div className={cn("space-y-4", inline ? "" : "max-w-4xl")}>
        {!inline && (
          <Link
            href={`/scenes/${id}`}
            className="inline-flex items-center gap-1.5 text-text-muted text-[0.78rem] hover:text-text-accent transition-colors duration-fast"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Scene
          </Link>
        )}

        {/* Status messages */}
        {message && (
          <div className="surface-well p-2.5 text-sm border border-border-accent text-text-secondary">
            {message}
          </div>
        )}

        {/* Header with edit button */}
        <div className="flex items-center justify-between">
          <h3 className="text-kicker flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" />
            Scene Metadata
          </h3>
          <Button variant="secondary" size="sm" onClick={enterEditMode}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Metadata readout */}
          <div className="lg:col-span-2 surface-card-sharp no-lift p-4">
            <MetadataRow label="Title" icon={FileText}>
              <p className="text-sm font-medium">{scene.title}</p>
            </MetadataRow>

            <MetadataRow label="Studio" icon={Building2}>
              {scene.studio ? (
                <span className="text-sm text-text-accent font-medium">
                  {scene.studio.name}
                </span>
              ) : (
                <span className="text-sm text-text-disabled">--</span>
              )}
            </MetadataRow>

            <MetadataRow label="Date" icon={Calendar}>
              <span className="text-sm text-text-secondary">
                {scene.date ?? <span className="text-text-disabled">--</span>}
              </span>
            </MetadataRow>

            <MetadataRow label="Rating" icon={Star}>
              <StarRatingPicker value={scene.rating} readOnly />
            </MetadataRow>

            <MetadataRow label="URL" icon={Link2}>
              {scene.url ? (
                <a
                  href={scene.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-text-accent hover:text-text-accent-bright truncate block"
                >
                  {scene.url}
                </a>
              ) : (
                <span className="text-sm text-text-disabled">--</span>
              )}
            </MetadataRow>

            <MetadataRow label="Details" icon={FileText}>
              {scene.details ? (
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                  {scene.details}
                </p>
              ) : (
                <span className="text-sm text-text-disabled">--</span>
              )}
            </MetadataRow>

            <MetadataRow label="Performers" icon={User}>
              {scene.performers.length === 0 ? (
                <span className="text-sm text-text-disabled">--</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {scene.performers.map((p) => {
                    const imgUrl = toApiUrl(p.imagePath);
                    return (
                      <Link
                        key={p.id}
                        href={`/performers/${p.id}`}
                        className="inline-flex items-center gap-1.5 tag-chip tag-chip-default hover:tag-chip-accent transition-colors cursor-pointer"
                      >
                        {imgUrl ? (
                          <img src={imgUrl} alt="" className="h-4 w-3 rounded-sm object-cover flex-shrink-0" loading="lazy" />
                        ) : null}
                        {p.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </MetadataRow>

            <MetadataRow label="Tags" icon={TagIcon}>
              {scene.tags.length === 0 ? (
                <span className="text-sm text-text-disabled">--</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {scene.tags.map((tag) => (
                    <Link
                      key={tag.id}
                      href={`/tags/${tag.id}`}
                      className="tag-chip tag-chip-default hover:tag-chip-accent transition-colors cursor-pointer"
                    >
                      {tag.name}
                    </Link>
                  ))}
                </div>
              )}
            </MetadataRow>

            <MetadataRow label="Orgasms" icon={Droplets}>
              <span className="text-mono-sm">
                {scene.orgasmCount || 0}
              </span>
            </MetadataRow>

            <MetadataRow label="Organized" icon={CheckCircle2}>
              <span
                className={cn(
                  "text-mono-sm",
                  scene.organized ? "text-success-text" : "text-text-disabled"
                )}
              >
                {scene.organized ? "Yes" : "No"}
              </span>
            </MetadataRow>
          </div>

          {/* Thumbnail */}
          <div className="space-y-3">
            <h4 className="text-kicker flex items-center gap-2">
              <ImageIcon className="h-3.5 w-3.5" />
              Thumbnail
            </h4>
            <div className="relative group aspect-video surface-well overflow-hidden rounded-sm">
              {scene.thumbnailPath ? (
                <img
                  src={toApiUrl(scene.thumbnailPath)}
                  alt={scene.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center gradient-thumb-3">
                  <ImageIcon className="h-8 w-8 text-text-disabled" />
                </div>
              )}
              <div
                className="thumb-edit-overlay"
                onClick={() => {
                  enterEditMode();
                }}
              >
                <Pencil className="h-5 w-5 text-text-primary" />
                <span className="text-xs text-text-muted">
                  Edit to change
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── EDIT MODE ─────────────────────────────────────────────────

  return (
    <div className={cn("space-y-4", inline ? "" : "max-w-4xl")}>
      {!inline && (
        <Link
          href={`/scenes/${id}`}
          className="inline-flex items-center gap-1.5 text-text-muted text-[0.78rem] hover:text-text-accent transition-colors duration-fast"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Scene
        </Link>
      )}

      {/* Status messages */}
      {(message || error) && (
        <div
          className={cn(
            "surface-well p-2.5 text-sm",
            error
              ? "border border-error/20 text-error-text"
              : "border border-border-accent text-text-secondary"
          )}
        >
          {error ?? message}
        </div>
      )}

      {/* Header with save/cancel */}
      <div className="flex items-center justify-between">
        <h3 className="text-kicker flex items-center gap-2">
          <Pencil className="h-3.5 w-3.5" />
          Editing Metadata
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={cancelEdit}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {/* Scraper panel — compact inline bar */}
          {scrapers.length > 0 && (
            <section className="surface-well px-4 py-3 flex flex-wrap items-center gap-3">
              <Wand2 className="h-4 w-4 text-text-accent flex-shrink-0" />
              <select
                className="control-input text-sm py-1.5 w-auto min-w-[140px]"
                value={selectedScraper}
                onChange={(e) => {
                  setSelectedScraper(e.target.value);
                  setSeekIndex(scrapers.findIndex((s) => s.id === e.target.value));
                }}
              >
                {scrapers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleScrape()}
                disabled={scraping || seeking}
              >
                {scraping ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                {scraping ? "Scraping..." : "Scrape"}
              </Button>
              <button
                onClick={() => void handleSeek()}
                disabled={scraping || seeking}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs text-text-muted border border-border-subtle hover:text-text-accent hover:border-border-accent disabled:opacity-50 transition-all duration-fast"
              >
                {seeking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <SkipForward className="h-3.5 w-3.5" />
                )}
                {seeking ? "Seeking..." : "Seek"}
              </button>
              <span className="text-text-disabled text-xs hidden sm:inline">
                {seeking ? "Trying scrapers..." : "Seek tries each scraper until one returns results"}
              </span>
            </section>
          )}

          {/* Metadata form */}
          <section className="surface-card-sharp no-lift p-4 space-y-4">
            <h4 className="text-kicker">Metadata</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Title" required>
                <input
                  className="control-input w-full"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </FormField>

              <FormField label="Date">
                <input
                  className="control-input w-full"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </FormField>

              <FormField label="Studio">
                <div className="relative">
                  <input
                    className="control-input w-full"
                    value={studioName}
                    onChange={(e) => setStudioName(e.target.value)}
                    onFocus={() => setStudioFocused(true)}
                    onBlur={() => setTimeout(() => setStudioFocused(false), 150)}
                    placeholder="Studio name"
                  />
                  {filteredStudios.length > 0 && (
                    <div className="autocomplete-dropdown">
                      {filteredStudios.slice(0, 8).map((s) => (
                        <div
                          key={s.name}
                          className="autocomplete-item"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setStudioName(s.name);
                            setStudioFocused(false);
                          }}
                        >
                          {s.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {studioName.trim() &&
                  !allStudios.some(
                    (s) =>
                      s.name.toLowerCase() === studioName.trim().toLowerCase()
                  ) && (
                    <span className="text-[0.65rem] text-info-text mt-1 block">
                      New studio will be created
                    </span>
                  )}
              </FormField>

              <FormField label="Rating">
                <StarRatingPicker
                  value={rating}
                  onChange={setRating}
                />
              </FormField>

              <FormField label="Orgasm Count">
                <input
                  className="control-input w-full"
                  type="number"
                  min="0"
                  value={orgasmCount}
                  onChange={(e) => setOrgasmCount(Number(e.target.value) || 0)}
                />
              </FormField>

              <FormField label="URL" className="md:col-span-2">
                <input
                  className="control-input w-full"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                />
              </FormField>

              <FormField label="Details" className="md:col-span-2">
                <textarea
                  className="control-input w-full min-h-[80px] resize-y"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={3}
                />
              </FormField>
            </div>
          </section>

          {/* Relations */}
          <section className="surface-card-sharp no-lift p-4 space-y-4">
            <h4 className="text-kicker">Relations</h4>

            <FormField label="Performers">
              <ChipInput
                values={performerNames}
                onChange={setPerformerNames}
                suggestions={allPerformers.map((p) => ({
                  name: p.name,
                  count: p.sceneCount,
                }))}
                placeholder="Type to add performers..."
                newItems={newFromScrape.performers}
              />
            </FormField>

            <FormField label="Tags">
              <ChipInput
                values={tagNames}
                onChange={setTagNames}
                suggestions={allTags.map((t) => ({
                  name: t.name,
                  count: t.sceneCount,
                }))}
                placeholder="Type to add tags..."
                newItems={newFromScrape.tags}
              />
            </FormField>
          </section>
        </div>

        {/* Thumbnail column */}
        <div className="space-y-3">
          <h4 className="text-kicker flex items-center gap-2">
            <ImageIcon className="h-3.5 w-3.5" />
            Thumbnail
          </h4>
          <div className="relative group aspect-video surface-well overflow-hidden rounded-sm">
            {scene.thumbnailPath ? (
              <img
                src={toApiUrl(scene.thumbnailPath)}
                alt={scene.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center gradient-thumb-3">
                <ImageIcon className="h-8 w-8 text-text-disabled" />
              </div>
            )}
            <div
              className="thumb-edit-overlay"
              onClick={() => thumbnailInputRef.current?.click()}
            >
              {uploadingThumb ? (
                <Loader2 className="h-5 w-5 text-text-primary animate-spin" />
              ) : (
                <>
                  <Upload className="h-5 w-5 text-text-primary" />
                  <span className="text-xs text-text-muted">
                    Replace thumbnail
                  </span>
                </>
              )}
            </div>
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleThumbnailUpload(file);
                e.target.value = "";
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[0.65rem] text-text-disabled flex-1">
              Hover to replace. Accepts JPG, PNG, or WebP.
            </p>
            {hasCustomThumbnail && (
              <button
                type="button"
                className="text-[0.65rem] text-text-muted hover:text-error-text transition-colors"
                onClick={() => void handleClearThumbnail()}
                disabled={uploadingThumb}
              >
                Revert to generated
              </button>
            )}
          </div>
          {inline && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleThumbnailFromCurrentFrame()}
              disabled={
                uploadingThumb ||
                generatingFrameThumb ||
                !hasPlaybackFrameTime
              }
            >
              {generatingFrameThumb ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Clapperboard className="h-3.5 w-3.5" />
              )}
              {generatingFrameThumb
                ? "Generating..."
                : `Thumbnail from Current Frame${
                    hasPlaybackFrameTime
                      ? ` (${playbackFrameTimeLabel})`
                      : ""
                  }`}
            </Button>
          )}
        </div>
      </div>

      {/* Bottom save bar */}
      <div className="flex justify-end gap-3 pb-6">
        <Button variant="ghost" size="sm" onClick={cancelEdit}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => void handleSave()}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────

function FormField({
  label,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-xs text-text-muted">
        {label}
        {required && <span className="text-error-text ml-0.5">*</span>}
        {hint && <span className="text-text-disabled ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

function formatSecondsLabel(seconds: number) {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
