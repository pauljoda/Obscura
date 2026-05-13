import { render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import LibraryFlagsSection from "./LibraryFlagsSectionV1.svelte";

describe("LibraryFlagsSection", () => {
  it("shows NSFW true and false filters when enabled", () => {
    render(LibraryFlagsSection, {
      props: {
        panelFilters: [],
        onAddFilter: vi.fn(),
        showNsfw: true,
      },
    });

    expect(screen.getByRole("button", { name: "Is NSFW" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not NSFW" })).toBeInTheDocument();
  });
});
