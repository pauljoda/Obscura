import { beforeEach, describe, expect, it, vi } from "vitest";

const { serverFetch } = vi.hoisted(() => ({
  serverFetch: vi.fn(),
}));

const { parseNsfwModeCookie } = vi.hoisted(() => ({
  parseNsfwModeCookie: vi.fn(() => "show"),
}));

vi.mock("$lib/server/core", () => ({
  serverFetch,
}));

vi.mock("$lib/nsfw/cookie", () => ({
  parseNsfwModeCookie,
}));

describe("/studios/[id] page server load", () => {
  beforeEach(() => {
    serverFetch.mockReset();
    parseNsfwModeCookie.mockClear();

    serverFetch.mockImplementation((path: string) => {
      if (path.startsWith("/studios/studio-1")) {
        return Promise.resolve({ id: "studio-1", name: "Studio One" });
      }
      if (path.startsWith("/studios?")) return Promise.resolve({ studios: [] });
      if (path.startsWith("/videos")) return Promise.resolve({ videos: [], total: 0 });
      if (path.startsWith("/video-series")) return Promise.resolve({ items: [], total: 0 });
      if (path.startsWith("/galleries")) return Promise.resolve({ galleries: [], total: 0 });
      if (path.startsWith("/books")) return Promise.resolve({ books: [], total: 0 });
      if (path.startsWith("/images")) return Promise.resolve({ images: [], total: 0 });
      if (path.startsWith("/audio-libraries")) return Promise.resolve({ items: [], total: 0 });
      if (path.startsWith("/audio-tracks")) return Promise.resolve({ items: [], total: 0 });
      throw new Error(`Unexpected path ${path}`);
    });
  });

  it("uses endpoint-native studio filters for related media", async () => {
    const { load } = await import("./+page.server");

    await load({
      params: { id: "studio-1" },
      cookies: { get: vi.fn(() => "show") },
      depends: vi.fn(),
      fetch: vi.fn(),
    } as never);

    const paths = serverFetch.mock.calls.map(([path]) => String(path));

    expect(paths.some((path) => path.startsWith("/galleries?") && path.includes("studio=studio-1"))).toBe(true);
    expect(paths.some((path) => path.startsWith("/books?") && path.includes("studio=studio-1"))).toBe(true);
    expect(paths.some((path) => path.startsWith("/images?") && path.includes("studio=studio-1"))).toBe(true);
    expect(
      paths.some((path) => path.startsWith("/audio-libraries?") && path.includes("studio=Studio+One")),
    ).toBe(true);
    expect(paths.some((path) => path.startsWith("/audio-tracks?") && path.includes("studio=Studio+One"))).toBe(
      true,
    );
  });
});
