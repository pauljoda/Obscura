import { cn } from "../lib/utils";
import { Badge } from "../primitives/badge";
import { Play, Clock, HardDrive, Eye } from "lucide-react";

export interface MediaCardProps {
  title: string;
  thumbnail?: string;
  gradientClass?: string;
  duration?: string;
  resolution?: string;
  codec?: string;
  fileSize?: string;
  studio?: string;
  performers?: string[];
  tags?: string[];
  tagColors?: Record<string, string>;
  rating?: number;
  views?: number;
  href?: string;
  className?: string;
}

export function MediaCard({
  title,
  thumbnail,
  gradientClass,
  duration,
  resolution,
  codec,
  fileSize,
  studio,
  performers,
  tags,
  tagColors,
  views,
  className,
}: MediaCardProps) {
  return (
    <article
      className={cn(
        "surface-card-sharp group cursor-pointer overflow-hidden",
        className
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-surface-1">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-normal group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center",
              gradientClass || "bg-surface-1"
            )}
          >
            <Play className="h-7 w-7 text-white/15" />
          </div>
        )}

        {/* Bottom gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

        {/* Duration badge - bottom left */}
        {duration && (
          <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-sm bg-black/75 px-1.5 py-0.5 text-[0.65rem] font-mono text-white/90 backdrop-blur-sm">
            <Clock className="h-2.5 w-2.5 text-white/60" />
            {duration}
          </span>
        )}

        {/* Resolution + codec - top right */}
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
          {resolution && (
            <span className="pill-accent px-1.5 py-0.5 text-[0.58rem] font-semibold tracking-wide">
              {resolution}
            </span>
          )}
          {codec && (
            <span className="rounded-sm bg-black/60 px-1.5 py-0.5 text-[0.58rem] font-mono text-white/70 backdrop-blur-sm">
              {codec}
            </span>
          )}
        </div>

        {/* Play overlay on hover */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity duration-normal group-hover:opacity-100">
          <div className="flex h-11 w-11 items-center justify-center rounded-sm bg-accent-500/90 text-accent-950 shadow-lg shadow-accent-500/25">
            <Play className="h-4.5 w-4.5 ml-0.5" fill="currentColor" />
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="p-2.5 space-y-1.5">
        {/* Title */}
        <h4 className="truncate text-[0.8rem] font-medium text-text-primary leading-tight">
          {title}
        </h4>

        {/* Studio + Performers */}
        {(studio || performers?.length) && (
          <div className="flex items-center gap-1.5 text-text-muted min-w-0">
            {studio && (
              <span className="text-[0.7rem] text-text-accent truncate flex-shrink-0">
                {studio}
              </span>
            )}
            {studio && performers?.length ? (
              <span className="text-text-disabled text-[0.6rem]">/</span>
            ) : null}
            {performers && performers.length > 0 && (
              <span className="text-[0.7rem] truncate">
                {performers.slice(0, 2).join(", ")}
                {performers.length > 2 && (
                  <span className="text-text-disabled">
                    {" "}+{performers.length - 2}
                  </span>
                )}
              </span>
            )}
          </div>
        )}

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => {
              const colorClass =
                tagColors?.[tag] || "tag-chip-default";
              return (
                <span key={tag} className={cn("tag-chip", colorClass)}>
                  {tag}
                </span>
              );
            })}
            {tags.length > 3 && (
              <span className="tag-chip tag-chip-default text-text-disabled">
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Bottom info bar */}
        {(fileSize || views !== undefined) && (
          <div className="flex items-center gap-3 pt-1 border-t border-border-subtle">
            {fileSize && (
              <span className="flex items-center gap-1 text-[0.62rem] text-text-disabled">
                <HardDrive className="h-2.5 w-2.5" />
                {fileSize}
              </span>
            )}
            {views !== undefined && (
              <span className="flex items-center gap-1 text-[0.62rem] text-text-disabled">
                <Eye className="h-2.5 w-2.5" />
                {views}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
