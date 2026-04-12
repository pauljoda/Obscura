"use client";

import Link from "next/link";
import { Film, Image as ImageIcon, Layers } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { GalleryListItem, SceneListItem } from "../../lib/api";
import type { ImageListItemDto } from "@obscura/contracts";
import { toApiUrl } from "../../lib/api";

interface Design3ClientProps {
  scenes: SceneListItem[];
  galleries: GalleryListItem[];
  images: ImageListItemDto[];
}

export function Design3Client({ scenes, galleries, images }: Design3ClientProps) {
  // Combine all items and sort by date or just interleave them
  const feedItems = [];
  const maxLen = Math.max(scenes.length, galleries.length, images.length);
  
  for (let i = 0; i < maxLen; i++) {
    if (scenes[i]) feedItems.push({ type: "scene" as const, data: scenes[i] });
    if (galleries[i]) feedItems.push({ type: "gallery" as const, data: galleries[i] });
    if (images[i]) feedItems.push({ type: "image" as const, data: images[i] });
  }

  return (
    <div className="min-h-screen bg-bg text-text-primary py-16 md:py-24">
      <div className="max-w-3xl mx-auto px-4 md:px-8">
        <header className="mb-20 text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-serif tracking-tight text-text-primary">
            The Feed
          </h1>
          <p className="text-text-muted text-sm uppercase tracking-widest font-mono">
            Curated Media Stream
          </p>
          <div className="w-12 h-1 bg-accent-500 mx-auto" />
        </header>

        <div className="space-y-24">
          {feedItems.map((item, index) => {
            if (item.type === "scene") {
              const scene = item.data as SceneListItem;
              return (
                <article key={`scene-${scene.id}`} className="group">
                  <Link href={`/scenes/${scene.id}`} className="block relative overflow-hidden bg-surface-1 border border-border-subtle shadow-md">
                    <div className="aspect-video w-full">
                      <img
                        src={toApiUrl(scene.cardThumbnailPath || scene.thumbnailPath) || ""}
                        alt={scene.title}
                        className="w-full h-full object-cover transition-transform duration-[800ms] group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-moderate">
                      <div className="w-16 h-16 border-2 border-accent-500 flex items-center justify-center bg-black/40 backdrop-blur-md text-accent-500">
                        <Film className="w-6 h-6 ml-1" />
                      </div>
                    </div>
                  </Link>
                  <div className="mt-6 flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-text-primary group-hover:text-accent-400 transition-colors duration-normal">
                        {scene.title}
                      </h2>
                      {scene.details && (
                        <p className="mt-2 text-text-secondary text-sm max-w-xl">
                          {scene.details}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 text-xs font-mono text-text-muted uppercase tracking-wider">
                      <span>{scene.durationFormatted}</span>
                      {scene.resolution && (
                        <span className="text-accent-500">{scene.resolution}</span>
                      )}
                    </div>
                  </div>
                </article>
              );
            }

            if (item.type === "gallery") {
              const gallery = item.data as GalleryListItem;
              return (
                <article key={`gallery-${gallery.id}`} className="group">
                  <Link href={`/galleries/${gallery.id}`} className="block relative overflow-hidden bg-surface-1 border border-border-subtle shadow-md">
                    <div className="aspect-[16/10] w-full">
                      <img
                        src={toApiUrl(gallery.coverImagePath) || ""}
                        alt={gallery.title}
                        className="w-full h-full object-cover transition-transform duration-[800ms] group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-moderate">
                      <div className="w-16 h-16 border-2 border-accent-500 flex items-center justify-center bg-black/40 backdrop-blur-md text-accent-500">
                        <Layers className="w-6 h-6" />
                      </div>
                    </div>
                  </Link>
                  <div className="mt-6 flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-text-primary group-hover:text-accent-400 transition-colors duration-normal">
                        {gallery.title}
                      </h2>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-xs font-mono text-text-muted uppercase tracking-wider">
                      <span className="text-accent-500">{gallery.imageCount} Images</span>
                    </div>
                  </div>
                </article>
              );
            }

            if (item.type === "image") {
              const image = item.data as ImageListItemDto;
              return (
                <article key={`image-${image.id}`} className="group">
                  <Link href={`/images/${image.id}`} className="block relative overflow-hidden bg-surface-1 border border-border-subtle shadow-md">
                    <div className="w-full">
                      <img
                        src={toApiUrl(image.thumbnailPath) || ""}
                        alt={image.title}
                        className="w-full h-auto object-cover transition-transform duration-[800ms] group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    </div>
                  </Link>
                  <div className="mt-4 flex items-center justify-between text-xs font-mono text-text-muted uppercase tracking-wider">
                    <h2 className="text-lg font-bold text-text-primary group-hover:text-accent-400 transition-colors duration-normal">
                      {image.title || "Untitled Image"}
                    </h2>
                    <span className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Image
                    </span>
                  </div>
                </article>
              );
            }

            return null;
          })}
        </div>
        
        <div className="mt-24 text-center">
          <div className="w-2 h-2 bg-accent-500 mx-auto animate-pulse" />
          <p className="mt-4 text-xs font-mono text-text-muted uppercase tracking-widest">
            End of Feed
          </p>
        </div>
      </div>
    </div>
  );
}
