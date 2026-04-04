"use client";

import { useEffect, useState } from "react";
import { Tag, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { SceneGrid } from "../../../../components/scene-grid";
import { fetchScenes, type SceneListItem } from "../../../../lib/api";
import { use } from "react";

interface TagPageProps {
  params: Promise<{ id: string }>;
}

export default function TagPage({ params }: TagPageProps) {
  const { id } = use(params);
  const tagName = decodeURIComponent(id);

  const [scenes, setScenes] = useState<SceneListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchScenes({ tag: [tagName], limit: 100 })
      .then((r) => {
        setScenes(r.scenes);
        setTotal(r.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tagName]);

  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link
        href="/tags"
        className="inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast"
      >
        <ArrowLeft className="h-3 w-3" />
        Tags
      </Link>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5">
            <Tag className="h-5 w-5 text-text-accent" />
            {tagName}
          </h1>
          <p className="text-text-muted text-[0.78rem] mt-1">
            Scenes tagged with this label
          </p>
        </div>
        {!loading && (
          <span className="text-mono-sm text-text-disabled mt-1">
            {total} scene{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="separator" />

      {/* Scene grid */}
      <section>
        <h4 className="text-kicker mb-3">Tagged Scenes</h4>
        {loading ? (
          <div className="surface-well p-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-text-disabled animate-spin" />
          </div>
        ) : (
          <SceneGrid scenes={scenes} viewMode="grid" loading={false} />
        )}
      </section>
    </div>
  );
}
