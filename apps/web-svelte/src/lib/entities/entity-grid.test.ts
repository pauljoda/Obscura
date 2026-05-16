import { describe, expect, it } from "vitest";
import type { EntityCapability, EntityCard } from "$lib/api/generated/model";
import {
  ENTITY_GRID_ALL_KINDS,
  applyEntityGridState,
  buildCapabilityFilterOptions,
  buildEntityKindTabs,
  entityCardToThumbnailCard,
  entityGridRequestFromState,
} from "./entity-grid";

function flags(isNsfw = false): EntityCapability {
  return {
    kind: "flags",
    isFavorite: true,
    isNsfw,
    isOrganized: true,
  };
}

function rating(value: number): EntityCapability {
  return {
    kind: "rating",
    value: { value },
  };
}

function image(): EntityCapability {
  return {
    kind: "images",
    supportedKinds: ["cover", "preview"],
    thumbnailUrl: "/cover.jpg",
    coverUrl: "/cover.jpg",
    items: [
      { kind: "cover", path: "/cover.jpg", mimeType: "image/jpeg" },
      { kind: "preview", path: "/preview.jpg", mimeType: "image/jpeg" },
    ],
  };
}

function stats(): EntityCapability {
  return {
    kind: "stats",
    items: [{ code: "images", value: 12 }],
  };
}

function technical(): EntityCapability {
  return {
    kind: "technical",
    duration: "00:02:30",
    width: 1920,
    height: 1080,
    frameRate: null,
    bitRate: null,
    sampleRate: null,
    channels: null,
    codec: "h264",
    container: null,
    format: null,
  };
}

function position(items: { code: string; value: number; label?: string | null }[]): EntityCapability {
  return {
    kind: "position",
    items: items.map((item) => ({ ...item, label: item.label ?? null })),
  };
}

function card(id: string, kind: string, title: string, capabilities: EntityCapability[]): EntityCard {
  return { id, kind, title, capabilities };
}

describe("entity grid helpers", () => {
  const cards = [
    entityCardToThumbnailCard(card("1", "video", "Safe Video", [flags(false), rating(5), image(), technical()])),
    entityCardToThumbnailCard(card("2", "gallery", "Hidden Gallery", [flags(true), rating(2), image(), stats()])),
    entityCardToThumbnailCard(card("3", "book", "Safe Book", [flags(false), image(), stats()])),
  ];

  it("builds tabs from mixed entity kinds", () => {
    expect(buildEntityKindTabs(cards)).toEqual([
      { kind: "book", label: "Books", count: 1 },
      { kind: "gallery", label: "Galleries", count: 1 },
      { kind: "video", label: "Videos", count: 1 },
    ]);
  });

  it("builds tabs from SFW-visible cards only", () => {
    expect(buildEntityKindTabs(cards, { includeNsfw: false })).toEqual([
      { kind: "book", label: "Books", count: 1 },
      { kind: "video", label: "Videos", count: 1 },
    ]);
  });

  it("derives capability filters from returned entities", () => {
    const options = buildCapabilityFilterOptions(cards);

    expect(options.map((option) => option.id)).toContain("rating:4");
    expect(options.map((option) => option.id)).toContain("images:preview");
    expect(options.map((option) => option.id)).toContain("stats:images");
    expect(options.map((option) => option.id)).toContain("technical:codec:h264");
  });

  it("filters NSFW cards before applying tabs and capability filters", () => {
    const options = buildCapabilityFilterOptions(cards);
    const visible = applyEntityGridState(cards, {
      activeKind: ENTITY_GRID_ALL_KINDS,
      filterIds: ["rating:4"],
      includeNsfw: false,
      query: "safe",
      sortBy: "title",
      sortDir: "asc",
    }, options);

    expect(visible.map((item) => item.entity.id)).toEqual(["1"]);
  });

  it("serializes request state for backend filtering", () => {
    const options = buildCapabilityFilterOptions(cards);
    const request = entityGridRequestFromState({
      activeKind: "video",
      filterIds: ["rating:4", "technical:duration"],
      includeNsfw: false,
      query: "bunny",
      sortBy: "rating",
      sortDir: "desc",
    }, options);

    expect(request).toMatchObject({
      kind: "video",
      query: "bunny",
      sortBy: "rating",
      sortDir: "desc",
    });
    expect("includeNsfw" in request).toBe(false);
    expect(request.filters.map((filter) => filter.id)).toEqual(["rating:4", "technical:duration"]);
  });

  it("maps video season and episode numbers into the bottom-left custom slot", () => {
    const thumbnail = entityCardToThumbnailCard(card("4", "video", "Episode", [
      flags(false),
      technical(),
      position([
        { code: "season", value: 1 },
        { code: "episode", value: 2 },
      ]),
    ]));

    expect(thumbnail.custom?.bottomLeft).toEqual({
      label: "S1 E2",
      title: "Season 1, Episode 2",
    });
    expect(thumbnail.meta?.map((item) => item.label)).not.toContain("season 1");
  });

  it("uses cover fit for entity thumbnail images by default", () => {
    const thumbnail = entityCardToThumbnailCard(card("6", "person", "Performer", [
      flags(false),
      image(),
    ]));

    expect(thumbnail.fit).toBe("cover");
  });

  it("maps Jellyfin image-playlist trickplay assets into sprite hover data", () => {
    const thumbnail = entityCardToThumbnailCard(card("5", "video", "Tiled Trickplay", [
      {
        kind: "images",
        supportedKinds: ["thumbnail", "trickplay"],
        thumbnailUrl: "/assets/videos/5/thumb.jpg",
        coverUrl: "/assets/videos/5/thumb.jpg",
        items: [
          { kind: "thumbnail", path: "/assets/videos/5/thumb.jpg", mimeType: "image/jpeg" },
          { kind: "trickplay", path: "/Videos/5/Trickplay/320/tiles.m3u8", mimeType: "application/vnd.apple.mpegurl" },
        ],
      },
    ]));

    expect(thumbnail.hover).toEqual({
      kind: "sprite",
      vttUrl: "/Videos/5/Trickplay/320/tiles.m3u8",
    });
  });
});
