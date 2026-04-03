import { cn } from "../lib/utils";
import { Badge } from "../primitives/badge";
import { Play } from "lucide-react";

export interface MediaCardProps {
  title: string;
  thumbnail?: string;
  duration?: string;
  resolution?: string;
  studio?: string;
  performers?: string[];
  tags?: string[];
  rating?: number;
  href?: string;
  className?: string;
}

function formatDuration(duration: string) {
  return duration;
}

export function MediaCard({
  title,
  thumbnail,
  duration,
  resolution,
  studio,
  performers,
  tags,
  className,
}: MediaCardProps) {
  return (
    <article className={cn("surface-card group cursor-pointer overflow-hidden", className)}>
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-surface-1">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-normal group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Play className="h-8 w-8 text-text-disabled" />
          </div>
        )}

        {/* Duration badge */}
        {duration && (
          <span className="absolute bottom-2 right-2 rounded-md bg-bg/80 px-1.5 py-0.5 text-mono-sm text-text-primary backdrop-blur-sm">
            {formatDuration(duration)}
          </span>
        )}

        {/* Resolution badge */}
        {resolution && (
          <Badge
            variant="accent"
            className="absolute top-2 right-2 text-[0.6rem]"
          >
            {resolution}
          </Badge>
        )}

        {/* Play overlay on hover */}
        <div className="absolute inset-0 flex items-center justify-center bg-bg/30 opacity-0 transition-opacity duration-normal group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-500/90 text-accent-950">
            <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="p-3 space-y-1.5">
        <h4 className="truncate text-sm font-medium text-text-primary">
          {title}
        </h4>

        {(studio || performers?.length) && (
          <div className="flex items-center gap-1.5 text-text-muted">
            {studio && <span className="text-xs truncate">{studio}</span>}
            {studio && performers?.length ? (
              <span className="text-text-disabled">·</span>
            ) : null}
            {performers && performers.length > 0 && (
              <span className="text-xs truncate">
                {performers.slice(0, 2).join(", ")}
                {performers.length > 2 && ` +${performers.length - 2}`}
              </span>
            )}
          </div>
        )}

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[0.65rem] text-text-muted"
              >
                {tag}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[0.65rem] text-text-disabled">
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
