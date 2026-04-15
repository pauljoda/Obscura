"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Image as ImageIcon, Film, Layers, Music, FolderOpen, Users, Building2 } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { GalleryListItem, SceneListItem, PerformerItem, StudioItem } from "../../lib/api";
import type { ImageListItemDto, AudioLibraryListItemDto, SceneFolderListItemDto } from "@obscura/contracts";
import { toApiUrl } from "../../lib/api";

import { SceneCard } from "../scenes/scene-card";
import { sceneListItemToCardData } from "../scenes/scene-card-data";
import { GalleryEntityCard } from "../galleries/gallery-entity-card";
import { galleryListItemToCardData } from "../galleries/gallery-card-data";
import { ImageEntityCard } from "../images/image-entity-card";
import { imageItemToCardData } from "../images/image-card-data";
import { SceneFolderCard } from "../scene-folders/scene-folder-card";
import { PerformerEntityCard } from "../performers/performer-entity-card";
import { performerItemToCardData } from "../performers/performer-card-data";
import { StudioEntityCard } from "../studios/studio-entity-card";
import { studioItemToCardData } from "../studios/studio-card-data";
import { EntityPreviewMedia } from "../shared/entity-preview-media";
import { NsfwBlur, NsfwShowModeChip } from "../nsfw/nsfw-gate";
import { SCENE_CARD_GRADIENTS } from "../scenes/scene-card-gradients";

interface DashboardPageClientProps {
  scenes: SceneListItem[];
  featuredScenes: SceneListItem[];
  galleries: GalleryListItem[];
  images: ImageListItemDto[];
  audioLibraries: AudioLibraryListItemDto[];
  sceneFolders: SceneFolderListItemDto[];
  performers: PerformerItem[];
  studios: StudioItem[];
}

function AudioLibraryCard({
  library,
  index,
}: {
  library: AudioLibraryListItemDto;
  index: number;
}) {
  const coverUrl = toApiUrl(library.coverImagePath);
  const gradientClass = SCENE_CARD_GRADIENTS[index % SCENE_CARD_GRADIENTS.length];

  return (
    <Link
      href={`/audio/${library.id}`}
      className="group surface-card-sharp overflow-hidden hover:border-border-accent transition-colors block"
    >
      <NsfwBlur isNsfw={library.isNsfw} className="overflow-hidden relative">
        <EntityPreviewMedia
          title={library.title}
          mode="cover-only"
          coverImage={coverUrl}
          className="aspect-square"
          fallback={
            <div className={cn("w-full h-full flex items-center justify-center", gradientClass)}>
              <Music className="h-10 w-10 text-white/20" />
            </div>
          }
        >
          <div className="pointer-events-none absolute bottom-1 right-1 z-10 flex flex-col items-end gap-0.5">
            <NsfwShowModeChip isNsfw={library.isNsfw} />
          </div>
        </EntityPreviewMedia>
      </NsfwBlur>
      <div className="p-2.5">
        <h3 className="text-sm font-medium truncate">{library.title}</h3>
        <p className="text-xs text-text-muted mt-0.5">
          {library.trackCount} track{library.trackCount !== 1 ? "s" : ""}
        </p>
        {library.performers.length > 0 && (
          <p className="text-xs text-text-disabled mt-0.5 truncate">
            {library.performers.map((p) => p.name).join(", ")}
          </p>
        )}
      </div>
    </Link>
  );
}

import { useNsfw } from "../nsfw/nsfw-context";

export function DashboardPageClient({
  scenes: initialRecent,
  featuredScenes: initialFeatured,
  galleries: initialGalleries,
  images: initialImages,
  audioLibraries: initialAudio,
  sceneFolders: initialFolders,
  performers: initialPerformers,
  studios: initialStudios,
}: DashboardPageClientProps) {
  const { mode: nsfwMode } = useNsfw();

  const featuredScenes = initialFeatured.filter(s => nsfwMode === "show" || !s.isNsfw);
  const recentScenes = initialRecent.filter(s => nsfwMode === "show" || !s.isNsfw);
  const galleries = initialGalleries.filter(g => nsfwMode === "show" || !g.isNsfw);
  const images = initialImages.filter(i => nsfwMode === "show" || !i.isNsfw);
  const audioLibraries = initialAudio.filter(a => nsfwMode === "show" || !a.isNsfw);
  const sceneFolders = initialFolders.filter(f => nsfwMode === "show" || !f.isNsfw);
  const performers = initialPerformers.filter(p => nsfwMode === "show" || !p.isNsfw);
  const studios = initialStudios.filter(s => nsfwMode === "show" || !s.isNsfw);

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (featuredScenes.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredScenes.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [featuredScenes.length, currentIndex]);

  const hasAnyContent = 
    featuredScenes.length > 0 || 
    recentScenes.length > 0 || 
    galleries.length > 0 || 
    images.length > 0 || 
    audioLibraries.length > 0 || 
    sceneFolders.length > 0 || 
    performers.length > 0 || 
    studios.length > 0;

  if (!hasAnyContent) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center text-center p-8">
        <div className="w-24 h-24 mb-8 text-accent-500/20 flex items-center justify-center rounded-full bg-surface-2 border border-border-subtle">
          <Film className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-text-primary mb-4">Your Library is Empty</h1>
        <p className="text-text-muted max-w-md mb-8">
          It looks like you haven't added any media yet, or your current filters are hiding everything. 
          Head over to the settings to configure your library roots and start scanning.
        </p>
        <Link
          href="/settings/library"
          className="bg-accent-500 hover:bg-accent-400 text-accent-950 px-6 py-2.5 font-semibold transition-all duration-normal hover:shadow-[0_0_16px_rgba(196,154,90,0.3)]"
        >
          Configure Library
        </Link>
      </div>
    );
  }

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
                      {scene.isNsfw && (
                        <>
                          <span className="text-text-muted">•</span>
                          <NsfwShowModeChip isNsfw={scene.isNsfw} />
                        </>
                      )}
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
                        href={`/videos/${scene.id}`}
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

        {/* Audio Libraries Row */}
        {audioLibraries.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Music className="w-5 h-5 text-accent-500" />
              Recent Audio
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide">
              {audioLibraries.map((library, i) => (
                <div key={library.id} className="flex-none w-48 md:w-56 snap-start">
                  <AudioLibraryCard library={library} index={i} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Series row (video_series) */}
        {sceneFolders.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-accent-500" />
              Recent Series
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide">
              {sceneFolders.map((folder) => (
                <div key={folder.id} className="flex-none w-64 md:w-72 snap-start">
                  <SceneFolderCard folder={folder} href={`/videos?folder=${folder.id}`} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Performers Row */}
        {performers.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Users className="w-5 h-5 text-accent-500" />
              Recent Performers
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide">
              {performers.map((performer) => (
                <div key={performer.id} className="flex-none w-40 md:w-48 snap-start">
                  <PerformerEntityCard
                    performer={performerItemToCardData(performer, "/")}
                    variant="portrait"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Studios Row */}
        {studios.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-accent-500" />
              Studios
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide">
              {studios.map((studio) => (
                <div key={studio.id} className="flex-none w-64 md:w-72 snap-start">
                  <StudioEntityCard
                    studio={studioItemToCardData(studio, "/")}
                    variant="banner"
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
