import { describe, expect, it } from "vitest";
import type { EntityMetadataProposal } from "$lib/api/identify";
import {
  buildProposalForApply,
  findRelationshipImage,
  relationshipProposals,
  structuralChildProposals,
} from "./identify-review";

describe("identify review helpers", () => {
  it("separates structural children from related entity proposals", () => {
    const root = proposal("series", "video-series", {
      children: [
        proposal("season-1", "video-season"),
      ],
      relationships: [
        proposal("actor-1", "person", { title: "Series Actor", imageKind: "poster", imageUrl: "https://example.test/actor.jpg" }),
        proposal("studio-1", "studio", { title: "Chair Pictures", imageKind: "logo", imageUrl: "https://example.test/studio.png" }),
      ],
    });

    expect(structuralChildProposals(root).map((child) => child.proposalId)).toEqual(["season-1"]);
    expect(relationshipProposals(root).map((child) => child.proposalId)).toEqual(["actor-1", "studio-1"]);
    expect(findRelationshipImage(root, "person", "Series Actor")).toBe("https://example.test/actor.jpg");
  });

  it("keeps nested cascade selections and relationship proposals in the apply payload", () => {
    const guest = proposal("guest", "person", {
      title: "Guest Actor",
      imageKind: "poster",
      imageUrl: "https://example.test/guest.jpg",
    });
    const episode = proposal("episode-2", "video", {
      title: "The Chair Company S01E02",
      credits: [{ name: "Guest Actor", role: "guest", character: "Visitor", sortOrder: 0 }],
      relationships: [guest],
    });
    const season = proposal("season-1", "video-season", {
      title: "Season 1",
      children: [episode],
    });
    const root = proposal("chair", "video-series", {
      title: "The Chair Company",
      children: [season],
    });

    const payload = buildProposalForApply(root, {
      selectedFieldsByProposal: {
        chair: { title: true, credits: false, images: true },
        "season-1": { title: true, credits: false, images: true },
        "episode-2": { title: true, credits: true, images: true },
      },
      selectedImagesByProposal: {},
      selectedCreditsByProposal: {
        "episode-2": { "guest:Guest Actor:Visitor:0": true },
      },
      selectedTagsByProposal: {},
      selectedCascade: {
        "season-1": true,
        "episode-2": true,
      },
    });

    const payloadSeason = expectSingle(payload.children);
    const payloadEpisode = expectSingle(payloadSeason.children);
    expect(payload.patch.title).toBe("The Chair Company");
    expect(payloadSeason.patch.title).toBe("Season 1");
    expect(payloadEpisode.patch.title).toBe("The Chair Company S01E02");
    expect(payloadEpisode.patch.credits).toEqual([{ name: "Guest Actor", role: "guest", character: "Visitor", sortOrder: 0 }]);
    expect(expectSingle(payloadEpisode.relationships).patch.title).toBe("Guest Actor");
  });
});

function proposal(
  proposalId: string,
  targetKind: string,
  options: {
    title?: string;
    imageKind?: string;
    imageUrl?: string;
    credits?: EntityMetadataProposal["patch"]["credits"];
    children?: EntityMetadataProposal[];
    relationships?: EntityMetadataProposal[];
  } = {},
): EntityMetadataProposal {
  return {
    proposalId,
    provider: "tmdb",
    targetKind,
    confidence: 1,
    matchReason: "test",
    patch: {
      title: options.title ?? null,
      description: null,
      externalIds: {},
      urls: [],
      tags: [],
      studio: null,
      credits: options.credits ?? [],
      dates: {},
      counters: {},
      stats: {},
      positions: {},
      classification: null,
    },
    images: options.imageUrl ? [{ kind: options.imageKind ?? "poster", url: options.imageUrl, source: "tmdb" }] : [],
    children: options.children ?? [],
    relationships: options.relationships ?? [],
    candidates: [],
    targetEntityId: null,
  };
}

function expectSingle<T>(items: T[]): T {
  expect(items).toHaveLength(1);
  return items[0];
}
