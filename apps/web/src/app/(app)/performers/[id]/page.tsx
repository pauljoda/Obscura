"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  Star,
  Film,
  ArrowLeft,
  Loader2,
  Globe,
  Calendar,
  Ruler,
  Pencil,
  Wand2,
  Trash2,
  Tag as TagIcon,
  Weight,
  Eye,
  Palette,
  Heart,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@obscura/ui";
import { cn } from "@obscura/ui";
import { SceneGrid } from "../../../../components/scene-grid";
import { PerformerEdit } from "../../../../components/performer-edit";
import {
  fetchPerformerDetail,
  fetchScenes,
  togglePerformerFavorite,
  setPerformerRating,
  deletePerformer,
  toApiUrl,
  type SceneListItem,
  type PerformerDetail,
} from "../../../../lib/api";
import { use } from "react";
import { useRouter } from "next/navigation";

interface PerformerPageProps {
  params: Promise<{ id: string }>;
}

export default function PerformerPage({ params }: PerformerPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [performer, setPerformer] = useState<PerformerDetail | null>(null);
  const [scenes, setScenes] = useState<SceneListItem[]>([]);
  const [totalScenes, setTotalScenes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadPerformer = useCallback(async () => {
    try {
      const data = await fetchPerformerDetail(id);
      setPerformer(data);
      const scenesData = await fetchScenes({ performer: [data.name], limit: 100 });
      setScenes(scenesData.scenes);
      setTotalScenes(scenesData.total);
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPerformer();
  }, [loadPerformer]);

  async function handleToggleFavorite() {
    if (!performer) return;
    try {
      const result = await togglePerformerFavorite(id, !performer.favorite);
      setPerformer((p) => p ? { ...p, favorite: result.favorite } : p);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSetRating(rating: number) {
    if (!performer) return;
    const newRating = performer.rating === rating ? null : rating;
    try {
      await setPerformerRating(id, newRating);
      setPerformer((p) => p ? { ...p, rating: newRating } : p);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this performer? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deletePerformer(id);
      router.push("/performers");
    } catch (err) {
      console.error(err);
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="surface-well p-16 flex items-center justify-center">
        <Loader2 className="h-7 w-7 text-text-accent animate-spin" />
      </div>
    );
  }

  if (notFound || !performer) {
    return (
      <div className="space-y-4">
        <Link
          href="/performers"
          className="inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast"
        >
          <ArrowLeft className="h-3 w-3" />
          Performers
        </Link>
        <div className="surface-well p-12 text-center">
          <Users className="h-10 w-10 text-text-disabled mx-auto mb-3" />
          <p className="text-text-muted text-sm">Performer not found.</p>
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
          setLoading(true);
          loadPerformer();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const imageUrl = toApiUrl(performer.imagePath);

  const initials = performer.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Build metadata items
  const metaItems: { icon: React.ReactNode; label: string; value: string }[] = [];
  if (performer.gender) metaItems.push({ icon: <Users className="h-3.5 w-3.5" />, label: "Gender", value: performer.gender });
  if (performer.birthdate) {
    const age = computeAge(performer.birthdate);
    const display = age ? `${performer.birthdate} (${age})` : performer.birthdate;
    metaItems.push({ icon: <Calendar className="h-3.5 w-3.5" />, label: "Birthdate", value: display });
  }
  if (performer.country) metaItems.push({ icon: <Globe className="h-3.5 w-3.5" />, label: "Country", value: performer.country });
  if (performer.ethnicity) metaItems.push({ icon: <Heart className="h-3.5 w-3.5" />, label: "Ethnicity", value: performer.ethnicity });
  if (performer.height) metaItems.push({ icon: <Ruler className="h-3.5 w-3.5" />, label: "Height", value: `${performer.height} cm` });
  if (performer.weight) metaItems.push({ icon: <Weight className="h-3.5 w-3.5" />, label: "Weight", value: `${performer.weight} lbs` });
  if (performer.measurements) metaItems.push({ icon: <Ruler className="h-3.5 w-3.5" />, label: "Measurements", value: performer.measurements });
  if (performer.eyeColor) metaItems.push({ icon: <Eye className="h-3.5 w-3.5" />, label: "Eye Color", value: performer.eyeColor });
  if (performer.hairColor) metaItems.push({ icon: <Palette className="h-3.5 w-3.5" />, label: "Hair Color", value: performer.hairColor });
  if (performer.careerStart) {
    const career = performer.careerEnd ? `${performer.careerStart} - ${performer.careerEnd}` : `${performer.careerStart} - present`;
    metaItems.push({ icon: <Film className="h-3.5 w-3.5" />, label: "Career", value: career });
  }
  if (performer.tattoos) metaItems.push({ icon: <Pencil className="h-3.5 w-3.5" />, label: "Tattoos", value: performer.tattoos });
  if (performer.piercings) metaItems.push({ icon: <Pencil className="h-3.5 w-3.5" />, label: "Piercings", value: performer.piercings });

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/performers"
        className="inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast"
      >
        <ArrowLeft className="h-3 w-3" />
        Performers
      </Link>

      {/* Main layout: sidebar + content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left sidebar — portrait + actions */}
        <div className="flex-shrink-0 lg:w-72">
          {/* Portrait image */}
          <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-surface-3 mb-4">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={performer.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-6xl font-semibold font-heading text-text-disabled/40 select-none">
                  {initials}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {/* Favorite toggle */}
            <button
              onClick={handleToggleFavorite}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-sm transition-all duration-fast",
                performer.favorite
                  ? "bg-accent-950 text-text-accent border border-border-accent"
                  : "surface-well text-text-muted hover:text-text-accent hover:border-border-accent"
              )}
            >
              <Star className={cn("h-4 w-4", performer.favorite && "fill-current")} />
              {performer.favorite ? "Favorited" : "Favorite"}
            </button>

            {/* Rating */}
            <div className="surface-well px-3 py-2.5 text-center">
              <div className="text-kicker mb-1.5">Rating</div>
              <div className="flex items-center justify-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleSetRating(star * 20)}
                    className="p-0.5 transition-colors duration-fast"
                  >
                    <Star
                      className={cn(
                        "h-5 w-5 transition-colors duration-fast",
                        performer.rating != null && star * 20 <= performer.rating
                          ? "text-text-accent fill-current"
                          : "text-text-disabled hover:text-text-accent/50"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center justify-center gap-1.5 surface-well px-3 py-2 text-xs text-text-muted hover:text-text-accent transition-colors duration-fast"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center justify-center gap-1.5 surface-well px-3 py-2 text-xs text-text-muted hover:text-status-error transition-colors duration-fast"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? "..." : "Delete"}
              </button>
            </div>
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Header */}
          <div>
            <h1 className="flex items-center gap-2.5 flex-wrap">
              <Users className="h-5 w-5 text-text-accent flex-shrink-0" />
              {performer.name}
            </h1>
            {performer.disambiguation && (
              <p className="text-text-muted text-sm mt-1">{performer.disambiguation}</p>
            )}
            {performer.aliases && (
              <p className="text-text-disabled text-xs mt-1">
                Also known as: {performer.aliases}
              </p>
            )}

            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-text-muted text-sm">
                <Film className="h-4 w-4" />
                <span className="text-mono-sm">{totalScenes} scene{totalScenes !== 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          {performer.tags && performer.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {performer.tags.map((tag) => (
                <span key={tag.id} className="tag-chip tag-chip-default">
                  <TagIcon className="h-2.5 w-2.5 mr-1" />
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Metadata grid */}
          {metaItems.length > 0 && (
            <div className="surface-well p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {metaItems.map((item) => (
                  <div key={item.label} className="flex items-start gap-2.5">
                    <span className="text-text-disabled mt-0.5 flex-shrink-0">{item.icon}</span>
                    <div className="min-w-0">
                      <div className="text-kicker">{item.label}</div>
                      <div className="text-sm text-text-secondary break-words">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bio */}
          {performer.details && (
            <div className="surface-well p-4">
              <div className="text-kicker mb-2">Biography</div>
              <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line">{performer.details}</p>
            </div>
          )}

          <div className="separator" />

          {/* Filmography */}
          <section>
            <h4 className="text-kicker mb-3">Filmography</h4>
            {totalScenes > 0 ? (
              <SceneGrid scenes={scenes} viewMode="grid" loading={false} />
            ) : (
              <div className="surface-well p-8 text-center">
                <Film className="h-8 w-8 text-text-disabled mx-auto mb-2" />
                <p className="text-text-muted text-sm">No scenes with this performer.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function computeAge(birthdate: string): string | null {
  try {
    const birth = new Date(birthdate);
    if (Number.isNaN(birth.getTime())) return null;
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
