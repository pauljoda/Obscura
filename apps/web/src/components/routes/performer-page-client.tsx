"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Users,
  Star,
  Film,
  Loader2,
  Globe,
  Calendar,
  Ruler,
  Pencil,
  Trash2,
  Tag as TagIcon,
  Weight,
  Eye,
  Palette,
  Heart,
  Images,
  Music,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@obscura/ui/lib/utils";
import { useTerms, formatVideoCount } from "../../lib/terminology";
import type { AudioLibraryListItemDto, GalleryListItemDto } from "@obscura/contracts";
import { SceneGrid } from "../scene-grid";
import { GalleryGrid } from "../gallery-grid";
import { AudioLibraryAppearanceGrid } from "../audio/audio-library-appearance-grid";
import { PerformerEdit } from "../performer-edit";
import {
  deletePerformer,
  fetchAudioLibraries,
  fetchGalleries,
  fetchPerformerDetail,
  fetchScenes,
  setPerformerRating,
  toApiUrl,
  togglePerformerFavorite,
  type PerformerDetail,
  type SceneListItem,
} from "../../lib/api";
import { StashIdChips } from "../stash-id-chips";
import {
  NsfwBlur,
  NsfwChip,
  NsfwGate,
  NsfwTagLabel,
  tagsVisibleInNsfwMode,
} from "../nsfw/nsfw-gate";
import { useNsfw } from "../nsfw/nsfw-context";
import { BackLink } from "../shared/back-link";
import { useCurrentPath } from "../../hooks/use-current-path";

interface PerformerPageClientProps {
  id: string;
  initialPerformer: PerformerDetail | null;
  initialScenes: SceneListItem[];
  initialTotalScenes: number;
  initialGalleries: GalleryListItemDto[];
  initialTotalGalleries: number;
  initialAudioLibraries: AudioLibraryListItemDto[];
  initialTotalAudioLibraries: number;
}

