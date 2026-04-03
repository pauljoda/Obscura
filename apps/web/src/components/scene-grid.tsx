"use client";

import { MediaCard } from "@obscura/ui";
import { cn } from "@obscura/ui";
import { Film, Play, Clock, HardDrive, Eye } from "lucide-react";
import type { ViewMode } from "./filter-bar";

const gradientClasses = [
  "gradient-thumb-1",
  "gradient-thumb-2",
  "gradient-thumb-3",
  "gradient-thumb-4",
  "gradient-thumb-5",
  "gradient-thumb-6",
  "gradient-thumb-7",
  "gradient-thumb-8",
];

const tagColorMap: Record<string, string> = {
  "Outdoor": "tag-chip-success",
  "Interview": "tag-chip-info",
  "BTS": "tag-chip-warning",
  "Solo": "tag-chip-accent",
  "Group": "tag-chip-error",
  "POV": "tag-chip-info",
  "Cinematic": "tag-chip-accent",
  "Ambient": "tag-chip-success",
  "Documentary": "tag-chip-info",
  "Studio Lit": "tag-chip-warning",
  "Natural Light": "tag-chip-success",
  "Handheld": "tag-chip-default",
  "Steadicam": "tag-chip-accent",
  "Drone": "tag-chip-info",
  "Slow Motion": "tag-chip-warning",
  "Time Lapse": "tag-chip-success",
};

const placeholderScenes = [
  {
    title: "Golden Hour on the Coast",
    duration: "24:30",
    resolution: "4K",
    codec: "HEVC",
    fileSize: "4.2 GB",
    studio: "Meridian Films",
    performers: ["Ava Hart", "Leo Cruz"],
    tags: ["Outdoor", "Cinematic", "Natural Light"],
    views: 142,
  },
  {
    title: "Studio Session Vol. 12",
    duration: "18:45",
    resolution: "4K",
    codec: "H.264",
    fileSize: "3.1 GB",
    studio: "Apex Studios",
    performers: ["Mia Chen"],
    tags: ["Studio Lit", "Solo", "Interview"],
    views: 87,
  },
  {
    title: "Behind the Scenes — Neon",
    duration: "32:10",
    resolution: "1080p",
    codec: "HEVC",
    fileSize: "2.8 GB",
    performers: ["Ava Hart", "Dani Roze", "Kai Voss"],
    tags: ["BTS", "Group", "Ambient"],
    views: 205,
  },
  {
    title: "The Emerald Room",
    duration: "12:55",
    resolution: "4K",
    codec: "ProRes",
    fileSize: "8.4 GB",
    studio: "Velvet Productions",
    tags: ["Cinematic", "Studio Lit"],
    views: 63,
  },
  {
    title: "Coastal Drift — Extended",
    duration: "45:20",
    resolution: "4K",
    codec: "HEVC",
    fileSize: "7.1 GB",
    studio: "Meridian Films",
    performers: ["Leo Cruz", "Nina Soleil"],
    tags: ["Outdoor", "Drone", "Slow Motion"],
    views: 318,
  },
  {
    title: "Midnight Monologue",
    duration: "21:15",
    resolution: "1080p",
    codec: "H.264",
    fileSize: "1.9 GB",
    performers: ["Kai Voss"],
    tags: ["Solo", "POV", "Ambient"],
    views: 156,
  },
  {
    title: "Glass Ceiling",
    duration: "28:40",
    resolution: "4K",
    codec: "HEVC",
    fileSize: "5.3 GB",
    studio: "Obsidian Media",
    performers: ["Dani Roze", "Mia Chen"],
    tags: ["Interview", "Documentary"],
    views: 94,
  },
  {
    title: "Sunset Terrace Session",
    duration: "16:30",
    resolution: "4K",
    codec: "H.264",
    fileSize: "2.7 GB",
    studio: "Apex Studios",
    performers: ["Mia Chen", "Leo Cruz"],
    tags: ["Outdoor", "Natural Light"],
    views: 271,
  },
  {
    title: "Velvet Underground",
    duration: "35:12",
    resolution: "1080p",
    codec: "HEVC",
    fileSize: "3.4 GB",
    studio: "Velvet Productions",
    performers: ["Nina Soleil"],
    tags: ["Solo", "Cinematic", "Ambient"],
    views: 189,
  },
  {
    title: "Signal & Noise",
    duration: "19:48",
    resolution: "4K",
    codec: "ProRes",
    fileSize: "11.2 GB",
    performers: ["Ava Hart", "Kai Voss"],
    tags: ["Documentary", "Handheld"],
    views: 77,
  },
  {
    title: "The Long Take — Part III",
    duration: "52:30",
    resolution: "4K",
    codec: "HEVC",
    fileSize: "9.8 GB",
    studio: "Meridian Films",
    performers: ["Leo Cruz", "Dani Roze", "Nina Soleil"],
    tags: ["Steadicam", "Group", "Cinematic"],
    views: 412,
  },
  {
    title: "Morning Routine",
    duration: "14:22",
    resolution: "1080p",
    codec: "H.264",
    fileSize: "1.2 GB",
    studio: "Obsidian Media",
    performers: ["Mia Chen"],
    tags: ["Solo", "Natural Light", "POV"],
    views: 234,
  },
  {
    title: "Hyperlapse City",
    duration: "8:45",
    resolution: "4K",
    codec: "HEVC",
    fileSize: "1.8 GB",
    tags: ["Time Lapse", "Drone", "Cinematic"],
    views: 567,
  },
  {
    title: "Two-Camera Interview",
    duration: "41:15",
    resolution: "1080p",
    codec: "H.264",
    fileSize: "3.6 GB",
    studio: "Apex Studios",
    performers: ["Ava Hart", "Kai Voss"],
    tags: ["Interview", "Studio Lit"],
    views: 108,
  },
  {
    title: "Desert Bloom",
    duration: "27:33",
    resolution: "4K",
    codec: "HEVC",
    fileSize: "5.0 GB",
    studio: "Meridian Films",
    performers: ["Nina Soleil", "Leo Cruz"],
    tags: ["Outdoor", "Slow Motion", "Cinematic"],
    views: 345,
  },
  {
    title: "Archive Reel 09",
    duration: "11:08",
    resolution: "720p",
    codec: "H.264",
    fileSize: "680 MB",
    tags: ["BTS", "Handheld", "Documentary"],
    views: 42,
  },
];

