import { fireEvent, render, screen } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import IdentifyButtonHarness from "./IdentifyButton.test-harness.svelte";

const { fetchInstalledPlugins, fetchInstalledScrapers, fetchStashBoxEndpoints } =
  vi.hoisted(() => ({
    fetchInstalledPlugins: vi.fn(),
    fetchInstalledScrapers: vi.fn(),
    fetchStashBoxEndpoints: vi.fn(),
  }));

vi.mock("$lib/api/scrapers", () => ({
  executePlugin: vi.fn(),
  fetchInstalledPlugins,
  fetchInstalledScrapers,
  fetchStashBoxEndpoints,
  identifyViaStashBox: vi.fn(),
  scrapeVideo: vi.fn(),
}));

vi.mock("$lib/api/videos", () => ({
  fetchVideoDetail: vi.fn(),
  fetchVideoSeriesLibraryDetail: vi.fn(),
}));

vi.mock("$lib/nsfw/aware-providers", () => ({
  filterNsfwAware: <T,>(items: T[]) => items,
}));

describe("IdentifyButton", () => {
  beforeEach(() => {
    fetchInstalledPlugins.mockReset();
    fetchInstalledScrapers.mockReset();
    fetchStashBoxEndpoints.mockReset();
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
    fetchInstalledScrapers.mockResolvedValue({ packages: [] });
    fetchStashBoxEndpoints.mockResolvedValue({ endpoints: [] });
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
    render(IdentifyButtonHarness, {
      props: {
        entityKind: "video_series",
        entityId: "series-1",
        title: "Blue's Clues & You!",
        label: "Identify Series",
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: /identify series/i }));

    const plugin = await screen.findByText("The Movie Database");
    const menu = plugin.closest(".player-dropdown");
    expect(menu).toBeInTheDocument();
    expect(menu?.className).toContain("fixed");
    expect(menu).toHaveStyle({
      left: "12px",
      right: "12px",
    });
    expect(menu?.getAttribute("style")).toContain("max-height:");
  });
});
