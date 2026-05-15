import { describe, expect, it } from "vitest";
import type { EntityCapability } from "$lib/api/generated/model";
import { extractVideoPlayerProps, getPlaybackState } from "./video-capabilities";

describe("getPlaybackState", () => {
  it("maps generated v2 progress capability into playback resume state", () => {
    const capabilities: EntityCapability[] = [
      {
        kind: "progress",
        currentEntityId: "video-1",
        unit: "seconds",
        index: 42,
        total: 120,
        mode: "video",
        completedAt: null,
        updatedAt: "2026-05-15T10:00:00Z",
      },
    ];

    expect(getPlaybackState(capabilities)).toEqual({
      playCount: 0,
      playDurationSeconds: 0,
      resumeSeconds: 42,
      lastPlayedAt: "2026-05-15T10:00:00Z",
      completedAt: null,
    });
  });

  it("ignores non-second progress when deriving video resume position", () => {
    const capabilities: EntityCapability[] = [
      {
        kind: "progress",
        currentEntityId: "chapter-1",
        unit: "page",
        index: 8,
        total: 24,
        mode: "book",
        completedAt: null,
        updatedAt: null,
      },
    ];

    expect(getPlaybackState(capabilities)?.resumeSeconds).toBe(0);
  });
});

describe("extractVideoPlayerProps", () => {
  it("does not expose direct playback for Matroska source files", () => {
    const capabilities: EntityCapability[] = [
      {
        kind: "files",
        items: [
          {
            role: "source",
            path: "/media/show/episode.mkv",
            mimeType: null,
          },
        ],
      },
      {
        kind: "technical",
        duration: "00:01:00",
        width: 1920,
        height: 1080,
        frameRate: 24,
        bitRate: null,
        sampleRate: null,
        channels: null,
        codec: "h264",
        container: "matroska",
        format: null,
      },
    ];

    expect(extractVideoPlayerProps("video-1", capabilities).directSrc).toBe("");
  });

  it("uses v2 subtitle endpoints instead of raw storage paths", () => {
    const capabilities: EntityCapability[] = [
      {
        kind: "subtitles",
        items: [
          {
            id: "track-1",
            language: "eng",
            label: "SDH",
            format: "vtt",
            source: "embedded",
            storagePath: "/tmp/cache/videos/video-1/subtitles/track.vtt",
            sourceFormat: "vtt",
            sourcePath: null,
            isDefault: false,
          },
        ],
      },
    ];

    expect(extractVideoPlayerProps("video-1", capabilities).subtitleTracks[0]).toMatchObject({
      url: "/api/videos/video-1/subtitles/track-1",
      sourceUrl: null,
    });
  });
});
