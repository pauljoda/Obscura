"use client";

import { useState } from "react";
import { VideoPlayer } from "./video-player";
import { Badge, Button, StatusLed } from "@obscura/ui";
import {
  Star,
  Clock,
  Monitor,
  HardDrive,
  Calendar,
  Bookmark,
  FileVideo,
  Link2,
} from "lucide-react";
import { cn } from "@obscura/ui";

// Placeholder scene data
const mockScene = {
  title: "Scene_2024_0142.mp4",
  studio: "Studio Alpha",
  date: "2024-06-15",
  duration: "24:30",
  resolution: "3840x2160",
  codec: "H.265 / AAC",
  fileSize: "4.2 GB",
  bitrate: "24,000 kbps",
  framerate: "60 fps",
  performers: [
    { name: "Performer A", sceneCount: 12 },
    { name: "Performer B", sceneCount: 8 },
  ],
  tags: ["tag-one", "tag-two", "tag-three", "tag-four"],
  markers: [
    { id: "1", time: 120, title: "Chapter 1", tag: "intro" },
    { id: "2", time: 480, title: "Chapter 2", tag: "main" },
    { id: "3", time: 1020, title: "Chapter 3", tag: "climax" },
  ],
};

const tabs = ["Details", "Markers", "Files", "Related"] as const;
type Tab = (typeof tabs)[number];

export function SceneDetail({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("Details");
  const scene = mockScene;

  return (
    <div className="space-y-5">
      {/* Video Player */}
      <VideoPlayer markers={scene.markers} />

      {/* Scene header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1>{scene.title}</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-text-muted">
            {scene.studio && <span>{scene.studio}</span>}
            <span className="text-text-disabled">·</span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {scene.date}
            </span>
            <span className="text-text-disabled">·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {scene.duration}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Bookmark className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 text-accent-500">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn("h-4 w-4", i < 3 ? "fill-current" : "text-text-disabled")}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="separator" />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border-subtle">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors duration-fast relative",
              activeTab === tab
                ? "text-text-accent"
                : "text-text-muted hover:text-text-primary"
            )}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-accent-500" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "Details" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Metadata */}
          <div className="lg:col-span-2 space-y-5">
            {/* Performers */}
            <section>
              <h4 className="text-kicker mb-3">Performers</h4>
              <div className="flex flex-wrap gap-2">
                {scene.performers.map((p) => (
                  <div
                    key={p.name}
                    className="surface-card flex items-center gap-3 p-3 hover:border-border-accent"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-3 text-sm font-medium text-text-muted">
                      {p.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-text-muted">
                        {p.sceneCount} scenes
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Tags */}
            <section>
              <h4 className="text-kicker mb-3">Tags</h4>
              <div className="flex flex-wrap gap-1.5">
                {scene.tags.map((tag) => (
                  <Badge key={tag} variant="default">
                    {tag}
                  </Badge>
                ))}
              </div>
            </section>
          </div>

          {/* File info sidebar */}
          <div className="surface-panel p-4 space-y-3 h-fit">
            <h4 className="text-kicker">File Information</h4>
            <div className="space-y-2.5">
              {[
                { icon: Monitor, label: "Resolution", value: scene.resolution },
                { icon: FileVideo, label: "Codec", value: scene.codec },
                { icon: HardDrive, label: "Size", value: scene.fileSize },
                { icon: Link2, label: "Bitrate", value: scene.bitrate },
                { icon: Monitor, label: "Framerate", value: scene.framerate },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-text-muted text-xs">
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </span>
                  <span className="text-mono-sm">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "Markers" && (
        <div className="space-y-2">
          {scene.markers.length === 0 ? (
            <div className="surface-well p-8 text-center">
              <Bookmark className="h-8 w-8 text-text-disabled mx-auto mb-2" />
              <p className="text-text-muted text-sm">No markers yet</p>
            </div>
          ) : (
            scene.markers.map((marker) => (
              <div
                key={marker.id}
                className="surface-card flex items-center gap-4 p-3 cursor-pointer"
              >
                <span className="text-mono-tabular text-accent-400 w-16">
                  {Math.floor(marker.time / 60)}:
                  {String(marker.time % 60).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{marker.title}</p>
                  {marker.tag && (
                    <Badge variant="default" className="mt-1">
                      {marker.tag}
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "Files" && (
        <div className="surface-well p-4">
          <div className="space-y-2 text-mono-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Path</span>
              <span>/media/library/{scene.title}</span>
            </div>
            <div className="separator" />
            <div className="flex justify-between">
              <span className="text-text-muted">Size</span>
              <span>{scene.fileSize}</span>
            </div>
            <div className="separator" />
            <div className="flex justify-between">
              <span className="text-text-muted">Codec</span>
              <span>{scene.codec}</span>
            </div>
            <div className="separator" />
            <div className="flex justify-between">
              <span className="text-text-muted">Fingerprint</span>
              <span className="text-text-muted">Not computed</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === "Related" && (
        <div className="surface-well p-8 text-center">
          <p className="text-text-muted text-sm">
            Related scenes will appear once the library is populated.
          </p>
        </div>
      )}
    </div>
  );
}
