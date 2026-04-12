"use client";

import Link from "next/link";
import { Film, Image as ImageIcon, Layers } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { GalleryListItem, SceneListItem } from "../../lib/api";
import type { ImageListItemDto } from "@obscura/contracts";
import { toApiUrl } from "../../lib/api";

interface Design2ClientProps {
  scenes: SceneListItem[];
  galleries: GalleryListItem[];
  images: ImageListItemDto[];
}

export function Design2Client({ scenes, galleries, images }: Design2ClientProps) {
  // Interleave items for a mixed masonry effect
  const mixedItems = [];
  const maxLen = Math.max(scenes.length, galleries.length, images.length);
  
  for (let i = 0; i < maxLen; i++) {
    if (scenes[i]) mixedItems.push({ type: "scene" as const, data: scenes[i] });
    if (images[i]) mixedItems.push({ type: "image" as const, data: images[i] });
    if (galleries[i]) mixedItems.push({ type: "gallery" as const, data: galleries[i] });
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary p-4 md:p-8">
      <header className="mb-12 flex flex-col items-center justify-center text-center pt-8">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-text-primary mb-4">
          The Canvas
        </h1>
        <p className="text-text-muted max-w-2xl text-sm md:text-base">
          An immersive, asymmetrical exploration of your media library. Hover to reveal details.
        </p>
        <div className="h-px w-24 bg-gradient-to-r from-transparent via-accent-500/50 to-transparent mt-8" />
      </header>

      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
        {mixedItems.map((item, index) => {
          if (item.type === "scene") {
            const scene = item.data as SceneListItem;
            return (
              <Link
                key={`scene-${scene.id}`}
                href={`/scenes/${scene.id}`}
                className="group relative block overflow-hidden bg-surface-2 border border-border-subtle break-inside-avoid shadow-md hover:shadow-[0_8px_40px_rgba(0,0,0,0.60)] transition-all duration-moderate"
              >
                <img
                  src={toApiUrl(scene.cardThumbnailPath || scene.thumbnailPath) || ""}
                  alt={scene.title}
                  className="w-full object-cover group-hover:scale-[1.02] transition-transform duration-slow"
                  loading="lazy"
                />
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md p-1.5 border border-white/10 text-accent-300">
                  <Film className="w-4 h-4" />
                </div>
                
                {/* Glass Overlay on Hover */}
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-moderate flex flex-col justify-end p-6">
                  <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-moderate">
                    <h3 className="text-lg font-bold text-white mb-2">{scene.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-accent-100 font-mono">
                      <span>{scene.durationFormatted}</span>
                      {scene.resolution && (
                        <span className="px-1.5 py-0.5 bg-accent-500/20 border border-accent-500/40">
                          {scene.resolution}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          }

          if (item.type === "gallery") {
            const gallery = item.data as GalleryListItem;
            return (
              <Link
                key={`gallery-${gallery.id}`}
                href={`/galleries/${gallery.id}`}
                className="group relative block overflow-hidden bg-surface-2 border border-border-subtle break-inside-avoid shadow-md hover:shadow-[0_8px_40px_rgba(0,0,0,0.60)] transition-all duration-moderate"
              >
                <img
                  src={toApiUrl(gallery.coverImagePath) || ""}
                  alt={gallery.title}
                  className="w-full object-cover group-hover:scale-[1.02] transition-transform duration-slow"
                  loading="lazy"
                />
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md p-1.5 border border-white/10 text-accent-300">
                  <Layers className="w-4 h-4" />
                </div>

                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-moderate flex flex-col justify-end p-6">
                  <div className="translate-y-4 group-hover:translate-y-0 transition-transform duration-moderate">
                    <h3 className="text-lg font-bold text-white mb-2">{gallery.title}</h3>
                    <span className="text-xs text-accent-100 font-mono bg-accent-500/20 border border-accent-500/40 px-2 py-1">
                      {gallery.imageCount} Images
                    </span>
                  </div>
                </div>
              </Link>
            );
          }

          if (item.type === "image") {
            const image = item.data as ImageListItemDto;
            return (
              <Link
                key={`image-${image.id}`}
                href={`/images/${image.id}`}
                className="group relative block overflow-hidden bg-surface-2 border border-border-subtle break-inside-avoid shadow-md hover:shadow-[0_8px_40px_rgba(0,0,0,0.60)] transition-all duration-moderate"
              >
                <img
                  src={toApiUrl(image.thumbnailPath) || ""}
                  alt={image.title}
                  className="w-full object-cover group-hover:scale-[1.02] transition-transform duration-slow"
                  loading="lazy"
                />
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md p-1.5 border border-white/10 text-accent-300 opacity-0 group-hover:opacity-100 transition-opacity duration-normal">
                  <ImageIcon className="w-4 h-4" />
                </div>
              </Link>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
