"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImportButton, UploadDropZone } from "../upload";
import { ConfirmDeleteDialog } from "../confirm-delete-dialog";
import {
  Music,
  Play,
  Shuffle,
  Edit2,
  Save,
  XCircle,
  Loader2,
  CheckCircle2,
  Calendar,
  Building2,
  Upload,
  Trash2,
  MoreVertical,
  FolderPlus,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { formatDuration } from "@obscura/contracts";
import type { AudioLibraryDetailDto } from "@obscura/contracts";
import { PerformersSection, TagsSection, InfoRow } from "../shared/metadata-panel";
import { StarRatingPicker } from "../shared/star-rating-picker";
import { NsfwBlur, NsfwChip, NsfwEditToggle, NsfwGate, NsfwShowModeChip } from "../nsfw/nsfw-gate";
import { useNsfw } from "../nsfw/nsfw-context";
import { SCENE_CARD_GRADIENTS } from "../scenes/scene-card-gradients";
import {
  toApiUrl,
  fetchAudioLibraryDetail,
  updateAudioLibrary,
  fetchTags,
  fetchPerformers,
  fetchStudios,
  uploadAudioLibraryCover,
  deleteAudioLibraryCover,
  updateAudioTrack,
  deleteAudioTrack,
  type TagItem,
  type PerformerItem,
  type StudioItem,
} from "../../lib/api";
import { AudioPlayer } from "../audio/audio-player";
import { BackLink } from "../shared/back-link";
import { ChipInput } from "../shared/chip-input";
import { AddToCollectionModal } from "../collections/add-to-collection-modal";
import { AudioLibraryStudioField } from "../audio/audio-library-studio-field";
import { revalidateAudioLibraryCache } from "../../app/actions/revalidate-audio-library";
import { useAppChrome } from "../app-chrome-context";

interface AudioLibraryDetailClientProps {
  library: AudioLibraryDetailDto;
  allTags: TagItem[];
}

function populateFormState(data: AudioLibraryDetailDto) {
  return {
    title: data.title,
    details: data.details ?? "",
    date: data.date ?? "",
    rating: data.rating,
    isNsfw: data.isNsfw ?? false,
    organized: data.organized,
    studioName: data.studio?.name ?? "",
    performerNames: data.performers.map((p) => p.name),
    tagNames: data.tags.map((t) => t.name),
  };
}

export function AudioLibraryDetailClient({
  library: initialLibrary,
  allTags: initialTagSuggestions,
}: AudioLibraryDetailClientProps) {
  const { mode: nsfwMode } = useNsfw();
  const { sidebarCollapsed } = useAppChrome();
  const [library, setLibrary] = useState(initialLibrary);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [shufflePlayKey, setShufflePlayKey] = useState(0);
  const router = useRouter();
  const [trackDeleteTarget, setTrackDeleteTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [trackDeleteLoading, setTrackDeleteLoading] = useState(false);

  const handleTrackDelete = useCallback(
    async (trackId: string, alsoFromDisk: boolean) => {
      setTrackDeleteLoading(true);
      try {
        await deleteAudioTrack(trackId, alsoFromDisk);
        setLibrary((prev) => ({
          ...prev,
          tracks: prev.tracks.filter((t) => t.id !== trackId),
          trackCount: Math.max(0, prev.trackCount - 1),
        }));
        setTrackDeleteTarget(null);
        if (activeTrackId === trackId) {
          setActiveTrackId(null);
        }
        router.refresh();
      } catch (error) {
        console.error("Failed to delete track", error);
        alert(
          error instanceof Error ? error.message : "Failed to delete track",
        );
      } finally {
        setTrackDeleteLoading(false);
      }
    },
    [activeTrackId, router],
  );

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<TagItem[]>(initialTagSuggestions);
  const [allPerformers, setAllPerformers] = useState<PerformerItem[]>([]);
  const [allStudios, setAllStudios] = useState<StudioItem[]>([]);
  const [suggestionsReady, setSuggestionsReady] = useState(false);

  const [title, setTitle] = useState(initialLibrary.title);
  const [details, setDetails] = useState(initialLibrary.details ?? "");
  const [date, setDate] = useState(initialLibrary.date ?? "");
  const [rating, setRating] = useState<number | null>(initialLibrary.rating);
  const [isNsfw, setIsNsfw] = useState(initialLibrary.isNsfw ?? false);
  const [organized, setOrganized] = useState(initialLibrary.organized);
  const [studioName, setStudioName] = useState(initialLibrary.studio?.name ?? "");
  const [performerNames, setPerformerNames] = useState<string[]>(() =>
    initialLibrary.performers.map((p) => p.name),
  );
  const [tagNames, setTagNames] = useState<string[]>(() =>
    initialLibrary.tags.map((t) => t.name),
  );

  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverBusy, setCoverBusy] = useState(false);

  useEffect(() => {
    setLibrary(initialLibrary);
  }, [initialLibrary.id, initialLibrary.updatedAt]);

  const trackFetchLimit = useMemo(
    () => Math.max(library.trackTotal, library.tracks.length, 100),
    [library.trackTotal, library.tracks.length],
  );

  const coverUrl = toApiUrl(library.coverImagePath, library.updatedAt);

  const reloadLibrary = useCallback(async () => {
    const next = await fetchAudioLibraryDetail(library.id, { trackLimit: trackFetchLimit });
    setLibrary(next);
  }, [library.id, trackFetchLimit]);

  const handleCoverFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setCoverBusy(true);
      try {
        await uploadAudioLibraryCover(library.id, file);
        await revalidateAudioLibraryCache(library.id);
        await reloadLibrary();
      } finally {
        setCoverBusy(false);
      }
    },
    [library.id, reloadLibrary],
  );

  const handleRemoveCover = useCallback(async () => {
    if (!library.coverImagePath) return;
    setCoverBusy(true);
    try {
      await deleteAudioLibraryCover(library.id);
      await revalidateAudioLibraryCache(library.id);
      await reloadLibrary();
    } finally {
      setCoverBusy(false);
    }
  }, [library.coverImagePath, library.id, reloadLibrary]);

  const handleTrackRating = useCallback(
    async (trackId: string, newRating: number | null) => {
      const prevRating =
        library.tracks.find((t) => t.id === trackId)?.rating ?? null;
      setLibrary((l) => ({
        ...l,
        tracks: l.tracks.map((t) =>
          t.id === trackId ? { ...t, rating: newRating } : t,
        ),
      }));
      try {
        await updateAudioTrack(trackId, { rating: newRating });
      } catch {
        setLibrary((l) => ({
          ...l,
          tracks: l.tracks.map((t) =>
            t.id === trackId ? { ...t, rating: prevRating } : t,
          ),
        }));
      }
    },
    [library.tracks],
  );

  const visibleTracks = library.tracks.filter(
    (t) => nsfwMode !== "off" || !t.isNsfw,
  );
  const visibleDuration = visibleTracks.reduce(
    (sum, t) => sum + (t.duration ?? 0),
    0,
  );
  const visibleTrackCount = visibleTracks.length;

  const tagSuggestions = useMemo(
    () => allTags.map((t) => ({ name: t.name })),
    [allTags],
  );
  const performerSuggestions = useMemo(
    () => allPerformers.map((p) => ({ name: p.name })),
    [allPerformers],
  );

  const resetFormFromLibrary = useCallback((data: AudioLibraryDetailDto) => {
    const f = populateFormState(data);
    setTitle(f.title);
    setDetails(f.details);
    setDate(f.date);
    setRating(f.rating);
    setIsNsfw(f.isNsfw);
    setOrganized(f.organized);
    setStudioName(f.studioName);
    setPerformerNames(f.performerNames);
    setTagNames(f.tagNames);
  }, []);

  const handleTrackChange = useCallback((trackId: string) => {
    setActiveTrackId(trackId);
  }, []);

  const handlePlayAll = useCallback(() => {
    if (visibleTracks.length > 0) {
      setActiveTrackId(visibleTracks[0].id);
    }
  }, [visibleTracks]);

  const handleShufflePlay = useCallback(() => {
    if (visibleTracks.length > 0) {
      setShufflePlayKey((k) => k + 1);
    }
  }, [visibleTracks]);

  const beginEdit = useCallback(async () => {
    setEditError(null);
    resetFormFromLibrary(library);
    setEditMode(true);
    setSuggestionsReady(false);
    setLoadError(null);
    try {
      const [tagsRes, perfRes, studioRes] = await Promise.all([
        fetchTags({ nsfw: nsfwMode }),
        fetchPerformers({ nsfw: nsfwMode, limit: 500 }),
        fetchStudios({ nsfw: nsfwMode }),
      ]);
      setAllTags(tagsRes.tags);
      setAllPerformers(perfRes.performers);
      setAllStudios(studioRes.studios);
      setSuggestionsReady(true);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load suggestions");
      setSuggestionsReady(true);
    }
  }, [library, nsfwMode, resetFormFromLibrary]);

  const cancelEdit = useCallback(() => {
    resetFormFromLibrary(library);
    setEditMode(false);
    setEditError(null);
    setLoadError(null);
  }, [library, resetFormFromLibrary]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setEditError(null);
    try {
      await updateAudioLibrary(library.id, {
        title: title.trim(),
        details: details.trim() || null,
        date: date.trim() || null,
        rating,
        organized,
        isNsfw,
        studioName: studioName.trim() || null,
        performerNames,
        tagNames,
      });
      await revalidateAudioLibraryCache(library.id);
      const next = await fetchAudioLibraryDetail(library.id, {
        trackLimit: trackFetchLimit,
      });
      setLibrary(next);
      resetFormFromLibrary(next);
      setEditMode(false);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [
    library.id,
    library.trackTotal,
    library.tracks.length,
    title,
    details,
    date,
    rating,
    organized,
    isNsfw,
    studioName,
    performerNames,
    tagNames,
    resetFormFromLibrary,
    trackFetchLimit,
  ]);

  const content = (
    <div className="flex flex-col gap-6 pb-64 md:pb-60">
      <BackLink fallback="/audio" label="Audio" variant="text" />

      <div className="flex flex-col lg:flex-row gap-6 lg:items-start lg:gap-8">
        <div className="flex gap-6 items-start flex-1 min-w-0">
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex-shrink-0">
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              aria-label="Upload album art"
              onChange={(e) => {
                void handleCoverFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <NsfwBlur
              isNsfw={library.isNsfw}
              className="w-full h-full overflow-hidden surface-card-sharp"
            >
              <div className="relative w-full h-full">
                <div className={cn("w-full h-full flex items-center justify-center", SCENE_CARD_GRADIENTS[0])}>
                  <Music className="h-12 w-12 text-white/20" />
                </div>
                {coverUrl && (
                  <img
                    src={coverUrl}
                    alt={library.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                )}
                <div className="pointer-events-none absolute bottom-1 right-1 z-10 flex flex-col items-end gap-0.5">
                  <NsfwShowModeChip isNsfw={library.isNsfw} />
                </div>
              </div>
            </NsfwBlur>
            {editMode && (
              <div className="absolute inset-x-0 bottom-0 z-10 flex gap-1 border-t border-border-subtle bg-black/75 p-1">
                <button
                  type="button"
                  disabled={coverBusy}
                  onClick={() => coverInputRef.current?.click()}
                  className="flex flex-1 items-center justify-center gap-1 py-1 text-[0.65rem] font-medium uppercase tracking-wide text-text-primary hover:bg-surface-3/80 disabled:opacity-50"
                >
                  {coverBusy ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                  Art
                </button>
                {library.coverImagePath ? (
                  <button
                    type="button"
                    disabled={coverBusy}
                    onClick={() => void handleRemoveCover()}
                    className="flex flex-1 items-center justify-center gap-1 py-1 text-[0.65rem] font-medium uppercase tracking-wide text-text-muted hover:text-red-300 hover:bg-surface-3/80 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear
                  </button>
                ) : null}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 py-1">
            <div className="flex items-start justify-between gap-3">
              {editMode ? (
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1 min-w-0 bg-surface-2 border border-border-subtle px-2 py-1.5 text-2xl font-heading font-semibold text-text-primary focus:outline-none focus:border-accent-500"
                />
              ) : (
                <h1 className="flex-1 min-w-0 text-2xl font-heading font-semibold leading-tight">
                  {library.title}
                </h1>
              )}
              <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                {editMode ? (
                  <>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={saving}
                      className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors disabled:opacity-50"
                      aria-label="Cancel editing"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || !title.trim()}
                      className="p-1.5 text-accent-400 hover:text-accent-300 hover:bg-surface-2 transition-colors disabled:opacity-50"
                      aria-label="Save changes"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={beginEdit}
                      className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
                      aria-label="Edit library"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    {/* More Actions */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMoreActionsOpen((o) => !o)}
                        className="p-1.5 text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors"
                        title="More actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {moreActionsOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setMoreActionsOpen(false)} />
                          <div className="absolute right-0 top-full mt-1 z-50 w-56 surface-elevated py-1">
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-[0.72rem] text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
                              onClick={() => {
                                setMoreActionsOpen(false);
                                setCollectionModalOpen(true);
                              }}
                            >
                              <FolderPlus className="h-3.5 w-3.5" />
                              Add Library to Collection
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {editMode ? (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="text-kicker mb-1.5">Description</div>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={4}
                    className="w-full bg-surface-2 border border-border-subtle px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-500 resize-y min-h-[5rem]"
                  />
                </div>
                <div>
                  <div className="text-kicker mb-1.5 flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Date
                  </div>
                  <input
                    type="date"
                    value={date.length >= 10 ? date.slice(0, 10) : ""}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full max-w-[12rem] bg-surface-2 border border-border-subtle px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-500"
                  />
                </div>
                <NsfwGate>
                  <NsfwEditToggle value={isNsfw} onChange={setIsNsfw} />
                </NsfwGate>
                <div>
                  <div className="text-kicker mb-1.5">Rating</div>
                  <StarRatingPicker value={rating} onChange={setRating} />
                </div>
                <AudioLibraryStudioField
                  value={studioName}
                  onChange={setStudioName}
                  allStudios={allStudios}
                  nsfwMode={nsfwMode}
                  disabled={!suggestionsReady}
                />
                <button
                  type="button"
                  onClick={() => setOrganized((o) => !o)}
                  className={cn(
                    "flex items-center gap-2 w-full max-w-xs px-2 py-2 text-sm transition-colors border border-border-subtle",
                    organized
                      ? "bg-accent-950/40 text-accent-300 border-accent-800/50"
                      : "text-text-muted hover:bg-surface-2",
                  )}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {organized ? "Marked organized" : "Mark as organized"}
                </button>
                {loadError && (
                  <p className="text-xs text-amber-400/90">{loadError} — you can still type new names.</p>
                )}
                {editError && <p className="text-xs text-red-400/90">{editError}</p>}
              </div>
            ) : (
              <>
                {library.details && (
                  <p className="text-sm text-text-muted mt-1.5 line-clamp-3 whitespace-pre-wrap">{library.details}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-sm text-text-muted">
                  <span>{visibleTrackCount} track{visibleTrackCount !== 1 ? "s" : ""}</span>
                  {visibleDuration > 0 && (
                    <>
                      <span className="text-text-disabled">&middot;</span>
                      <span>{formatDuration(visibleDuration)}</span>
                    </>
                  )}
                  {library.isNsfw && <NsfwChip />}
                </div>
                {library.rating != null && (
                  <div className="mt-2">
                    <StarRatingPicker value={library.rating} readOnly />
                  </div>
                )}
                {visibleTracks.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handlePlayAll}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-500 text-bg text-sm font-medium hover:bg-accent-400 transition-colors shadow-[0_0_16px_rgba(196,154,90,0.2)]"
                    >
                      <Play className="h-4 w-4" />
                      Play All
                    </button>
                    <button
                      type="button"
                      onClick={handleShufflePlay}
                      className="inline-flex items-center gap-2 px-5 py-2.5 border border-border-subtle bg-surface-2 text-sm font-medium text-text-primary hover:bg-surface-3 hover:border-border-accent/40 transition-colors"
                    >
                      <Shuffle className="h-4 w-4 text-accent-400" />
                      Shuffle
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="surface-panel p-4 space-y-3 w-full lg:w-72 lg:flex-shrink-0 lg:self-stretch">
          <h4 className="text-kicker">Library Info</h4>
          <div className="space-y-2.5">
            <InfoRow icon={Music} label="Tracks" value={String(visibleTrackCount)} />
            {visibleDuration > 0 && (
              <InfoRow icon={Play} label="Duration" value={formatDuration(visibleDuration) ?? "--:--"} />
            )}
            {library.studio && (
              <InfoRow icon={Building2} label="Studio" value={library.studio.name} />
            )}
            {library.date && !editMode && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-muted flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  Date
                </span>
                <span className="text-mono-sm">{library.date.slice(0, 10)}</span>
              </div>
            )}
            {!editMode && library.organized && (
              <div className="flex items-center gap-2 text-xs text-accent-400/90 pt-0.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Organized
              </div>
            )}
            {library.folderPath && (
              <div className="text-xs text-text-disabled break-all pt-1 border-t border-border-subtle">
                {library.folderPath}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {editMode ? (
          <>
            <section>
              <h4 className="text-kicker mb-3">Artists</h4>
              <ChipInput
                values={performerNames}
                onChange={setPerformerNames}
                suggestions={performerSuggestions}
                placeholder="Add artist…"
              />
            </section>
            <section>
              <h4 className="text-kicker mb-3">Tags</h4>
              <ChipInput
                values={tagNames}
                onChange={setTagNames}
                suggestions={tagSuggestions}
                placeholder="Add tag…"
              />
            </section>
          </>
        ) : (
          <>
            <PerformersSection
              performers={library.performers}
              parentIsNsfw={library.isNsfw}
              headingLabel="Artists"
            />
            <TagsSection tags={library.tags} />
          </>
        )}
      </div>

      {library.children.length > 0 && (
        <section>
          <h2 className="text-kicker mb-3">Sub-Libraries</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {library.children
              .filter((c) => nsfwMode !== "off" || !c.isNsfw)
              .map((child, i) => {
                const childCover = toApiUrl(child.coverImagePath);
                return (
                  <Link
                    key={child.id}
                    href={`/audio/${child.id}`}
                    className="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors"
                  >
                    <NsfwBlur isNsfw={child.isNsfw} className="aspect-square overflow-hidden relative">
                      <div className={cn("w-full h-full flex items-center justify-center", SCENE_CARD_GRADIENTS[i % SCENE_CARD_GRADIENTS.length])}>
                        <Music className="h-8 w-8 text-white/20" />
                      </div>
                      {childCover && (
                        <img src={childCover} alt={child.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      )}
                      <div className="pointer-events-none absolute bottom-1 right-1 z-10 flex flex-col items-end gap-0.5">
                        <NsfwShowModeChip isNsfw={child.isNsfw} />
                      </div>
                    </NsfwBlur>
                    <div className="p-2">
                      <h3 className="text-xs font-medium truncate">{child.title}</h3>
                      <p className="text-[0.65rem] text-text-muted">{child.trackCount} tracks</p>
                    </div>
                  </Link>
                );
              })}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-kicker">Tracks</h2>
          {library.folderPath ? (
            <ImportButton
              target={{ kind: "audio", audioLibraryId: library.id }}
              onUploaded={() => router.refresh()}
            />
          ) : null}
        </div>
        {visibleTracks.length === 0 ? (
          <div className="surface-well p-8 text-center">
            <p className="text-text-muted text-sm">No tracks in this library</p>
          </div>
        ) : (
          <div className="surface-well">
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 border-b border-border-subtle text-xs text-text-disabled uppercase tracking-wider">
              <span className="w-7 sm:w-8 text-right shrink-0">#</span>
              <span className="flex-1 min-w-0">Title</span>
              <span className="w-[5.5rem] shrink-0 text-center">Rating</span>
              <span className="w-11 sm:w-12 text-right shrink-0">Time</span>
            </div>
            {visibleTracks.map((track, index) => {
              const isActive = track.id === activeTrackId;

              return (
                <div
                  key={track.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleTrackChange(track.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleTrackChange(track.id);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 text-left transition-colors group cursor-pointer",
                    "hover:bg-surface-2",
                    isActive && "bg-surface-2",
                    index < visibleTracks.length - 1 && "border-b border-border-subtle",
                  )}
                >
                  <span className="w-7 sm:w-8 text-right text-xs font-mono flex-shrink-0">
                    {isActive ? (
                      <span className="inline-flex items-center justify-center">
                        <span className="flex gap-[2px] items-end h-3">
                          <span className={cn("w-[2px] bg-accent-500 animate-[bar-bounce_0.6s_ease-in-out_infinite]")} style={{ height: "8px", animationDelay: "0ms" }} />
                          <span className={cn("w-[2px] bg-accent-500 animate-[bar-bounce_0.6s_ease-in-out_infinite]")} style={{ height: "12px", animationDelay: "150ms" }} />
                          <span className={cn("w-[2px] bg-accent-500 animate-[bar-bounce_0.6s_ease-in-out_infinite]")} style={{ height: "6px", animationDelay: "300ms" }} />
                        </span>
                      </span>
                    ) : (
                      <span className="text-text-muted group-hover:hidden">
                        {track.trackNumber ?? index + 1}
                      </span>
                    )}
                    {!isActive && (
                      <Play className="h-3 w-3 text-text-muted hidden group-hover:inline" />
                    )}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm truncate",
                      isActive ? "text-accent-400 font-medium" : "text-text-primary",
                    )}>
                      {nsfwMode === "blur" && track.isNsfw ? (
                        <span className="blur-sm hover:blur-none transition-all">{track.title}</span>
                      ) : (
                        track.title
                      )}
                    </p>
                    {track.embeddedArtist && (
                      <p className="text-xs text-text-muted truncate">{track.embeddedArtist}</p>
                    )}
                  </div>

                  <div
                    className="flex-shrink-0 w-[5.5rem] flex justify-center scale-[0.85] sm:scale-100 origin-center"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    role="presentation"
                  >
                    <StarRatingPicker
                      value={track.rating}
                      onChange={(v) => void handleTrackRating(track.id, v)}
                    />
                  </div>

                  <span className="text-xs text-text-muted font-mono flex-shrink-0 w-11 sm:w-12 text-right tabular-nums">
                    {track.duration ? formatDuration(track.duration) : "--:--"}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTrackDeleteTarget({ id: track.id, title: track.title });
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="flex-shrink-0 flex h-6 w-6 items-center justify-center text-text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-status-error focus:opacity-100"
                    title="Delete track"
                    aria-label={`Delete ${track.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );

  const wrappedContent = library.folderPath ? (
    <UploadDropZone
      target={{ kind: "audio", audioLibraryId: library.id }}
      onUploaded={() => router.refresh()}
      className="relative"
    >
      {content}
    </UploadDropZone>
  ) : (
    content
  );

  return (
    <>
      <ConfirmDeleteDialog
        open={trackDeleteTarget != null}
        onClose={() => !trackDeleteLoading && setTrackDeleteTarget(null)}
        entityType="audio-track"
        count={1}
        allowDeleteFromDisk
        onDeleteFromLibrary={() =>
          trackDeleteTarget
            ? void handleTrackDelete(trackDeleteTarget.id, false)
            : undefined
        }
        onDeleteFromDisk={() =>
          trackDeleteTarget
            ? void handleTrackDelete(trackDeleteTarget.id, true)
            : undefined
        }
        loading={trackDeleteLoading}
      />

      {wrappedContent}

      <div
        className={cn(
          "fixed z-[45] max-w-[100vw] pointer-events-none",
          "bottom-[calc(3.5rem+6px)] left-0 right-0 px-2 pt-1",
          "md:bottom-4 md:px-5",
          sidebarCollapsed ? "md:left-14" : "md:left-60",
        )}
        role="region"
        aria-label="Audio playback"
      >
        <div className="pointer-events-auto surface-elevated overflow-hidden">
          <AudioPlayer
            tracks={visibleTracks}
            activeTrackId={activeTrackId}
            onTrackChange={handleTrackChange}
            className="border-0 bg-transparent shadow-none"
            libraryCoverUrl={coverUrl}
            shufflePlayKey={shufflePlayKey}
          />
        </div>
      </div>

      <AddToCollectionModal
        open={collectionModalOpen}
        onClose={() => setCollectionModalOpen(false)}
        entityType="audio-track"
        entityId={library.id}
        entityTitle={library.title}
        items={library.tracks.map((t) => ({ entityType: "audio-track" as const, entityId: t.id }))}
      />
    </>
  );
}
