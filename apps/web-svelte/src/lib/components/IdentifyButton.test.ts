import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import IdentifyButtonHarness from "./IdentifyButton.test-harness.svelte";

const { executePlugin, fetchInstalledPlugins, fetchInstalledScrapers, fetchStashBoxEndpoints } =
  vi.hoisted(() => ({
    executePlugin: vi.fn(),
    fetchInstalledPlugins: vi.fn(),
    fetchInstalledScrapers: vi.fn(),
    fetchStashBoxEndpoints: vi.fn(),
  }));

vi.mock("$lib/api/scrapers", () => ({
  acceptPluginResult: vi.fn(),
  executePlugin,
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
    vi.useRealTimers();
    executePlugin.mockReset();
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

  afterEach(() => {
    vi.useRealTimers();
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

  it("dismisses the provider flyout after a provider is selected", async () => {
    let resolveIdentify: (value: unknown) => void = () => {};
    executePlugin.mockReturnValue(
      new Promise((resolve) => {
        resolveIdentify = resolve;
      }),
    );
    render(IdentifyButtonHarness, {
      props: {
        entityKind: "video_series",
        entityId: "series-1",
        title: "Blue's Clues & You!",
        label: "Identify Series",
      },
    });

    const identifyButton = screen.getByRole("button", { name: /identify series/i });
    await fireEvent.click(identifyButton);

    await fireEvent.click(await screen.findByRole("button", { name: /the movie database/i }));

    await waitFor(() => expect(executePlugin).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("Identify from")).not.toBeInTheDocument());
    expect(identifyButton).toBeDisabled();

    resolveIdentify({ ok: false, result: null });
  });

  it("shows no-result alerts after the provider flyout is dismissed", async () => {
    executePlugin.mockResolvedValue({ ok: false, result: null });
    render(IdentifyButtonHarness, {
      props: {
        entityKind: "video_series",
        entityId: "series-1",
        title: "Blue's Clues & You!",
        label: "Identify Series",
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: /identify series/i }));
    await fireEvent.click(await screen.findByRole("button", { name: /the movie database/i }));

    await waitFor(() => expect(screen.queryByText("Identify from")).not.toBeInTheDocument());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The Movie Database: No result found.");
  });

  it("lets no-result alerts be dismissed without reopening the provider flyout", async () => {
    executePlugin.mockResolvedValue({ ok: false, result: null });
    render(IdentifyButtonHarness, {
      props: {
        entityKind: "video_series",
        entityId: "series-1",
        title: "Blue's Clues & You!",
        label: "Identify Series",
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: /identify series/i }));
    await fireEvent.click(await screen.findByRole("button", { name: /the movie database/i }));

    const alert = await screen.findByRole("alert");
    await fireEvent.click(screen.getByRole("button", { name: /dismiss message/i }));

    expect(alert).not.toBeInTheDocument();
    expect(screen.queryByText("Identify from")).not.toBeInTheDocument();
  });

  it("auto-dismisses no-result alerts after a short timeout", async () => {
    vi.useFakeTimers();
    executePlugin.mockResolvedValue({ ok: false, result: null });
    render(IdentifyButtonHarness, {
      props: {
        entityKind: "video_series",
        entityId: "series-1",
        title: "Blue's Clues & You!",
        label: "Identify Series",
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: /identify series/i }));
    await fireEvent.click(await screen.findByRole("button", { name: /the movie database/i }));

    await screen.findByRole("alert");
    vi.advanceTimersByTime(6_000);

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});
