import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IdentifyButton from "./IdentifyButton.svelte";

const { fetchInstalledPlugins } = vi.hoisted(() => ({
  fetchInstalledPlugins: vi.fn(),
}));

vi.mock("$lib/api/scrapers", () => ({
  executePlugin: vi.fn(),
  fetchInstalledPlugins,
}));

vi.mock("$lib/api/videos", () => ({
  fetchVideoSeriesLibraryDetail: vi.fn(),
}));

vi.mock("$lib/hooks/nsfw-aware-providers", () => ({
  filterNsfwAware: <T,>(items: T[]) => items,
}));

describe("IdentifyButton", () => {
  beforeEach(() => {
    fetchInstalledPlugins.mockReset();
    fetchInstalledPlugins.mockResolvedValue([
      {
        id: "plugin-1",
        name: "The Movie Database",
        version: "0.3.1",
        enabled: true,
        isNsfw: false,
        capabilities: { folderByName: true },
      },
    ]);
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("opens its plugin menu as a viewport-positioned flyout", async () => {
    render(IdentifyButton, {
      props: {
        entityKind: "video_series",
        entityId: "series-1",
        title: "Blue's Clues & You!",
        label: "Identify Series",
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: /identify series/i }));

    const plugin = await screen.findByText("The Movie Database");
    const menu = plugin.closest(".surface-elevated");
    expect(menu).toBeInTheDocument();
    expect(menu?.className).toContain("fixed");
    expect(menu).toHaveStyle({
      left: "12px",
      right: "12px",
    });
    expect(menu?.getAttribute("style")).toContain("max-height:");
  });
});
