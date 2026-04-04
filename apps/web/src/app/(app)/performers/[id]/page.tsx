"use client";

import { useEffect, useState } from "react";
import { Users, Star, Film, ArrowLeft, Loader2, Globe, Calendar, Ruler } from "lucide-react";
import Link from "next/link";
import { Button } from "@obscura/ui";
import { SceneGrid } from "../../../../components/scene-grid";
import {
  fetchPerformerDetail,
  fetchScenes,
  type SceneListItem,
  type PerformerDetail,
} from "../../../../lib/api";
import { use } from "react";

interface PerformerPageProps {
  params: Promise<{ id: string }>;
}

export default function PerformerPage({ params }: PerformerPageProps) {
  const { id } = use(params);

  const [performer, setPerformer] = useState<PerformerDetail | null>(null);
  const [scenes, setScenes] = useState<SceneListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchPerformerDetail(id)
      .then(async (data) => {
        setPerformer(data);
        const scenesData = await fetchScenes({ performer: [data.name], limit: 100 });
        setScenes(scenesData.scenes);
        setTotal(scenesData.total);
      })
      .catch((err) => {
        console.error(err);
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

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

  const initials = performer.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const metaItems: { icon: React.ReactNode; label: string; value: string }[] = [];
  if (performer.gender) metaItems.push({ icon: <Users className="h-3.5 w-3.5" />, label: "Gender", value: performer.gender });
  if (performer.birthdate) metaItems.push({ icon: <Calendar className="h-3.5 w-3.5" />, label: "Birthdate", value: performer.birthdate });
  if (performer.country) metaItems.push({ icon: <Globe className="h-3.5 w-3.5" />, label: "Country", value: performer.country });
  if (performer.height) metaItems.push({ icon: <Ruler className="h-3.5 w-3.5" />, label: "Height", value: `${performer.height} cm` });
  if (performer.careerStart) metaItems.push({ icon: <Film className="h-3.5 w-3.5" />, label: "Career", value: performer.careerEnd ? `${performer.careerStart}–${performer.careerEnd}` : `${performer.careerStart}–` });

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

      {/* Hero */}
      <div className="flex items-start gap-6">
        <div className="relative flex-shrink-0">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-surface-3 text-4xl font-semibold font-heading text-text-muted">
            {initials}
          </div>
          {performer.favorite && (
            <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-accent-950 border-2 border-bg">
              <Star className="h-3.5 w-3.5 text-text-accent fill-current" />
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="flex items-center gap-2.5">
              <Users className="h-5 w-5 text-text-accent" />
              {performer.name}
            </h1>
            {performer.favorite && (
              <Button variant="ghost" size="icon" disabled aria-label="Favorited">
                <Star className="h-4 w-4 text-text-accent fill-current" />
              </Button>
            )}
          </div>

          {performer.disambiguation && (
            <p className="text-text-muted text-sm mt-1">{performer.disambiguation}</p>
          )}

          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-text-muted text-sm">
              <Film className="h-4 w-4" />
              <span className="text-mono-sm">{total} scene{total !== 1 ? "s" : ""}</span>
            </div>
          </div>

          {/* Meta strip */}
          {metaItems.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-3">
              {metaItems.map((item) => (
                <div key={item.label} className="flex items-center gap-1.5 text-text-disabled text-xs">
                  {item.icon}
                  <span className="text-text-muted">{item.label}:</span>
                  <span className="text-mono-sm text-text-secondary">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bio */}
      {performer.details && (
        <div className="surface-well p-4">
          <p className="text-text-secondary text-sm leading-relaxed">{performer.details}</p>
        </div>
      )}

      <div className="separator" />

      {/* Scene grid */}
      <section>
        <h4 className="text-kicker mb-3">Scenes</h4>
        <SceneGrid scenes={scenes} viewMode="grid" loading={false} />
      </section>
    </div>
  );
}
