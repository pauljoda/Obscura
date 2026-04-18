import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "../packages/db/src/schema.ts";
import { createApiTestContext } from "./support/api.ts";
import { cleanupTempDir, createTempDir } from "./support/files.ts";

const {
  libraryRoots,
  performers,
  videoSeries,
  videoSeasons,
  videoEpisodes,
  videoMovies,
  videoSeriesPerformers,
  videoEpisodePerformers,
  videoMoviePerformers,
} = schema;

describe("API integration — performer roles", () => {
  let context: Awaited<ReturnType<typeof createApiTestContext>>;
  let mediaDir: string;

  beforeAll(async () => {
    mediaDir = await createTempDir("obscura-performer-roles-media-");
    process.env.OBSCURA_CACHE_DIR = await createTempDir("obscura-performer-roles-cache-");
    process.env.CHANGELOG_PATH = "CHANGELOG.md";
    context = await createApiTestContext();
  });

  afterAll(async () => {
    await context.close();
    await cleanupTempDir(mediaDir);
    await cleanupTempDir(process.env.OBSCURA_CACHE_DIR!);
    delete process.env.OBSCURA_CACHE_DIR;
    delete process.env.CHANGELOG_PATH;
  });

  it("returns merged episode cast with episode overrides and series fallback", async () => {
    const [root] = await context.db
      .insert(libraryRoots)
      .values({ path: `${mediaDir}/episode-role-root`, label: "Episode Role Root" })
      .returning();

    const [series] = await context.db
      .insert(videoSeries)
      .values({
        libraryRootId: root.id,
        folderPath: `${mediaDir}/episode-role-root/My Show`,
        relativePath: "My Show",
        title: "My Show",
      })
      .returning();

    const [season] = await context.db
      .insert(videoSeasons)
      .values({ seriesId: series.id, seasonNumber: 1 })
      .returning();

    const [episode] = await context.db
      .insert(videoEpisodes)
      .values({
        seriesId: series.id,
        seasonId: season.id,
        seasonNumber: 1,
        episodeNumber: 2,
        title: "Second Wave",
        filePath: `${mediaDir}/episode-role-root/My Show/S01E02.mp4`,
      })
      .returning();

    const [lead, fallback, guest] = await context.db
      .insert(performers)
      .values([
        { name: "Alex Lead" },
        { name: "Taylor Support" },
        { name: "Morgan Guest" },
      ])
      .returning();

    await context.db.insert(videoSeriesPerformers).values([
      {
        seriesId: series.id,
        performerId: lead.id,
        character: "Captain Vale",
        order: 1,
      },
      {
        seriesId: series.id,
        performerId: fallback.id,
        character: "Dr. Nera",
        order: 2,
      },
    ]);

    await context.db.insert(videoEpisodePerformers).values([
      {
        episodeId: episode.id,
        performerId: lead.id,
        character: "Captain Vale (Mirror)",
        order: 1,
      },
      {
        episodeId: episode.id,
        performerId: guest.id,
        character: "Archivist Renn",
        order: 3,
      },
    ]);

    const response = await context.app.inject({
      method: "GET",
      url: `/videos/${episode.id}`,
    });

    expect(response.statusCode).toBe(200);

    const body = response.json() as {
      performers: Array<{
        id: string;
        name: string;
        character?: string | null;
        roleSource?: string | null;
      }>;
    };

    expect(body.performers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: lead.id,
          name: "Alex Lead",
          character: "Captain Vale (Mirror)",
          roleSource: "episode",
        }),
        expect.objectContaining({
          id: fallback.id,
          name: "Taylor Support",
          character: "Dr. Nera",
          roleSource: "series",
        }),
        expect.objectContaining({
          id: guest.id,
          name: "Morgan Guest",
          character: "Archivist Renn",
          roleSource: "episode",
        }),
      ]),
    );
  });

  it("returns series cast characters and performer Known For entries without duplicate same-role episodes", async () => {
    const [root] = await context.db
      .insert(libraryRoots)
      .values({ path: `${mediaDir}/known-for-root`, label: "Known For Root" })
      .returning();

    const [series] = await context.db
      .insert(videoSeries)
      .values({
        libraryRootId: root.id,
        folderPath: `${mediaDir}/known-for-root/Signal Station`,
        relativePath: "Signal Station",
        title: "Signal Station",
      })
      .returning();

    const [season] = await context.db
      .insert(videoSeasons)
      .values({ seriesId: series.id, seasonNumber: 1 })
      .returning();

    const [episodeSameRole, episodeDifferentRole] = await context.db
      .insert(videoEpisodes)
      .values([
        {
          seriesId: series.id,
          seasonId: season.id,
          seasonNumber: 1,
          episodeNumber: 1,
          title: "Pilot",
          filePath: `${mediaDir}/known-for-root/Signal Station/S01E01.mp4`,
        },
        {
          seriesId: series.id,
          seasonId: season.id,
          seasonNumber: 1,
          episodeNumber: 7,
          title: "The Double",
          filePath: `${mediaDir}/known-for-root/Signal Station/S01E07.mp4`,
        },
      ])
      .returning();

    const [movie] = await context.db
      .insert(videoMovies)
      .values({
        libraryRootId: root.id,
        title: "Neon Harbor",
        filePath: `${mediaDir}/known-for-root/Neon Harbor.mp4`,
      })
      .returning();

    const [lead, support] = await context.db
      .insert(performers)
      .values([{ name: "Rin North" }, { name: "Jules South" }])
      .returning();

    await context.db.insert(videoSeriesPerformers).values([
      {
        seriesId: series.id,
        performerId: lead.id,
        character: "Commander Sol",
        order: 1,
      },
      {
        seriesId: series.id,
        performerId: support.id,
        character: "Engineer Pax",
        order: 2,
      },
    ]);

    await context.db.insert(videoEpisodePerformers).values([
      {
        episodeId: episodeSameRole.id,
        performerId: support.id,
        character: "Engineer Pax",
        order: 2,
      },
      {
        episodeId: episodeDifferentRole.id,
        performerId: lead.id,
        character: "Shade Copy",
        order: 1,
      },
    ]);

    await context.db.insert(videoMoviePerformers).values({
      movieId: movie.id,
      performerId: lead.id,
      character: "Detective Quill",
      order: 1,
    });

    const seriesResponse = await context.app.inject({
      method: "GET",
      url: `/video-series/${series.id}`,
    });

    expect(seriesResponse.statusCode).toBe(200);

    const seriesBody = seriesResponse.json() as {
      performers: Array<{
        id: string;
        name: string;
        character?: string | null;
      }>;
    };

    expect(seriesBody.performers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: lead.id,
          name: "Rin North",
          character: "Commander Sol",
        }),
        expect.objectContaining({
          id: support.id,
          name: "Jules South",
          character: "Engineer Pax",
        }),
      ]),
    );

    const leadResponse = await context.app.inject({
      method: "GET",
      url: `/performers/${lead.id}`,
    });

    expect(leadResponse.statusCode).toBe(200);

    const leadBody = leadResponse.json() as {
      knownFor?: Array<{
        sourceType: string;
        sourceTitle: string;
        character: string | null;
        seriesTitle?: string | null;
        seasonNumber?: number | null;
        episodeNumber?: number | null;
      }>;
    };

    expect(leadBody.knownFor).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "series",
          sourceTitle: "Signal Station",
          character: "Commander Sol",
        }),
        expect.objectContaining({
          sourceType: "movie",
          sourceTitle: "Neon Harbor",
          character: "Detective Quill",
        }),
        expect.objectContaining({
          sourceType: "episode",
          sourceTitle: "The Double",
          seriesTitle: "Signal Station",
          seasonNumber: 1,
          episodeNumber: 7,
          character: "Shade Copy",
        }),
      ]),
    );

    const supportResponse = await context.app.inject({
      method: "GET",
      url: `/performers/${support.id}`,
    });

    expect(supportResponse.statusCode).toBe(200);

    const supportBody = supportResponse.json() as {
      knownFor?: Array<{
        sourceType: string;
        sourceTitle: string;
        character: string | null;
      }>;
    };

    expect(supportBody.knownFor).toEqual([
      expect.objectContaining({
        sourceType: "series",
        sourceTitle: "Signal Station",
        character: "Engineer Pax",
      }),
    ]);
  });
});
