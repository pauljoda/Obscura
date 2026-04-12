"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Image as ImageIcon, Film, Layers } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { GalleryListItem, SceneListItem } from "../../lib/api";
import type { ImageListItemDto } from "@obscura/contracts";
import { toApiUrl } from "../../lib/api";

import { SceneCard } from "../scenes/scene-card";
import { sceneListItemToCardData } from "../scenes/scene-card-data";
import { GalleryEntityCard } from "../galleries/gallery-entity-card";
import { galleryListItemToCardData } from "../galleries/gallery-card-data";
import { ImageEntityCard } from "../images/image-entity-card";
import { imageItemToCardData } from "../images/image-card-data";

interface DashboardPageClientProps {
  scenes: SceneListItem[];
  galleries: GalleryListItem[];
  images: ImageListItemDto[];
}

export function DashboardPageClient({ scenes, galleries, images }: DashboardPageClientProps) {
  const featuredScenes = scenes.slice(0, 5);
  const recentScenes = scenes.slice(5);

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (featuredScenes.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredScenes.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [featuredScenes.length, currentIndex]);

  return (
    <div className="min-h-screen bg-bg text-text-primary pb-24">
      {/* Hero Section */}
      {featuredScenes.length > 0 && (
        <div className="relative w-full h-[70vh] min-h-[500px] max-h-[800px] overflow-hidden bg-surface-1">
          {/* Background Images with Crossfade and Ken Burns */}
          {featuredScenes.map((scene, index) => {
            const isActive = index === currentIndex;
            return (
              <div
                key={scene.id}
                className={cn(
                  "absolute inset-0 transition-opacity duration-[1500ms] ease-in-out",
                  isActive ? "opacity-100 z-10" : "opacity-0 z-0"
                )}
              >
                <img
                  src={toApiUrl(scene.cardThumbnailPath || scene.thumbnailPath) || ""}
                  alt={scene.title}
                  className={cn(
                    "w-full h-full object-cover transform-gpu transition-transform duration-[10000ms] ease-out",
                    isActive ? "scale-105" : "scale-100"
                  )}
                />
              </div>
            );
          })}

          {/* Cinematic Gradient Overlay */}
          <div className="absolute inset-0 z-20 bg-gradient-to-t from-bg via-bg/60 to-transparent" />
          <div className="absolute inset-0 z-20 bg-gradient-to-r from-bg via-bg/40 to-transparent" />

          {/* Hero Content */}
          <div className="absolute bottom-0 left-0 w-full p-8 md:p-16 z-30 flex flex-col justify-end">
            <div className="max-w-3xl grid [grid-template-areas:'stack']">
              {featuredScenes.map((scene, index) => {
                const isActive = index === currentIndex;
                return (
                  <div
                    key={`info-${scene.id}`}
                    className={cn(
                      "[grid-area:stack] transition-all duration-normal flex flex-col justify-end",
                      isActive ? "opacity-100 translate-y-0 pointer-events-auto z-10" : "opacity-0 translate-y-4 pointer-events-none z-0"
                    )}
                  >
                    <div className="flex items-center gap-3 text-accent-500 font-mono text-sm tracking-widest uppercase mb-4">
                      <span className="flex items-center gap-1">
                        <Film className="w-4 h-4" />
                        Featured
                      </span>
                      {scene.durationFormatted && (
                        <>
                          <span className="text-text-muted">•</span>
                          <span>{scene.durationFormatted}</span>
                        </>
                      )}
                      {scene.resolution && (
                        <>
                          <span className="text-text-muted">•</span>
                          <span>{scene.resolution}</span>
                        </>
                      )}
                    </div>
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white drop-shadow-lg line-clamp-2">
                      {scene.title}
                    </h1>
                    {scene.details && (
                      <p className="text-lg text-text-secondary line-clamp-2 max-w-2xl drop-shadow-md mt-4">
                        {scene.details}
                      </p>
                    )}
                    <div className="pt-6 flex items-center gap-4">
                      <Link
                        href={`/scenes/${scene.id}`}
                        className="flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-accent-950 px-8 py-3 font-semibold transition-all duration-normal hover:shadow-[0_0_24px_rgba(196,154,90,0.4)]"
                      >
                        <Play className="w-5 h-5 fill-current" />
                        Play Now
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Hero Indicators */}
            {featuredScenes.length > 1 && (
              <div className="absolute bottom-8 right-8 md:bottom-16 md:right-16 flex items-center gap-1">
                {featuredScenes.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className="p-2 group"
                    aria-label={`Go to slide ${index + 1}`}
                  >
                    <div
                      className={cn(
                        "h-1 transition-all duration-normal rounded-none",
                        index === currentIndex
                          ? "w-8 bg-accent-500 shadow-[0_0_8px_rgba(196,154,90,0.6)]"
                          : "w-4 bg-white/30 group-hover:bg-white/50"
                      )}
                    />
                  </button>
                ))}
              </div>
            )}
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
              {recentScenes.map((scene, i) => (
                <div key={scene.id} className="flex-none w-72 md:w-80 snap-start">
                  <SceneCard
                    scene={sceneListItemToCardData(scene, "/")}
                    variant="grid"
                    index={i}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Galleries Row */}
        {galleries.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Layers className="w-5 h-5 text-accent-500" />
              Recent Galleries
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide">
              {galleries.map((gallery) => (
                <div key={gallery.id} className="flex-none w-48 md:w-56 snap-start">
                  <GalleryEntityCard
                    gallery={galleryListItemToCardData(gallery, "/")}
                    variant="grid"
                    aspectRatio="portrait"
                  />
                </div>
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
                <div key={image.id} className="flex-none w-64 md:w-72 snap-start">
                  <ImageEntityCard
                    image={imageItemToCardData(image, "/")}
                    variant="grid"
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
