"use client";

import Link from "next/link";
import { Play, Image as ImageIcon, Film } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { GalleryListItem, SceneListItem } from "../../lib/api";
import type { ImageListItemDto } from "@obscura/contracts";
import { toApiUrl } from "../../lib/api";

interface Design1ClientProps {
  scenes: SceneListItem[];
  galleries: GalleryListItem[];
  images: ImageListItemDto[];
}

export function Design1Client({ scenes, galleries, images }: Design1ClientProps) {
  const heroScene = scenes[0];
  const recentScenes = scenes.slice(1);

  return (
    <div className="min-h-screen bg-bg text-text-primary pb-24">
      {/* Hero Section */}
      {heroScene && (
        <div className="relative w-full h-[70vh] min-h-[500px] max-h-[800px] overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0">
            <img
              src={toApiUrl(heroScene.cardThumbnailPath || heroScene.thumbnailPath) || ""}
              alt={heroScene.title}
              className="w-full h-full object-cover"
            />
            {/* Cinematic Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/40 to-transparent" />
          </div>

          {/* Hero Content */}
          <div className="absolute bottom-0 left-0 w-full p-8 md:p-16 flex flex-col justify-end">
            <div className="max-w-3xl space-y-4">
              <div className="flex items-center gap-3 text-accent-500 font-mono text-sm tracking-widest uppercase">
                <span className="flex items-center gap-1">
                  <Film className="w-4 h-4" />
                  Featured
                </span>
                {heroScene.durationFormatted && (
                  <>
                    <span className="text-text-muted">•</span>
                    <span>{heroScene.durationFormatted}</span>
                  </>
                )}
              </div>
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white drop-shadow-lg">
                {heroScene.title}
              </h1>
              {heroScene.details && (
                <p className="text-lg text-text-secondary line-clamp-2 max-w-2xl drop-shadow-md">
                  {heroScene.details}
                </p>
              )}
              <div className="pt-4 flex items-center gap-4">
                <Link
                  href={`/scenes/${heroScene.id}`}
                  className="flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-accent-950 px-8 py-3 font-semibold transition-all duration-normal hover:shadow-[0_0_24px_rgba(196,154,90,0.4)]"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Play Now
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Horizontal Rows */}
      <div className="space-y-12 mt-12 px-4 md:px-8">
        {/* Scenes Row */}
        {recentScenes.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Film className="w-5 h-5 text-accent-500" />
              Recent Videos
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide">
              {recentScenes.map((scene) => (
                <Link
                  key={scene.id}
                  href={`/scenes/${scene.id}`}
                  className="group relative flex-none w-72 md:w-80 aspect-video snap-start overflow-hidden bg-surface-2 border border-border-subtle hover:border-accent-strong transition-all duration-normal"
                >
                  <img
                    src={toApiUrl(scene.cardThumbnailPath || scene.thumbnailPath) || ""}
                    alt={scene.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-slow"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-normal" />
                  <div className="absolute bottom-0 left-0 w-full p-4">
                    <h3 className="text-sm font-medium text-white truncate">{scene.title}</h3>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-text-muted">{scene.durationFormatted}</span>
                      {scene.resolution && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-black/50 text-accent-300 border border-accent-500/30">
                          {scene.resolution}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Galleries Row */}
        {galleries.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-accent-500" />
              Recent Galleries
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide">
              {galleries.map((gallery) => (
                <Link
                  key={gallery.id}
                  href={`/galleries/${gallery.id}`}
                  className="group relative flex-none w-48 md:w-56 aspect-[3/4] snap-start overflow-hidden bg-surface-2 border border-border-subtle hover:border-accent-strong transition-all duration-normal"
                >
                  <img
                    src={toApiUrl(gallery.coverImagePath) || ""}
                    alt={gallery.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-slow"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-normal" />
                  <div className="absolute bottom-0 left-0 w-full p-4">
                    <h3 className="text-sm font-medium text-white line-clamp-2">{gallery.title}</h3>
                    <span className="text-xs text-text-muted mt-1 block">{gallery.imageCount} images</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Images Row */}
        {images.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-accent-500" />
              Recent Images
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide">
              {images.map((image) => (
                <Link
                  key={image.id}
                  href={`/images/${image.id}`}
                  className="group relative flex-none w-64 md:w-72 aspect-square snap-start overflow-hidden bg-surface-2 border border-border-subtle hover:border-accent-strong transition-all duration-normal"
                >
                  <img
                    src={toApiUrl(image.thumbnailPath) || ""}
                    alt={image.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-slow"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-normal flex items-center justify-center">
                    <span className="text-sm font-medium text-white px-3 py-1 bg-black/50 backdrop-blur-md border border-white/20">
                      View Image
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
