import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../packages/db/src/schema.ts";
import {
  evaluateRuleTree,
  previewRuleTree,
} from "../packages/db/src/lib/collection-rule-engine.ts";
import { createPostgresTestContext } from "./support/postgres.ts";
import type {
  CollectionRuleGroup,
  CollectionRuleCondition,
} from "@obscura/contracts";

const {
  libraryRoots,
  videoSeries,
  videoSeasons,
  videoEpisodes,
  videoMovies,
  videoEpisodeTags,
  videoMovieTags,
  videoMoviePerformers,
  tags,
  performers,
  studios,
} = schema;

function group(
  op: "and" | "or" | "not",
  ...children: (CollectionRuleCondition | CollectionRuleGroup)[]
): CollectionRuleGroup {
  return { type: "group", operator: op, children };
}

function cond(
  field: string,
  operator: CollectionRuleCondition["operator"],
  value: CollectionRuleCondition["value"],
  entityTypes: CollectionRuleCondition["entityTypes"] = [],
): CollectionRuleCondition {
  return { type: "condition", entityTypes, field, operator, value };
}

describe("collection-rule-engine", () => {
  let database: Awaited<ReturnType<typeof createPostgresTestContext>>;

  beforeAll(async () => {
    database = await createPostgresTestContext();
  });

  afterAll(async () => {
    await database.close();
  });

  let rootId: string;
  let seriesId: string;
  let seasonId: string;
  let tagFavId: string;
  let tagBoringId: string;
  let performerAliceId: string;
  let studioAcmeId: string;
  let movieA: { id: string };
  let movieB: { id: string };
  let episodeA: { id: string };
  let episodeB: { id: string };

  beforeEach(async () => {
    await database.db.delete(videoEpisodeTags);
    await database.db.delete(videoMovieTags);
    await database.db.delete(videoMoviePerformers);
    await database.db.delete(videoEpisodes);
    await database.db.delete(videoSeasons);
    await database.db.delete(videoSeries);
    await database.db.delete(videoMovies);
    await database.db.delete(libraryRoots);
    await database.db.delete(tags);
    await database.db.delete(performers);
    await database.db.delete(studios);

    const [root] = await database.db
      .insert(libraryRoots)
      .values({ path: `/tmp/rule-root-${Math.random()}`, label: "Rule Root" })
      .returning();
    rootId = root.id;

    const [tagFav] = await database.db
      .insert(tags)
      .values({ name: "favorite" })
      .returning();
    tagFavId = tagFav.id;
    const [tagBoring] = await database.db
      .insert(tags)
      .values({ name: "boring" })
      .returning();
    tagBoringId = tagBoring.id;

    const [perfAlice] = await database.db
      .insert(performers)
      .values({ name: "Alice" })
      .returning();
    performerAliceId = perfAlice.id;

    const [studioAcme] = await database.db
      .insert(studios)
      .values({ name: "Acme" })
      .returning();
    studioAcmeId = studioAcme.id;

    const [mvA] = await database.db
      .insert(videoMovies)
      .values({
        libraryRootId: rootId,
        title: "Movie A",
        filePath: `/tmp/movieA-${Math.random()}.mp4`,
        rating: 5,
        studioId: studioAcmeId,
      })
      .returning({ id: videoMovies.id });
    movieA = mvA;
    const [mvB] = await database.db
      .insert(videoMovies)
      .values({
        libraryRootId: rootId,
        title: "Movie B",
        filePath: `/tmp/movieB-${Math.random()}.mp4`,
        rating: 2,
      })
      .returning({ id: videoMovies.id });
    movieB = mvB;

    await database.db
      .insert(videoMovieTags)
      .values([
        { movieId: movieA.id, tagId: tagFavId },
        { movieId: movieB.id, tagId: tagBoringId },
      ]);
    await database.db
      .insert(videoMoviePerformers)
      .values({ movieId: movieA.id, performerId: performerAliceId });

    const [series] = await database.db
      .insert(videoSeries)
      .values({
        libraryRootId: rootId,
        folderPath: `/tmp/series-${Math.random()}`,
        relativePath: "Series",
        title: "Series",
      })
      .returning();
    seriesId = series.id;
    const [season] = await database.db
      .insert(videoSeasons)
      .values({ seriesId, seasonNumber: 1 })
      .returning();
    seasonId = season.id;

    const [epA] = await database.db
      .insert(videoEpisodes)
      .values({
        seriesId,
        seasonId,
        seasonNumber: 1,
        episodeNumber: 1,
        title: "Ep A",
        filePath: `/tmp/epA-${Math.random()}.mp4`,
        rating: 4,
      })
      .returning({ id: videoEpisodes.id });
    episodeA = epA;
    const [epB] = await database.db
      .insert(videoEpisodes)
      .values({
        seriesId,
        seasonId,
        seasonNumber: 1,
        episodeNumber: 2,
        title: "Ep B",
        filePath: `/tmp/epB-${Math.random()}.mp4`,
        rating: 1,
      })
      .returning({ id: videoEpisodes.id });
    episodeB = epB;

    await database.db
      .insert(videoEpisodeTags)
      .values({ episodeId: episodeA.id, tagId: tagFavId });
  });

  it("evaluates a simple scalar equals condition on movies only", async () => {
    const tree = group(
      "and",
      cond("rating", "equals", 5, ["video"]),
    );

    const result = await evaluateRuleTree(database.db, tree);
    const videoIds = result.filter((r) => r.entityType === "video").map((r) => r.entityId);
    expect(videoIds).toContain(movieA.id);
    expect(videoIds).not.toContain(movieB.id);
    expect(videoIds).not.toContain(episodeB.id);
  });

  it("AND combines conditions across fields", async () => {
    // rating>=4 AND has tag 'favorite' should match movieA (rating 5, favorite) + epA (rating 4, favorite)
    const tree = group(
      "and",
      cond("rating", "greater_equal", 4, ["video"]),
      cond("tags", "in", ["favorite"], ["video"]),
    );

    const result = await evaluateRuleTree(database.db, tree);
    const videoIds = result
      .filter((r) => r.entityType === "video")
      .map((r) => r.entityId)
      .sort();
    expect(videoIds.sort()).toEqual([movieA.id, episodeA.id].sort());
  });

  it("OR combines conditions", async () => {
    // rating=5 OR rating=1 matches movieA + episodeB
    const tree = group(
      "or",
      cond("rating", "equals", 5, ["video"]),
      cond("rating", "equals", 1, ["video"]),
    );

    const result = await evaluateRuleTree(database.db, tree);
    const videoIds = result.map((r) => r.entityId).sort();
    expect(videoIds).toEqual([movieA.id, episodeB.id].sort());
  });

  it("NOT inverts a condition group", async () => {
    // NOT (rating=5) should exclude movieA but keep movieB + episodes
    const tree = group(
      "not",
      cond("rating", "equals", 5, ["video"]),
    );

    const result = await evaluateRuleTree(database.db, tree);
    const videoIds = result.map((r) => r.entityId);
    expect(videoIds).not.toContain(movieA.id);
    expect(videoIds).toContain(movieB.id);
    expect(videoIds).toContain(episodeA.id);
    expect(videoIds).toContain(episodeB.id);
  });

  it("filters movies by studio name", async () => {
    const tree = group("and", cond("studio", "in", ["Acme"], ["video"]));

    const result = await evaluateRuleTree(database.db, tree);
    const videoIds = result.map((r) => r.entityId);
    expect(videoIds).toContain(movieA.id);
    expect(videoIds).not.toContain(movieB.id);
  });

  it("filters movies by performer name", async () => {
    const tree = group(
      "and",
      cond("performers", "in", ["Alice"], ["video"]),
    );

    const result = await evaluateRuleTree(database.db, tree);
    const videoIds = result.map((r) => r.entityId);
    expect(videoIds).toContain(movieA.id);
    expect(videoIds).not.toContain(movieB.id);
  });

  it("previewRuleTree returns totals per entity type", async () => {
    const tree = group(
      "and",
      cond("rating", "greater_equal", 4, ["video"]),
    );

    const preview = await previewRuleTree(database.db, tree, 5);
    // movieA (5) + epA (4) match
    expect(preview.total).toBe(2);
    expect(preview.byType.video).toBe(2);
    expect(preview.items).toHaveLength(2);
  });
});
