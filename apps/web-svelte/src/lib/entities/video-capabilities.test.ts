import { describe, expect, it } from "vitest";
import type { EntityCapability } from "$lib/api/generated/model";
import { getPlaybackState } from "./video-capabilities";

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
