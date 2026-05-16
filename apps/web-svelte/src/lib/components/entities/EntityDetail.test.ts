import { fireEvent, render, screen } from "@testing-library/svelte";
import { FileText } from "@lucide/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";
import type { EntityDetailCard } from "$lib/entities/entity-detail";
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
      capabilities: [],
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
    card.tags = ["animation"];
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
});