export function PerformerPageClient({
  id,
  initialPerformer,
  initialScenes,
  initialTotalScenes,
  initialGalleries,
  initialTotalGalleries,
  initialAudioLibraries,
  initialTotalAudioLibraries,
}: PerformerPageClientProps) {
  const router = useRouter();
  const terms = useTerms();
  const { mode: nsfwMode } = useNsfw();
  const currentPath = useCurrentPath();

  const [performer, setPerformer] = useState(initialPerformer);
  const [scenes, setScenes] = useState(initialScenes);
  const [totalScenes, setTotalScenes] = useState(initialTotalScenes);
  const [galleries, setGalleries] = useState(initialGalleries);
  const [totalGalleries, setTotalGalleries] = useState(initialTotalGalleries);
  const [audioLibraries, setAudioLibraries] = useState(initialAudioLibraries);
  const [totalAudioLibraries, setTotalAudioLibraries] = useState(initialTotalAudioLibraries);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notFound, setNotFound] = useState(initialPerformer == null);

  const loadPerformer = useCallback(async () => {
    setLoading(true);

    try {
      const performerResponse = await fetchPerformerDetail(id, { nsfw: nsfwMode });
      setPerformer(performerResponse);

      const name = performerResponse.name;
      const [scenesResponse, galleriesResponse, audioResponse] = await Promise.all([
        fetchScenes({ performer: [name], limit: 100, nsfw: nsfwMode }),
        fetchGalleries({
          performer: [name],
          root: "all",
          limit: 100,
          nsfw: nsfwMode,
        }),
        fetchAudioLibraries({
          performer: [name],
          root: "all",
          limit: 100,
          nsfw: nsfwMode,
        }),
      ]);

      setScenes(scenesResponse.scenes);
      setTotalScenes(scenesResponse.total);
      setGalleries(galleriesResponse.galleries);
      setTotalGalleries(galleriesResponse.total);
      setAudioLibraries(audioResponse.items);
      setTotalAudioLibraries(audioResponse.total);
      setNotFound(false);
    } catch (error) {
      console.error(error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id, nsfwMode]);

  const prevNsfwForRefetch = useRef(nsfwMode);
  useEffect(() => {
    setPerformer(initialPerformer);
    setScenes(initialScenes);
    setTotalScenes(initialTotalScenes);
    setGalleries(initialGalleries);
    setTotalGalleries(initialTotalGalleries);
    setAudioLibraries(initialAudioLibraries);
    setTotalAudioLibraries(initialTotalAudioLibraries);
    setNotFound(initialPerformer == null);
  }, [
    id,
    initialPerformer,
    initialScenes,
    initialTotalScenes,
    initialGalleries,
    initialTotalGalleries,
    initialAudioLibraries,
    initialTotalAudioLibraries,
  ]);

  useEffect(() => {
    if (prevNsfwForRefetch.current === nsfwMode) return;
    prevNsfwForRefetch.current = nsfwMode;
    void loadPerformer();
  }, [nsfwMode, loadPerformer]);

  async function handleToggleFavorite() {
    if (!performer) {
      return;
    }

    try {
      const result = await togglePerformerFavorite(id, !performer.favorite);
      setPerformer((current) => (current ? { ...current, favorite: result.favorite } : current));
    } catch (error) {
      console.error(error);
    }
  }

  async function handleSetRating(rating: number) {
    if (!performer) {
      return;
    }

    const nextRating = performer.rating === rating ? null : rating;
    const previousRating = performer.rating;
    // Optimistic update — show change immediately
    setPerformer((current) => (current ? { ...current, rating: nextRating } : current));

    try {
      await setPerformerRating(id, nextRating);
    } catch (error) {
      console.error(error);
      // Revert on failure
      setPerformer((current) => (current ? { ...current, rating: previousRating } : current));
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete this ${terms.performer.toLowerCase()}? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);

    try {
      await deletePerformer(id);
      router.push("/performers");
    } catch (error) {
      console.error(error);
      setDeleting(false);
    }
  }

  if (loading && !performer) {
    return (
      <div className="surface-well flex items-center justify-center p-16">
        <Loader2 className="h-7 w-7 animate-spin text-text-accent" />
      </div>
    );
  }

  if (notFound || !performer) {
    return (
      <div className="space-y-4">
        <BackLink fallback="/performers" label={terms.performers} />
        <div className="surface-well p-12 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-text-disabled" />
          <p className="text-sm text-text-muted">{terms.performer} not found.</p>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <PerformerEdit
        id={id}
        onSaved={() => {
          setEditing(false);
          void loadPerformer();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const imageUrl = toApiUrl(performer.imagePath);
  const performerTagsVisible = tagsVisibleInNsfwMode(performer.tags, nsfwMode);
  const initials = performer.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const metaItems: { icon: React.ReactNode; label: string; value: string }[] = [];
  if (performer.gender) {
    metaItems.push({
      icon: <Users className="h-3.5 w-3.5" />,
      label: "Gender",
      value: performer.gender,
    });
  }
  if (performer.birthdate) {
    const age = computeAge(performer.birthdate);
    const display = age ? `${performer.birthdate} (${age})` : performer.birthdate;
    metaItems.push({
      icon: <Calendar className="h-3.5 w-3.5" />,
      label: "Birthdate",
      value: display,
    });
  }
  if (performer.country) {
    metaItems.push({
      icon: <Globe className="h-3.5 w-3.5" />,
      label: "Country",
      value: performer.country,
    });
  }
  if (performer.ethnicity) {
    metaItems.push({
      icon: <Heart className="h-3.5 w-3.5" />,
      label: "Ethnicity",
      value: performer.ethnicity,
    });
  }
  if (performer.height) {
    metaItems.push({
      icon: <Ruler className="h-3.5 w-3.5" />,
      label: "Height",
      value: `${performer.height} cm`,
    });
  }
  if (performer.weight) {
    metaItems.push({
      icon: <Weight className="h-3.5 w-3.5" />,
      label: "Weight",
      value: `${performer.weight} kg`,
    });
  }
  if (performer.measurements) {
    metaItems.push({
      icon: <Ruler className="h-3.5 w-3.5" />,
      label: "Measurements",
      value: performer.measurements,
    });
  }
  if (performer.eyeColor) {
    metaItems.push({
      icon: <Eye className="h-3.5 w-3.5" />,
      label: "Eye Color",
      value: performer.eyeColor,
    });
  }
  if (performer.hairColor) {
    metaItems.push({
      icon: <Palette className="h-3.5 w-3.5" />,
      label: "Hair Color",
      value: performer.hairColor,
    });
  }
  if (performer.careerStart) {
    metaItems.push({
      icon: <Film className="h-3.5 w-3.5" />,
      label: "Career",
      value: performer.careerEnd
        ? `${performer.careerStart} - ${performer.careerEnd}`
        : `${performer.careerStart} - present`,
    });
  }
  if (performer.tattoos) {
    metaItems.push({
      icon: <Pencil className="h-3.5 w-3.5" />,
      label: "Tattoos",
      value: performer.tattoos,
    });
  }
  if (performer.piercings) {
    metaItems.push({
      icon: <Pencil className="h-3.5 w-3.5" />,
      label: "Piercings",
      value: performer.piercings,
    });
  }

  return (
    <div className="space-y-6">
      <BackLink fallback="/performers" label={terms.performers} />

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="w-full max-w-xs self-center flex-shrink-0 sm:max-w-sm lg:w-72 lg:max-w-none lg:self-auto">
          <NsfwBlur isNsfw={performer.isNsfw ?? false} className="relative mb-4 aspect-[3/4] overflow-hidden bg-surface-3">
            <div className="relative aspect-[3/4] overflow-hidden bg-surface-3">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={performer.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="select-none font-heading text-6xl font-semibold text-text-disabled/40">
                    {initials}
                  </span>
                </div>
              )}
            </div>
          </NsfwBlur>

          <div className="space-y-2">
            <button
              onClick={handleToggleFavorite}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded px-3 py-2 text-sm transition-all duration-fast",
                performer.favorite
                  ? "border border-border-accent bg-accent-950 text-text-accent"
                  : "surface-well text-text-muted hover:border-border-accent hover:text-text-accent",
              )}
            >
              <Star className={cn("h-4 w-4", performer.favorite && "fill-current")} />
              {performer.favorite ? "Favorited" : "Favorite"}
            </button>

            <div className="surface-well px-3 py-2.5 text-center">
              <div className="mb-1.5 text-kicker">Rating</div>
              <div className="flex items-center justify-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => void handleSetRating(star * 20)}
                    className="p-0.5 transition-colors duration-fast"
                  >
                    <Star
                      className={cn(
                        "h-5 w-5 transition-colors duration-fast",
                        performer.rating != null && star * 20 <= performer.rating
                          ? "fill-current text-text-accent"
                          : "text-text-disabled hover:text-text-accent/50",
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setEditing(true)}
                className="surface-well flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-text-muted transition-colors duration-fast hover:text-text-accent"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="surface-well flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-text-muted transition-colors duration-fast hover:text-status-error"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? "..." : "Delete"}
              </button>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-6">
          <div>
            <h1 className="flex flex-wrap items-center gap-2.5">
              <Users className="h-5 w-5 flex-shrink-0 text-text-accent" />
              {performer.name}
            </h1>
            {performer.disambiguation ? (
              <p className="mt-1 text-sm text-text-muted">{performer.disambiguation}</p>
            ) : null}
            {performer.aliases ? (
              <p className="mt-1 text-xs text-text-disabled">Also known as: {performer.aliases}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5 text-sm text-text-muted">
                <Film className="h-4 w-4" />
                <span className="text-mono-sm">{formatVideoCount(totalScenes)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-text-muted">
                <Images className="h-4 w-4" />
                <span className="text-mono-sm">
                  {totalGalleries === 1 ? "1 gallery" : `${totalGalleries} galleries`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-text-muted">
                <Music className="h-4 w-4" />
                <span className="text-mono-sm">
                  {totalAudioLibraries === 1 ? "1 audio library" : `${totalAudioLibraries} audio libraries`}
                </span>
              </div>
              {performer.isNsfw && <NsfwChip />}
            </div>
          </div>

          {performerTagsVisible.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {performerTagsVisible.map((tag) => (
                <span key={tag.id} className="tag-chip tag-chip-default">
                  <TagIcon className="mr-1 h-2.5 w-2.5" />
                  <NsfwTagLabel isNsfw={tag.isNsfw}>{tag.name}</NsfwTagLabel>
                </span>
              ))}
            </div>
          ) : null}

          {metaItems.length > 0 ? (
            <div className="surface-well p-4">
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {metaItems.map((item) => (
                  <div key={item.label} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex-shrink-0 text-text-disabled">{item.icon}</span>
                    <div className="min-w-0">
                      <div className="text-kicker">{item.label}</div>
                      <div className="break-words text-sm text-text-secondary">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {performer.details ? (
            <div className="surface-well p-4">
              <div className="mb-2 text-kicker">Biography</div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">
                {performer.details}
              </p>
            </div>
          ) : null}

          <NsfwGate>
            <div className="surface-well p-4">
              <div className="mb-2 text-kicker">StashBox IDs</div>
              <StashIdChips entityType="performer" entityId={id} compact />
            </div>
          </NsfwGate>

          <div className="separator" />

          <section>
            <h4 className="mb-3 text-kicker">{terms.scenes}</h4>
            {totalScenes > 0 ? (
              <SceneGrid scenes={scenes} viewMode="grid" loading={false} from={currentPath} />
            ) : (
              <div className="surface-well p-8 text-center">
                <Film className="mx-auto mb-2 h-8 w-8 text-text-disabled" />
                <p className="text-sm text-text-muted">
                  No {terms.scenes.toLowerCase()} with this {terms.performer.toLowerCase()}.
                </p>
              </div>
            )}
          </section>

          <div className="separator" />

          <section>
            <h4 className="mb-3 text-kicker">Galleries</h4>
            {totalGalleries > 0 ? (
              <GalleryGrid galleries={galleries} viewMode="grid" loading={false} from={currentPath} />
            ) : (
              <div className="surface-well p-8 text-center">
                <Images className="mx-auto mb-2 h-8 w-8 text-text-disabled" />
                <p className="text-sm text-text-muted">
                  No galleries are linked to this {terms.performer.toLowerCase()}.
                </p>
              </div>
            )}
          </section>

          <div className="separator" />

          <section>
            <h4 className="mb-3 text-kicker">Audio</h4>
            <AudioLibraryAppearanceGrid
              libraries={audioLibraries}
              emptyMessage={`No audio libraries list this ${terms.performer.toLowerCase()}.`}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function computeAge(birthdate: string): string | null {
  try {
    const birth = new Date(birthdate);
    if (Number.isNaN(birth.getTime())) {
      return null;
    }

    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age > 0 && age < 120 ? `age ${age}` : null;
  } catch {
    return null;
  }
}
