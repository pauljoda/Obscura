"use client";

import { MediaCard } from "@obscura/ui";
import { Film } from "lucide-react";

// Placeholder scenes for UI development
const placeholderScenes = [
  {
    title: "Scene_2024_0142.mp4",
    duration: "24:30",
    resolution: "4K",
    studio: "Studio Alpha",
    performers: ["Performer A", "Performer B"],
    tags: ["tag-one", "tag-two", "tag-three"],
  },
  {
    title: "Scene_2024_0089.mp4",
    duration: "18:45",
    resolution: "1080p",
    studio: "Studio Beta",
    performers: ["Performer C"],
    tags: ["tag-one", "tag-four"],
  },
  {
    title: "Scene_2023_0421.mp4",
    duration: "32:10",
    resolution: "4K",
    performers: ["Performer A", "Performer D", "Performer E"],
    tags: ["tag-two", "tag-five", "tag-six", "tag-seven"],
  },
  {
    title: "Scene_2024_0203.mp4",
    duration: "12:55",
    resolution: "1080p",
    studio: "Studio Gamma",
    tags: ["tag-three"],
  },
  {
    title: "Scene_2023_0299.mp4",
    duration: "45:20",
    resolution: "4K",
    studio: "Studio Alpha",
    performers: ["Performer B", "Performer F"],
    tags: ["tag-one", "tag-eight"],
  },
  {
    title: "Scene_2024_0067.mp4",
    duration: "21:15",
    resolution: "720p",
    performers: ["Performer G"],
    tags: ["tag-two", "tag-nine", "tag-ten", "tag-eleven"],
  },
  {
    title: "Scene_2023_0188.mp4",
    duration: "28:40",
    resolution: "1080p",
    studio: "Studio Delta",
    performers: ["Performer H", "Performer I"],
    tags: ["tag-four", "tag-five"],
  },
  {
    title: "Scene_2024_0311.mp4",
    duration: "16:30",
    resolution: "4K",
    studio: "Studio Beta",
    performers: ["Performer C", "Performer J"],
    tags: ["tag-six"],
  },
];

export function SceneGrid() {
  if (placeholderScenes.length === 0) {
    return (
      <div className="surface-well flex flex-col items-center justify-center py-16">
        <Film className="h-12 w-12 text-text-disabled mb-3" />
        <p className="text-text-muted text-sm">No scenes in the library yet.</p>
        <p className="text-text-disabled text-xs mt-1">
          Configure library roots in Settings to begin scanning.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {placeholderScenes.map((scene, i) => (
        <MediaCard key={i} {...scene} />
      ))}
    </div>
  );
}
