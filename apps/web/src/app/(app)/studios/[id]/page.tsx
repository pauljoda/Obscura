"use client";

import { useEffect, useState } from "react";
import { Building2, ArrowLeft, Loader2, Globe, Pencil } from "lucide-react";
import Link from "next/link";
import { SceneGrid } from "../../../../components/scene-grid";
import { StudioEdit } from "../../../../components/studio-edit";
import { StashIdChips } from "../../../../components/stash-id-chips";
import {
  fetchScenes,
  fetchStudioDetail,
  type SceneListItem,
  type StudioDetail,
} from "../../../../lib/api";
import { use } from "react";

interface StudioPageProps {
  params: Promise<{ id: string }>;
}

export default function StudioPage({ params }: StudioPageProps) {
  const { id } = use(params);

  const [studio, setStudio] = useState<StudioDetail | null>(null);
  const [scenes, setScenes] = useState<SceneListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);

  function loadData() {
    setLoading(true);
    fetchStudioDetail(id)
      .then(async (data) => {
        setStudio(data);
        const scenesData = await fetchScenes({ studio: id, limit: 100 });
        setScenes(scenesData.scenes);
        setTotal(scenesData.total);
      })
      .catch((err) => {
        console.error(err);
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="surface-well p-16 flex items-center justify-center">
        <Loader2 className="h-7 w-7 text-text-accent animate-spin" />
      </div>
    );
  }

  if (notFound || !studio) {
    return (
      <div className="space-y-4">
        <Link
          href="/studios"
          className="inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast"
        >
          <ArrowLeft className="h-3 w-3" />
          Studios
        </Link>
        <div className="surface-well p-12 text-center">
          <Building2 className="h-10 w-10 text-text-disabled mx-auto mb-3" />
          <p className="text-text-muted text-sm">Studio not found.</p>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <StudioEdit
        id={id}
        onSaved={() => { setEditing(false); loadData(); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const initials = studio.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link
        href="/studios"
        className="inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast"
      >
        <ArrowLeft className="h-3 w-3" />
        Studios
      </Link>

      {/* Hero header */}
      <div className="flex items-start gap-5">
        {studio.imageUrl ? (
          <div className="flex-shrink-0 h-16 w-16 rounded-xl overflow-hidden bg-surface-3">
            <img src={studio.imageUrl} alt={studio.name} className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-surface-3 text-xl font-semibold font-heading text-text-muted">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="flex items-center gap-2.5">
              <Building2 className="h-5 w-5 text-text-accent" />
              {studio.name}
            </h1>
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[0.68rem] text-text-muted hover:text-text-accent border border-border-subtle hover:border-border-accent transition-all duration-fast"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <p className="text-mono-sm text-text-muted">
              {total} scene{total !== 1 ? "s" : ""}
            </p>
            {studio.url && (
              <a
                href={studio.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-accent transition-colors duration-fast"
              >
                <Globe className="h-3 w-3" />
                {studio.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            )}
          </div>
          {/* StashBox IDs */}
          <div className="mt-2">
            <StashIdChips entityType="studio" entityId={id} compact />
          </div>
        </div>
      </div>

      <div className="separator" />

      {/* Scene grid */}
      <section>
        <h4 className="text-kicker mb-3">Scenes</h4>
        <SceneGrid scenes={scenes} viewMode="grid" loading={false} />
      </section>
    </div>
  );
}
