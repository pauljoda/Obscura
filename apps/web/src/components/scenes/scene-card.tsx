"use client";

import Link from "next/link";
import { Clock, Eye, Film, HardDrive, Star } from "lucide-react";
import { MediaCard } from "@obscura/ui/composed/media-card";
import { cn } from "@obscura/ui/lib/utils";
import { SCENE_TAG_COLORS } from "../scene-tag-colors";
import type { SceneCardData } from "./scene-card-data";
import { SCENE_CARD_GRADIENTS } from "./scene-card-gradients";
import { NsfwBlur, NsfwText } from "../nsfw/nsfw-gate";

interface SceneCardProps {
  scene: SceneCardData;
  variant?: "grid" | "list" | "compact";
  index?: number;
  imageLoading?: "eager" | "lazy";
  onSelect?: (href: string) => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export function SceneCard({
  scene,
  variant = "grid",
  index = 0,
  imageLoading = "lazy",
  onSelect,
  selected,
  onToggleSelect,
}: SceneCardProps) {
  if (variant === "list") {
    return <SceneListCard scene={scene} index={index} selected={selected} onToggleSelect={onToggleSelect} />;
  }

  if (variant === "compact") {
    return <SceneCompactCard scene={scene} onSelect={onSelect} />;
  }

  return (
    <NsfwBlur isNsfw={scene.isNsfw ?? false} className="h-full">
      <Link href={scene.href}>
        <MediaCard
          title={scene.title}
          thumbnail={scene.thumbnail}
          cardThumbnail={scene.cardThumbnail}
          imageLoading={imageLoading}
          trickplaySprite={scene.trickplaySprite}
          trickplayVtt={scene.trickplayVtt}
          scrubDurationSeconds={scene.scrubDurationSeconds}
          duration={scene.duration}
          resolution={scene.resolution}
          codec={scene.codec}
          fileSize={scene.fileSize}
          studio={scene.studio}
          performers={scene.performers}
          tags={scene.tags}
          tagColors={SCENE_TAG_COLORS}
          rating={scene.rating}
          views={scene.views}
          gradientClass={SCENE_CARD_GRADIENTS[index % SCENE_CARD_GRADIENTS.length]}
        />
      </Link>
    </NsfwBlur>
  );
}

function SceneListCard({
  scene,
  index,
  selected,
  onToggleSelect,
}: {
  scene: SceneCardData;
  index: number;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  return (
    <Link href={scene.href}>
      <div className="surface-card-sharp group flex items-center gap-3 px-3 py-2 cursor-pointer">
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={selected ?? false}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => { e.preventDefault(); onToggleSelect(scene.id); }}
            className="accent-[#c79b5c] h-3.5 w-3.5 cursor-pointer flex-shrink-0"
          />
        )}
        <NsfwBlur isNsfw={scene.isNsfw ?? false}>
          <div
            className={cn(
              "relative w-28 flex-shrink-0 aspect-video overflow-hidden",
              SCENE_CARD_GRADIENTS[index % SCENE_CARD_GRADIENTS.length],
            )}
          >
            {scene.thumbnail && (
              <img
                src={scene.cardThumbnail || scene.thumbnail}
                alt={scene.title}
                loading={index < 6 ? "eager" : "lazy"}
                decoding="async"
                className="h-full w-full object-cover"
              />
            )}
            {scene.duration && (
              <span className="absolute bottom-0.5 right-0.5 text-[0.55rem] font-mono bg-black/70 text-white/80 px-1 ">
                {scene.duration}
              </span>
            )}
          </div>
        </NsfwBlur>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <NsfwText isNsfw={scene.isNsfw ?? false} className="truncate text-[0.8rem] font-medium text-text-primary block">
              {scene.title}
            </NsfwText>
            {scene.resolution && (
              <span className="pill-accent px-1 py-0 text-[0.55rem] font-semibold flex-shrink-0">
                {scene.resolution}
              </span>
            )}
            {scene.codec && (
              <span className="text-[0.55rem] font-mono text-text-disabled flex-shrink-0">
                {scene.codec}
              </span>
            )}
          </div>

          {!!scene.performers?.length && (
            <div className="flex items-center gap-2 text-[0.7rem] text-text-muted">
              <span className="inline-flex items-center gap-1.5 truncate">
                {scene.performers.slice(0, 3).map((performer) => (
                  <span key={performer.name} className="inline-flex items-center gap-1">
                    {performer.imagePath && (
                      <NsfwBlur isNsfw={performer.isNsfw ?? false} className="h-4 w-3 flex-shrink-0 overflow-hidden">
                        <img
                          src={performer.imagePath}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-4 w-3 object-cover"
                        />
                      </NsfwBlur>
                    )}
                    <span>{performer.name}</span>
                  </span>
                ))}
                {scene.performers.length > 3 && (
                  <span className="text-text-disabled">+{scene.performers.length - 3}</span>
                )}
              </span>
            </div>
          )}

          {!!scene.tags?.length && (
            <div className="hidden sm:flex flex-wrap gap-1">
              {scene.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className={cn("tag-chip", SCENE_TAG_COLORS[tag] || "tag-chip-default")}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="hidden md:flex items-center gap-4 text-[0.65rem] text-text-disabled flex-shrink-0">
          {scene.rating != null && scene.rating > 0 && (
            <span className="flex items-center gap-0.5 text-glow-accent">
              <Star className="h-3 w-3 fill-current" />
              {Math.round(scene.rating / 20)}
            </span>
          )}
          {scene.fileSize && (
            <span className="flex items-center gap-1 text-ephemeral">
              <HardDrive className="h-3 w-3" />
              {scene.fileSize}
            </span>
          )}
          {scene.views != null && scene.views > 0 && (
            <span className="flex items-center gap-1 text-ephemeral">
              <Eye className="h-3 w-3" />
              {scene.views}
            </span>
          )}
          {scene.duration && (
            <span className="flex items-center gap-1 text-ephemeral">
              <Clock className="h-3 w-3" />
              {scene.duration}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function SceneCompactCard({
  scene,
  onSelect,
}: {
  scene: SceneCardData;
  onSelect?: (href: string) => void;
}) {
  const content = (
    <>
      <div
        className={cn(
          "shrink-0 overflow-hidden bg-surface-1 flex items-center justify-center h-8 w-12 ",
          !scene.thumbnail && SCENE_CARD_GRADIENTS[0],
        )}
      >
        {scene.cardThumbnail || scene.thumbnail ? (
          <img
            src={scene.cardThumbnail || scene.thumbnail}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <Film className="h-3.5 w-3.5 text-text-disabled" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-primary truncate">{scene.title}</div>
        <div className="text-[0.68rem] text-text-muted truncate">
          {[scene.studio, scene.duration].filter(Boolean).join(" · ") || "Video"}
        </div>
      </div>

      <span className="shrink-0 tag-chip tag-chip-default text-[0.6rem]">
        scene
      </span>
    </>
  );

  if (onSelect) {
    return (
      <button
        onClick={() => onSelect(scene.href)}
        className="flex items-center gap-3 w-full px-4 py-2 hover:bg-surface-2 transition-colors duration-fast text-left"
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={scene.href}
      className="flex items-center gap-3 w-full px-4 py-2 hover:bg-surface-2 transition-colors duration-fast text-left"
    >
      {content}
    </Link>
  );
}
