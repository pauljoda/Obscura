"use client";

import { type ComponentType } from "react";
import Link from "next/link";
import { User, Tag as TagIcon, Star } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { toApiUrl } from "../../lib/api";
import {
  NsfwBlur,
  NsfwTagLabel,
  tagsVisibleInNsfwMode,
} from "../nsfw/nsfw-gate";
import { useNsfw } from "../nsfw/nsfw-context";
import { useTerms } from "../../lib/terminology";

/* ─── Types ──────────────────────────────────────────────────── */

export interface PerformerEmbed {
  id: string;
  name: string;
  imagePath?: string | null;
  gender?: string | null;
  favorite?: boolean;
  isNsfw?: boolean;
}

export interface TagEmbed {
  id: string;
  name: string;
  isNsfw: boolean;
}

/* ─── Compound layout ────────────────────────────────────────── */

/**
 * MetadataPanel — two-column grid layout used by scene, gallery, and audio
 * metadata views. Left column is the main content (performers, tags, etc.),
 * right column is an optional sidebar (file info, etc.).
 */
export function MetadataPanel({
  children,
  sidebar,
  className,
}: {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-5", className)}>
      <div className={cn("space-y-5", sidebar ? "lg:col-span-2" : "lg:col-span-3")}>
        {children}
      </div>
      {sidebar && (
        <div className="surface-panel p-4 space-y-3 h-fit">{sidebar}</div>
      )}
    </div>
  );
}

/* ─── Performers section ─────────────────────────────────────── */

export function PerformersSection({
  performers,
  parentIsNsfw = false,
  headingLabel,
}: {
  performers: PerformerEmbed[];
  parentIsNsfw?: boolean;
  /** When set (e.g. "Artists" on audio libraries), overrides terminology.performers for the heading only. */
  headingLabel?: string;
}) {
  const terms = useTerms();
  const heading = headingLabel ?? terms.performers;

  return (
    <section>
      <h4 className="text-kicker mb-3 flex items-center gap-2">
        <User className="h-3.5 w-3.5" />
        {heading}
      </h4>
      {performers.length === 0 ? (
        <p className="text-text-disabled text-sm">
          No {heading.toLowerCase()} tagged
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {performers.map((p) => {
            const imgUrl = toApiUrl(p.imagePath);
            const initials = p.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <Link
                key={p.id}
                href={`/performers/${p.id}`}
                className="surface-card-sharp flex items-center gap-3 p-2.5 pr-4 hover:border-border-accent transition-colors"
              >
                <NsfwBlur
                  isNsfw={parentIsNsfw || (p.isNsfw ?? false)}
                  className="flex-shrink-0 h-12 w-9 overflow-hidden bg-surface-3 border border-border-subtle"
                >
                  <div className="h-12 w-9 overflow-hidden bg-surface-3">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={p.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[0.6rem] font-mono font-medium text-text-muted">
                        {initials}
                      </div>
                    )}
                  </div>
                </NsfwBlur>
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {p.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.gender && (
                      <span className="text-xs text-text-disabled capitalize">
                        {p.gender}
                      </span>
                    )}
                    {p.favorite && (
                      <Star className="h-3 w-3 fill-accent-500 text-accent-500" />
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ─── Tags section ───────────────────────────────────────────── */

export function TagsSection({ tags }: { tags: TagEmbed[] }) {
  const { mode: nsfwMode } = useNsfw();
  const visible = tagsVisibleInNsfwMode(tags, nsfwMode);

  return (
    <section>
      <h4 className="text-kicker mb-3 flex items-center gap-2">
        <TagIcon className="h-3.5 w-3.5" />
        Tags
      </h4>
      {visible.length === 0 ? (
        <p className="text-text-disabled text-sm">No tags</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {visible.map((tag) => (
            <Link
              key={tag.id}
              href={`/tags/${encodeURIComponent(tag.name)}`}
              className="tag-chip tag-chip-default hover:tag-chip-accent transition-colors cursor-pointer"
            >
              <NsfwTagLabel isNsfw={tag.isNsfw}>{tag.name}</NsfwTagLabel>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/* ─── Info row (for sidebar) ─────────────────────────────────── */

export function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-text-muted text-xs">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="text-mono-sm">{value}</span>
    </div>
  );
}
