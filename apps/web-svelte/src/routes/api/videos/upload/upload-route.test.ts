import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getWebDb, uploadVideoEpisodeWrite, uploadVideoMovieWrite, mapAppCoreErrorToJson } =
  vi.hoisted(() => ({
    db: { name: "web-db" },
    getWebDb: vi.fn(),
    uploadVideoEpisodeWrite: vi.fn(),
    uploadVideoMovieWrite: vi.fn(),
    mapAppCoreErrorToJson: vi.fn(),
  }));

vi.mock("$lib/server/db", () => ({
  getWebDb,
}));

vi.mock("$lib/server/error-mapper", () => ({
  mapAppCoreErrorToJson,
}));

vi.mock("@obscura/app-core", () => ({
  uploadVideoEpisodeWrite,
  uploadVideoMovieWrite,
}));

describe("/api/videos/upload route", () => {
  beforeEach(() => {
    getWebDb.mockResolvedValue(db);
    uploadVideoEpisodeWrite.mockReset();
    uploadVideoMovieWrite.mockReset();
    mapAppCoreErrorToJson.mockReset();
  });

  function createFile(contents: string, name: string, type: string) {
    const file = new Blob([contents], { type });
    const bytes = new TextEncoder().encode(contents);
    Object.defineProperty(file, "name", { value: name });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () =>
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
    });
    Object.setPrototypeOf(file, File.prototype);
    return file as File;
  }

  it("rejects requests without a file", async () => {
    const { POST } = await import("./+server");
    const form = new FormData();
    form.set("libraryRootId", "root-1");

    const response = await POST({
      request: {
        formData: async () => form,
      },
    } as never);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "No file uploaded" });
  });

  it("rejects requests with multiple files", async () => {
    const { POST } = await import("./+server");
    const files = [
      createFile("one", "clip-1.mp4", "video/mp4"),
      createFile("two", "clip-2.mp4", "video/mp4"),
    ];

    const response = await POST({
      request: {
        formData: async () =>
          ({
            get: (key: string) => (key === "libraryRootId" ? "root-1" : null),
            getAll: (key: string) => (key === "file" ? files : []),
          }) as FormData,
      },
    } as never);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Only one file per upload request is supported",
    });
  });

  it("routes series uploads to the episode writer", async () => {
    uploadVideoEpisodeWrite.mockResolvedValue({
      id: "video-episode-1",
      title: "Episode Upload",
    });

    const { POST } = await import("./+server");
    const file = createFile("episode-bytes", "episode.mp4", "video/mp4");

    const response = await POST({
      request: {
        formData: async () =>
          ({
            get: (key: string) => (key === "seriesId" ? "series-1" : null),
            getAll: (key: string) => (key === "file" ? [file] : []),
          }) as FormData,
      },
    } as never);

    expect(uploadVideoEpisodeWrite).toHaveBeenCalledWith(
      db,
      "series-1",
      expect.objectContaining({
        filename: "episode.mp4",
        mimetype: "video/mp4",
      }),
    );
    const input = uploadVideoEpisodeWrite.mock.calls[0]?.[2];
    expect(input?.buffer.toString("utf8")).toBe("episode-bytes");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "video-episode-1",
      title: "Episode Upload",
    });
  });

  it("routes root uploads to the movie writer", async () => {
    uploadVideoMovieWrite.mockResolvedValue({
      id: "video-movie-1",
      title: "Movie Upload",
    });

    const { POST } = await import("./+server");
    const file = createFile("movie-bytes", "movie.mp4", "video/mp4");

    const response = await POST({
      request: {
        formData: async () =>
          ({
            get: (key: string) => (key === "libraryRootId" ? "root-1" : null),
            getAll: (key: string) => (key === "file" ? [file] : []),
          }) as FormData,
      },
    } as never);

    expect(uploadVideoMovieWrite).toHaveBeenCalledWith(
      db,
      "root-1",
      expect.objectContaining({
        filename: "movie.mp4",
        mimetype: "video/mp4",
      }),
    );
    const input = uploadVideoMovieWrite.mock.calls[0]?.[2];
    expect(input?.buffer.toString("utf8")).toBe("movie-bytes");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "video-movie-1",
      title: "Movie Upload",
    });
  });
});