interface SceneGridProps {
  viewMode: ViewMode;
  searchQuery?: string;
}

export function SceneGrid({ viewMode, searchQuery }: SceneGridProps) {
  const filtered = searchQuery
    ? placeholderScenes.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.studio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.performers?.some((p) =>
            p.toLowerCase().includes(searchQuery.toLowerCase())
          ) ||
          s.tags.some((t) =>
            t.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : placeholderScenes;

  if (filtered.length === 0) {
    return (
      <div className="surface-well flex flex-col items-center justify-center py-16">
        <Film className="h-12 w-12 text-text-disabled mb-3" />
        <p className="text-text-muted text-sm">
          {searchQuery ? "No scenes match your search." : "No scenes in the library yet."}
        </p>
        {!searchQuery && (
          <p className="text-text-disabled text-xs mt-1">
            Configure library roots in Settings to begin scanning.
          </p>
        )}
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <div className="space-y-1">
        {filtered.map((scene, i) => (
          <SceneListItem key={i} scene={scene} index={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
      {filtered.map((scene, i) => (
        <MediaCard
          key={i}
          {...scene}
          gradientClass={gradientClasses[i % gradientClasses.length]}
          tagColors={tagColorMap}
        />
      ))}
    </div>
  );
}

function SceneListItem({
  scene,
  index,
}: {
  scene: (typeof placeholderScenes)[number];
  index: number;
}) {
  return (
    <div className="surface-card-sharp group flex items-center gap-3 px-3 py-2 cursor-pointer">
      {/* Thumbnail */}
      <div
        className={cn(
          "relative w-28 flex-shrink-0 aspect-video rounded-sm overflow-hidden",
          gradientClasses[index % gradientClasses.length]
        )}
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
          <Play className="h-4 w-4 text-white" fill="white" />
        </div>
        {scene.duration && (
          <span className="absolute bottom-0.5 right-0.5 text-[0.55rem] font-mono bg-black/70 text-white/80 px-1 rounded-sm">
            {scene.duration}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <h4 className="truncate text-[0.8rem] font-medium text-text-primary">
            {scene.title}
          </h4>
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
        <div className="flex items-center gap-2 text-[0.7rem] text-text-muted">
          {scene.studio && (
            <span className="text-text-accent">{scene.studio}</span>
          )}
          {scene.studio && scene.performers?.length ? (
            <span className="text-text-disabled">/</span>
          ) : null}
          {scene.performers && (
            <span className="truncate">
              {scene.performers.join(", ")}
            </span>
          )}
        </div>
        {scene.tags.length > 0 && (
          <div className="hidden sm:flex flex-wrap gap-1">
            {scene.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className={cn("tag-chip", tagColorMap[tag] || "tag-chip-default")}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right side stats */}
      <div className="hidden md:flex items-center gap-4 text-[0.65rem] text-text-disabled flex-shrink-0">
        {scene.fileSize && (
          <span className="flex items-center gap-1">
            <HardDrive className="h-3 w-3" />
            {scene.fileSize}
          </span>
        )}
        {scene.views !== undefined && (
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {scene.views}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {scene.duration}
        </span>
      </div>
    </div>
  );
}
