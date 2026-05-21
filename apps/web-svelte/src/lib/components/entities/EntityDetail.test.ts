import { fireEvent, render, screen } from "@testing-library/svelte";
import { FileText } from "@lucide/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it, vi } from "vitest";
import type { EntityDetailCard, EntityDetailCardFull } from "$lib/entities/entity-detail";
import EntityDetail, { type EntityDetailSection } from "./EntityDetail.svelte";

function buildCard(): EntityDetailCard {
  return {
    entity: {
      id: "video-1",
      kind: "video",
      title: "Big Buck Bunny",
      subtitle: null,
      thumbnailUrl: null,
      href: "/videos/video-1",
      parentEntityId: null,
      capabilities: [],
      childrenByKind: [],
    },
    kindLabel: "Video",
    hero: null,
    poster: null,
    description: null,
    rating: { value: 0, max: 5 },
    flags: [
      { code: "favorite", label: "Favorite", active: false },
      { code: "organized", label: "Organized", active: false },
    ],
    tags: [],
    links: [],
    files: [],
    presentCapabilities: [],
  } as EntityDetailCard;
}

describe("EntityDetail", () => {
  it("renders hero action badges below the title and rating", () => {
    const { container } = render(EntityDetail, {
      props: {
        card: buildCard(),
        onFavoriteToggle: () => {},
        onOrganizedToggle: () => {},
        onRatingChange: () => {},
      },
    });

    const heroText = container.querySelector(".hero-text");
    const actionBadges = container.querySelector(".action-badges");
    const ratingRow = container.querySelector(".rating-row");
    const title = screen.getByRole("heading", { name: "Big Buck Bunny" });

    expect(heroText).not.toBeNull();
    expect(actionBadges).not.toBeNull();
    expect(ratingRow).not.toBeNull();

    const heroChildren = Array.from(heroText!.children);

    expect(heroChildren.indexOf(title)).toBeLessThan(heroChildren.indexOf(ratingRow!));
    expect(heroChildren.indexOf(ratingRow!)).toBeLessThan(heroChildren.indexOf(actionBadges!));
  });

  it("renders caller-provided detail tabs with section mappings and custom content", async () => {
    const card = buildCard();
    card.description = "A gentle rabbit adventure.";
    card.tags = [{ id: "tag-animation", kind: "tag", title: "animation", href: "/tags/tag-animation" }];
    card.files = [{ role: "source", path: "/media/bunny.mp4", mimeType: "video/mp4" }];

    render(EntityDetail, {
      props: {
        card,
        tabs: [
          {
            id: "details",
            label: "Details",
            sections: ["description", "tags"],
          },
          {
            id: "files",
            label: "Files",
            count: 1,
            icon: FileText,
            sections: ["custom-files", "files"],
          },
        ],
        sections: [
          {
            id: "custom-files",
            label: "File Notes",
          },
        ],
        sectionContent: createRawSnippet<[EntityDetailSection]>((section) => ({
          render: () => (section().id === "custom-files" ? "<p>File info panel</p>" : ""),
        })),
      },
    });

    expect(screen.getByRole("tablist", { name: "Detail sections" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("A gentle rabbit adventure.")).toBeInTheDocument();
    expect(screen.getByText("animation")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("tab", { name: "Files 1" }));

    expect(screen.getByRole("tab", { name: "Files 1" })).toHaveAttribute("aria-selected", "true");
    expect(document.querySelector("svg.lucide-file-text")).toBeInTheDocument();
    expect(screen.getByText("File info panel")).toBeInTheDocument();
    expect(screen.getByText("/media/bunny.mp4")).toBeInTheDocument();
    expect(screen.queryByText("A gentle rabbit adventure.")).not.toBeInTheDocument();
  });

  it("renders built-in extended metadata sections without route custom content", async () => {
    const card = {
      ...buildCard(),
      studio: { id: "studio-1", kind: "studio", title: "Blender Foundation", thumbnail: null },
      credits: [{ id: "person-1", kind: "person", title: "Sacha Goedegebure", thumbnail: null }],
      stats: [{ code: "views", label: "Views", value: "1842" }],
      dates: [{ code: "release", label: "Release", value: "2008-05-30", sortable: "2008-05-30" }],
      technical: [{ label: "Resolution", value: "1920×1080 (1080p)" }],
      fingerprints: [{ algorithm: "oshash", value: "a1b2c3d4" }],
      markers: [],
      subtitles: [],
      progress: { index: 12, total: 18, percent: 67, unit: "episodes", mode: "watching", completed: false },
      positions: [{ code: "episode", value: 2, label: "Episode 2" }],
      classification: { value: "animation", system: "content-type" },
      sources: [{ code: "stash-import", value: "scene-42" }],
    } satisfies EntityDetailCardFull;

    render(EntityDetail, {
      props: {
        card,
        tabs: [
          {
            id: "metadata",
            label: "Metadata",
            sections: [
              "studio",
              "credits",
              "stats",
              "dates",
              "technical",
              "progress",
              "positions",
              "classification",
              "sources",
              "fingerprints",
            ],
          },
        ],
      },
    });

    expect(screen.getByRole("heading", { name: "Studio" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Blender Foundation" })).toHaveAttribute("href", "/studios/studio-1");
    expect(screen.getByRole("heading", { name: "Credits" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sacha Goedegebure" })).toHaveAttribute("href", "/performers/person-1");
    expect(screen.getByText("Views")).toBeInTheDocument();
    expect(screen.getByText("1842")).toBeInTheDocument();
    expect(screen.getByText("Release")).toBeInTheDocument();
    expect(screen.getByText("2008-05-30")).toBeInTheDocument();
    expect(screen.getByText("Resolution")).toBeInTheDocument();
    expect(screen.getByText("1920×1080 (1080p)")).toBeInTheDocument();
    expect(screen.getByText("watching")).toBeInTheDocument();
    expect(screen.getByText("Episode 2")).toBeInTheDocument();
    expect(screen.getByText("animation")).toBeInTheDocument();
    expect(screen.getByText("stash-import")).toBeInTheDocument();
    expect(screen.getByText("oshash")).toBeInTheDocument();
  });

  it("renders reference sections with non-selectable entity thumbnails", () => {
    const card = {
      ...buildCard(),
      studio: { id: "studio-1", kind: "studio", title: "Blender Foundation", thumbnail: null },
      credits: [{ id: "person-1", kind: "person", title: "Sacha Goedegebure", thumbnail: null }],
      stats: [],
      dates: [],
      technical: [],
      fingerprints: [],
      markers: [],
      subtitles: [],
      progress: null,
      positions: [],
      classification: null,
      sources: [],
    } satisfies EntityDetailCardFull;

    const { container } = render(EntityDetail, {
      props: {
        card,
        tabs: [{ id: "references", label: "References", sections: ["studio", "credits"] }],
      },
    });

    const thumbnails = container.querySelectorAll(".entity-thumbnail");

    expect(thumbnails).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Blender Foundation" })).toHaveAttribute("href", "/studios/studio-1");
    expect(screen.getByRole("link", { name: "Sacha Goedegebure" })).toHaveAttribute("href", "/performers/person-1");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(container.querySelector(".selection")).not.toBeInTheDocument();
  });

  it("renders tags as links to the tag entity", () => {
    const card = buildCard();
    card.tags = [{ id: "tag-comedy", kind: "tag", title: "COMEDY", href: "/tags/tag-comedy" }];

    render(EntityDetail, { props: { card } });

    expect(screen.getByRole("link", { name: "COMEDY" })).toHaveAttribute("href", "/tags/tag-comedy");
  });

  it("edits the active tab sections and saves a scoped metadata patch", async () => {
    const card = buildCard();
    card.description = "Old description";
    const onMetadataSave = vi.fn().mockResolvedValue(undefined);

    render(EntityDetail, {
      props: {
        card,
        tabs: [{ id: "details", label: "Details", sections: ["description"] }],
        onMetadataSave,
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: "Edit Details" }));
    const description = screen.getByLabelText("Description");
    await fireEvent.input(description, { target: { value: "New description" } });
    await fireEvent.click(screen.getByRole("button", { name: "Save Details" }));

    expect(onMetadataSave).toHaveBeenCalledWith({
      fields: ["description"],
      patch: expect.objectContaining({ description: "New description" }),
    });
    expect(screen.queryByLabelText("Description")).not.toBeInTheDocument();
  });

  it("blocks dirty tab navigation until the user discards edits", async () => {
    const card = buildCard();
    card.description = "Old description";
    card.links = [{ label: "Site", url: "https://example.test" }];

    render(EntityDetail, {
      props: {
        card,
        tabs: [
          { id: "details", label: "Details", sections: ["description"] },
          { id: "links", label: "Links", sections: ["links"] },
        ],
        onMetadataSave: vi.fn().mockResolvedValue(undefined),
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: "Edit Details" }));
    await fireEvent.input(screen.getByLabelText("Description"), { target: { value: "Unsaved" } });
    await fireEvent.click(screen.getByRole("tab", { name: "Links" }));

    expect(screen.getByRole("dialog", { name: "Discard unsaved edits?" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Details" })).toHaveAttribute("aria-selected", "true");

    await fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(screen.getByRole("tab", { name: "Links" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("dialog", { name: "Discard unsaved edits?" })).not.toBeInTheDocument();
  });

  it("shows inline validation and disables save for invalid editable fields", async () => {
    const card = buildCard();
    card.links = [{ label: "Site", url: "https://example.test" }];

    render(EntityDetail, {
      props: {
        card,
        tabs: [{ id: "links", label: "Links", sections: ["links"] }],
        onMetadataSave: vi.fn().mockResolvedValue(undefined),
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: "Edit Links" }));
    await fireEvent.input(screen.getByRole("textbox", { name: "Links" }), { target: { value: "not-a-url" } });

    expect(screen.getByText("Links must be absolute http or https URLs.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Links" })).toBeDisabled();
  });

  it("edits external IDs separately from URL links", async () => {
    const card = buildCard();
    card.links = [
      { label: "https://example.test", url: "https://example.test" },
      { label: "tmdb: 6515881", url: null, provider: "tmdb" },
    ];
    const onMetadataSave = vi.fn().mockResolvedValue(undefined);

    render(EntityDetail, {
      props: {
        card,
        tabs: [{ id: "links", label: "Links", sections: ["links"] }],
        onMetadataSave,
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: "Edit Links" }));

    expect(screen.queryByText("Links must be absolute http or https URLs.")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Links" })).toHaveValue("https://example.test");
    expect(screen.getByRole("textbox", { name: "External IDs" })).toHaveValue("tmdb=6515881");

    await fireEvent.input(screen.getByRole("textbox", { name: "External IDs" }), {
      target: { value: "tmdb=6515882" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Save Links" }));

    expect(onMetadataSave).toHaveBeenCalledWith({
      fields: ["urls", "externalIds"],
      patch: expect.objectContaining({
        urls: ["https://example.test"],
        externalIds: { tmdb: "6515882" },
      }),
    });
  });
});
