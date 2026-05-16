import { fireEvent, render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { describe, expect, it } from "vitest";
import type { EntityDetailCard } from "$lib/entities/entity-detail";
import EntityDetail, { type EntityDetailTab } from "./EntityDetail.svelte";

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

  it("renders caller-provided detail tabs with counts and custom content", async () => {
    render(EntityDetail, {
      props: {
        card: buildCard(),
        tabs: [
          {
            id: "markers",
            label: "Markers",
            count: 2,
          },
          {
            id: "files",
            label: "Files",
          },
        ],
        tabContent: createRawSnippet<[EntityDetailTab]>((tab) => ({
          render: () => (
            tab().id === "markers"
              ? "<p>Marker editor panel</p>"
              : "<p>File info panel</p>"
          ),
        })),
      },
    });

    expect(screen.getByRole("tablist", { name: "Detail sections" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Markers 2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Marker editor panel")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("tab", { name: "Files" }));

    expect(screen.getByRole("tab", { name: "Files" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("File info panel")).toBeInTheDocument();
    expect(screen.queryByText("Marker editor panel")).not.toBeInTheDocument();
  });
});
