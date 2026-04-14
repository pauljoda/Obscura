# Video Series Model — Plan D3: Non-Destructive Finalize + Test Surface

> **For agentic workers:** Use superpowers:subagent-driven-development.

**Goal:** Make the whole video-series reshape testable end-to-end without requiring a full web-UI rewrite. Three moves: (1) make `finalize()` non-destructive so clicking it doesn't break the existing scenes-based UI, (2) add read-only HTTP endpoints for the new typed tables, (3) add a small `/video-library` page that surfaces movies, series, and episodes from the new model so a user can boot the app, let the migration stage, see their library re-organized under the typed model, and verify everything end-to-end.

**Architecture:** Three small deliverables.

1. **Finalize becomes a no-op drop.** The existing `videos_to_series_model_v1/finalize.ts` DROPs `scenes`, `scene_folders`, etc. Replace that with a function that just logs and returns — marks the migration `complete` without touching any tables. The destructive drop is deferred to a future Plan F after the legacy UI is fully retired.
2. **Read-only video endpoints.** Five new routes: list movies, list series, series detail (with seasons + episodes), episode detail, movie detail. Thin read handlers — Drizzle queries, no new services. These are the data source the new page consumes.
3. **`/video-library` web page.** A dedicated `(app)/video-library/page.tsx` with three tabs (Movies, Series, Episodes) showing simple grids/lists. Uses existing design tokens where possible. Does NOT replace `/scenes` or `/folders` — it coexists.

**After this ships:** The user can boot the app, migration stages on first boot, the existing UI continues to show legacy scenes (frozen-but-intact), the new `/video-library` page shows the typed data. Clicking "Finalize migration" in the banner is now safe (non-destructive) and toggles the migration to `complete`. Future scans write to the new tables and appear in `/video-library`. Old UI adaptation is a separate follow-up.

---

## Scope explicitly NOT in D3

- **No changes to the existing `scenes-page-client.tsx` / `scene-edit.tsx` / `scene-detail.tsx` / `lib/api/media.ts`.** Those 58 files stay as-is.
- **No identify UI refactor.** `identify-video-folders-tab.tsx` keeps driving folder identify.
- **No cascade review screen / ImagePicker.**
- **No downstream job processor rewrites.** `media-probe`, `fingerprint`, `preview`, `trickplay` still expect `sceneId`; the new scan's TODO-comments stay in place. New episodes/movies get DB rows but no derived assets until a dedicated processor update lands.
- **No real DROP of legacy tables.** The legacy tables live alongside the new ones indefinitely in this state.

---

## File Structure

### New files
- `apps/api/src/routes/video-library.ts` — GET handlers for movies/series/episodes.
- `apps/api/src/services/video-library.service.ts` — small query functions.
- `apps/web/src/lib/api/video-library.ts` — web-side fetchers.
- `apps/web/src/app/(app)/video-library/page.tsx` — new route.
- `apps/web/src/components/routes/video-library-page-client.tsx` — client component with three tabs.

### Modified files
- `apps/api/src/db/data-migrations/videos_to_series_model_v1/finalize.ts` — replace drops with a no-op.
- `apps/api/src/db/data-migrations/videos_to_series_model_v1/migration.integration.test.ts` — update the "drops legacy tables on finalize" test.
- `apps/api/src/app.ts` — register `videoLibraryRoutes`.
- `packages/contracts/src/index.ts` — add new route constants.
- `apps/web/src/components/system/migration-banner.tsx` — remove the destructive warning; update copy.
- `apps/web/src/components/sidebar.tsx` (or wherever the main nav lives) — add a "Video Library" link. If the nav is generated from a config, edit the config.
- `CHANGELOG.md` — document the landings.

---

## Task list

### Task 1: Non-destructive finalize

**Files:**
- Modify: `apps/api/src/db/data-migrations/videos_to_series_model_v1/finalize.ts`
- Modify: `apps/api/src/db/data-migrations/videos_to_series_model_v1/migration.integration.test.ts`

- [ ] **Step 1: Replace the finalize implementation**

Replace the entire contents of `finalize.ts` with:

```ts
import type { DataMigrationContext, FinalizeResult } from "../types";

/**
 * Non-destructive finalize. The original videos_to_series_model_v1
 * plan called for dropping the legacy `scenes` and `scene_folders`
 * tables here, but the web UI still reads from them. Until a
 * dedicated cleanup plan adapts every consumer, finalize just marks
 * the migration complete and leaves the legacy schema in place.
 *
 * Side effects:
 *   - None to the database.
 *   - The orchestrator wraps this call in a transaction and flips
 *     the data_migrations row to `complete` after it returns.
 *
 * Legacy-table cleanup is deferred to a future plan that lands after
 * the web UI stops reading from scenes/scene_folders.
 */
export async function finalize(
  ctx: DataMigrationContext,
): Promise<FinalizeResult> {
  const { logger, reportProgress } = ctx;
  reportProgress(100, "finalize (non-destructive)");
  logger.info("videos_to_series_model_v1 finalize complete (non-destructive)");
  return {
    metrics: {
      destructive: false,
      droppedTables: 0,
    },
  };
}
```

- [ ] **Step 2: Update the integration test**

In `migration.integration.test.ts`, find the test `"drops legacy tables on finalize"` and replace it with:

```ts
  it("finalize is non-destructive — legacy tables remain in place", async () => {
    await client`INSERT INTO library_roots (path, label) VALUES ('/media/test2', 'test2')`;
    await client`INSERT INTO scenes (title, file_path) VALUES ('One', '/media/test2/One.mkv')`;

    await videosToSeriesModelV1.stage(ctx);
    await videosToSeriesModelV1.finalize(ctx);

    const tables = await client<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('scenes', 'scene_folders')
    `;
    // Both tables should STILL exist. We don't care about the exact count
    // in this test environment; just that they weren't dropped.
    const names = tables.map((t) => t.table_name).sort();
    expect(names).toContain("scenes");
    // scene_folders existence is migration-runner-dependent, not guaranteed
    // in every test DB, so we only assert scenes.

    // scan_videos column should still exist too
    const columns = await client<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'library_roots' AND column_name = 'scan_videos'
    `;
    expect(columns.length).toBe(1);
  });
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @obscura/api typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/db/data-migrations/videos_to_series_model_v1/finalize.ts apps/api/src/db/data-migrations/videos_to_series_model_v1/migration.integration.test.ts
git commit -m "feat(api): make videos_to_series finalize non-destructive"
```

---

### Task 2: Video library service

**Files:**
- Create: `apps/api/src/services/video-library.service.ts`

- [ ] **Step 1: Write the service**

```ts
import { eq, desc, asc } from "drizzle-orm";
import {
  videoSeries,
  videoSeasons,
  videoEpisodes,
  videoMovies,
} from "@obscura/db/src/schema";
import { db } from "../db";

export interface ListVideoMovieRow {
  id: string;
  title: string;
  releaseDate: string | null;
  runtime: number | null;
  rating: number | null;
  posterPath: string | null;
  isNsfw: boolean;
  organized: boolean;
  duration: number | null;
  width: number | null;
  height: number | null;
  createdAt: Date;
}

export async function listVideoMovies(options: {
  limit?: number;
  offset?: number;
  includeNsfw?: boolean;
} = {}): Promise<{ items: ListVideoMovieRow[]; total: number }> {
  const limit = Math.min(options.limit ?? 60, 200);
  const offset = Math.max(options.offset ?? 0, 0);

  const rows = await db
    .select({
      id: videoMovies.id,
      title: videoMovies.title,
      releaseDate: videoMovies.releaseDate,
      runtime: videoMovies.runtime,
      rating: videoMovies.rating,
      posterPath: videoMovies.posterPath,
      isNsfw: videoMovies.isNsfw,
      organized: videoMovies.organized,
      duration: videoMovies.duration,
      width: videoMovies.width,
      height: videoMovies.height,
      createdAt: videoMovies.createdAt,
    })
    .from(videoMovies)
    .orderBy(desc(videoMovies.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sqlCount() })
    .from(videoMovies);

  return { items: rows as ListVideoMovieRow[], total: Number(count) };
}

export interface ListVideoSeriesRow {
  id: string;
  title: string;
  overview: string | null;
  firstAirDate: string | null;
  endAirDate: string | null;
  status: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  isNsfw: boolean;
  organized: boolean;
  createdAt: Date;
  seasonCount: number;
  episodeCount: number;
}

export async function listVideoSeries(options: {
  limit?: number;
  offset?: number;
} = {}): Promise<{ items: ListVideoSeriesRow[]; total: number }> {
  const limit = Math.min(options.limit ?? 60, 200);
  const offset = Math.max(options.offset ?? 0, 0);

  // Use a raw SQL query for the aggregate counts — Drizzle's subquery
  // composition gets awkward with lateral joins.
  const rows = await db.execute<ListVideoSeriesRow>(sqlRaw`
    SELECT
      s.id,
      s.title,
      s.overview,
      s.first_air_date        AS "firstAirDate",
      s.end_air_date          AS "endAirDate",
      s.status,
      s.poster_path           AS "posterPath",
      s.backdrop_path         AS "backdropPath",
      s.is_nsfw               AS "isNsfw",
      s.organized,
      s.created_at            AS "createdAt",
      (SELECT count(*)::int FROM video_seasons WHERE series_id = s.id) AS "seasonCount",
      (SELECT count(*)::int FROM video_episodes WHERE series_id = s.id) AS "episodeCount"
    FROM video_series s
    ORDER BY s.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const [{ count }] = await db
    .select({ count: sqlCount() })
    .from(videoSeries);

  return { items: rows as ListVideoSeriesRow[], total: Number(count) };
}

export interface SeriesDetailResponse {
  id: string;
  title: string;
  overview: string | null;
  firstAirDate: string | null;
  endAirDate: string | null;
  status: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number | null;
  isNsfw: boolean;
  organized: boolean;
  seasons: Array<{
    id: string;
    seasonNumber: number;
    title: string | null;
    overview: string | null;
    episodes: Array<{
      id: string;
      seasonNumber: number;
      episodeNumber: number | null;
      title: string | null;
      overview: string | null;
      runtime: number | null;
      duration: number | null;
      isNsfw: boolean;
      organized: boolean;
    }>;
  }>;
}

export async function getVideoSeriesDetail(
  id: string,
): Promise<SeriesDetailResponse | null> {
  const [series] = await db
    .select()
    .from(videoSeries)
    .where(eq(videoSeries.id, id))
    .limit(1);
  if (!series) return null;

  const seasons = await db
    .select()
    .from(videoSeasons)
    .where(eq(videoSeasons.seriesId, id))
    .orderBy(asc(videoSeasons.seasonNumber));

  const seasonIds = seasons.map((s) => s.id);
  const episodes = seasonIds.length
    ? await db
        .select()
        .from(videoEpisodes)
        .where(eq(videoEpisodes.seriesId, id))
        .orderBy(
          asc(videoEpisodes.seasonNumber),
          asc(videoEpisodes.episodeNumber),
        )
    : [];

  return {
    id: series.id,
    title: series.title,
    overview: series.overview,
    firstAirDate: series.firstAirDate,
    endAirDate: series.endAirDate,
    status: series.status,
    posterPath: series.posterPath,
    backdropPath: series.backdropPath,
    rating: series.rating,
    isNsfw: series.isNsfw,
    organized: series.organized,
    seasons: seasons.map((season) => ({
      id: season.id,
      seasonNumber: season.seasonNumber,
      title: season.title,
      overview: season.overview,
      episodes: episodes
        .filter((e) => e.seasonId === season.id)
        .map((e) => ({
          id: e.id,
          seasonNumber: e.seasonNumber,
          episodeNumber: e.episodeNumber,
          title: e.title,
          overview: e.overview,
          runtime: e.runtime,
          duration: e.duration,
          isNsfw: e.isNsfw,
          organized: e.organized,
        })),
    })),
  };
}

export async function getVideoMovieDetail(id: string) {
  const [movie] = await db
    .select()
    .from(videoMovies)
    .where(eq(videoMovies.id, id))
    .limit(1);
  return movie ?? null;
}

export async function getVideoEpisodeDetail(id: string) {
  const [episode] = await db
    .select()
    .from(videoEpisodes)
    .where(eq(videoEpisodes.id, id))
    .limit(1);
  return episode ?? null;
}

export async function getVideoLibraryCounts() {
  const [movieCount] = await db
    .select({ count: sqlCount() })
    .from(videoMovies);
  const [seriesCount] = await db
    .select({ count: sqlCount() })
    .from(videoSeries);
  const [episodeCount] = await db
    .select({ count: sqlCount() })
    .from(videoEpisodes);
  return {
    movies: Number(movieCount.count),
    series: Number(seriesCount.count),
    episodes: Number(episodeCount.count),
  };
}

// Drizzle doesn't ship a bare `count()` — use `sql` template.
import { sql } from "drizzle-orm";
function sqlCount() {
  return sql<number>`count(*)::int`;
}
function sqlRaw(
  strings: TemplateStringsArray,
  ...values: unknown[]
) {
  return sql.raw(
    strings.reduce(
      (acc, part, i) => acc + part + (values[i] ?? ""),
      "",
    ),
  );
}
```

If `db.execute` or `sql.raw` behave differently in this Drizzle version, adapt the raw-SQL helper to match. The goal is a `SELECT ... LIMIT ... OFFSET` that returns typed rows. Look at how other services in `apps/api/src/services/` do dynamic queries for a pattern to follow.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @obscura/api typecheck
```

If the `sqlCount` / `sqlRaw` helpers are tangled, the simplest fallback is to use `postgres`-js directly via `getDatabaseClient()` for the aggregate and listing queries, keeping Drizzle for the straightforward detail reads. Whatever compiles cleanly.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/video-library.service.ts
git commit -m "feat(api): add video-library read service"
```

---

### Task 3: Video library HTTP routes

**Files:**
- Create: `apps/api/src/routes/video-library.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Add route constants**

In `packages/contracts/src/index.ts`, add to `apiRoutes`:

```ts
  videoLibraryCounts: "/video/library/counts",
  videoMovies: "/video/movies",
  videoMovieDetail: "/video/movies/:id",
  videoSeries: "/video/series",
  videoSeriesDetail: "/video/series/:id",
  videoEpisodeDetail: "/video/episodes/:id",
```

- [ ] **Step 2: Write the route file**

```ts
import type { FastifyInstance } from "fastify";
import { apiRoutes } from "@obscura/contracts";
import {
  listVideoMovies,
  listVideoSeries,
  getVideoSeriesDetail,
  getVideoMovieDetail,
  getVideoEpisodeDetail,
  getVideoLibraryCounts,
} from "../services/video-library.service";

export async function videoLibraryRoutes(app: FastifyInstance) {
  app.get(apiRoutes.videoLibraryCounts, async () => {
    return getVideoLibraryCounts();
  });

  app.get(apiRoutes.videoMovies, async (request) => {
    const query = request.query as {
      limit?: string;
      offset?: string;
    };
    const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined;
    const offset = query.offset ? Number.parseInt(query.offset, 10) : undefined;
    return listVideoMovies({ limit, offset });
  });

  app.get(apiRoutes.videoMovieDetail, async (request, reply) => {
    const { id } = request.params as { id: string };
    const movie = await getVideoMovieDetail(id);
    if (!movie) {
      return reply.code(404).send({ error: "not found" });
    }
    return movie;
  });

  app.get(apiRoutes.videoSeries, async (request) => {
    const query = request.query as {
      limit?: string;
      offset?: string;
    };
    const limit = query.limit ? Number.parseInt(query.limit, 10) : undefined;
    const offset = query.offset ? Number.parseInt(query.offset, 10) : undefined;
    return listVideoSeries({ limit, offset });
  });

  app.get(apiRoutes.videoSeriesDetail, async (request, reply) => {
    const { id } = request.params as { id: string };
    const series = await getVideoSeriesDetail(id);
    if (!series) {
      return reply.code(404).send({ error: "not found" });
    }
    return series;
  });

  app.get(apiRoutes.videoEpisodeDetail, async (request, reply) => {
    const { id } = request.params as { id: string };
    const episode = await getVideoEpisodeDetail(id);
    if (!episode) {
      return reply.code(404).send({ error: "not found" });
    }
    return episode;
  });
}
```

- [ ] **Step 3: Register in `app.ts`**

Add the import and `await app.register(videoLibraryRoutes);` near the bottom of the existing registration block.

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @obscura/contracts typecheck
pnpm --filter @obscura/api typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/index.ts apps/api/src/routes/video-library.ts apps/api/src/app.ts
git commit -m "feat(api): add video library read routes"
```

---

### Task 4: Web API client for video library

**Files:**
- Create: `apps/web/src/lib/api/video-library.ts`

- [ ] **Step 1: Write the client**

Match the existing fetch pattern in `apps/web/src/lib/api/media.ts` or similar. Find the existing `apiBaseUrl` constant or config helper. Typical shape:

```ts
import { apiBaseUrl } from "./config";

export interface VideoLibraryCounts {
  movies: number;
  series: number;
  episodes: number;
}

export interface VideoMovieRow {
  id: string;
  title: string;
  releaseDate: string | null;
  runtime: number | null;
  rating: number | null;
  posterPath: string | null;
  isNsfw: boolean;
  organized: boolean;
  duration: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface VideoSeriesRow {
  id: string;
  title: string;
  overview: string | null;
  firstAirDate: string | null;
  endAirDate: string | null;
  status: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  isNsfw: boolean;
  organized: boolean;
  createdAt: string;
  seasonCount: number;
  episodeCount: number;
}

export interface VideoSeriesDetail extends VideoSeriesRow {
  rating: number | null;
  seasons: Array<{
    id: string;
    seasonNumber: number;
    title: string | null;
    overview: string | null;
    episodes: Array<{
      id: string;
      seasonNumber: number;
      episodeNumber: number | null;
      title: string | null;
      overview: string | null;
      runtime: number | null;
      duration: number | null;
      isNsfw: boolean;
      organized: boolean;
    }>;
  }>;
}

export async function fetchVideoLibraryCounts(): Promise<VideoLibraryCounts> {
  const res = await fetch(`${apiBaseUrl}/video/library/counts`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json();
}

export async function fetchVideoMovies(params: {
  limit?: number;
  offset?: number;
} = {}): Promise<{ items: VideoMovieRow[]; total: number }> {
  const search = new URLSearchParams();
  if (params.limit) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));
  const url = `${apiBaseUrl}/video/movies${search.size ? `?${search}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json();
}

export async function fetchVideoSeriesList(params: {
  limit?: number;
  offset?: number;
} = {}): Promise<{ items: VideoSeriesRow[]; total: number }> {
  const search = new URLSearchParams();
  if (params.limit) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));
  const url = `${apiBaseUrl}/video/series${search.size ? `?${search}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json();
}

export async function fetchVideoSeriesDetail(
  id: string,
): Promise<VideoSeriesDetail> {
  const res = await fetch(`${apiBaseUrl}/video/series/${id}`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json();
}
```

Adjust the `apiBaseUrl` import to match whatever the project uses. If there's a `serverApiUrl` for server-side fetching versus a client-side URL, follow the same pattern as `apps/web/src/lib/api/system.ts` (landed in D2).

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @obscura/web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api/video-library.ts
git commit -m "feat(web): add video library API client"
```

---

### Task 5: Video library page

**Files:**
- Create: `apps/web/src/app/(app)/video-library/page.tsx`
- Create: `apps/web/src/components/routes/video-library-page-client.tsx`

- [ ] **Step 1: Write the server entry**

Create `apps/web/src/app/(app)/video-library/page.tsx`:

```tsx
import { VideoLibraryPageClient } from "@/components/routes/video-library-page-client";

export default function VideoLibraryPage() {
  return <VideoLibraryPageClient />;
}
```

If `@/` path alias isn't configured in `apps/web/tsconfig.json`, use a relative path matching the pattern in other route files.

- [ ] **Step 2: Write the client component**

Create `apps/web/src/components/routes/video-library-page-client.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import {
  fetchVideoLibraryCounts,
  fetchVideoMovies,
  fetchVideoSeriesList,
  type VideoLibraryCounts,
  type VideoMovieRow,
  type VideoSeriesRow,
} from "../../lib/api/video-library";

type Tab = "movies" | "series";

export function VideoLibraryPageClient() {
  const [tab, setTab] = useState<Tab>("series");
  const [counts, setCounts] = useState<VideoLibraryCounts | null>(null);
  const [movies, setMovies] = useState<VideoMovieRow[]>([]);
  const [series, setSeries] = useState<VideoSeriesRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchVideoLibraryCounts(),
      fetchVideoSeriesList({ limit: 60 }),
      fetchVideoMovies({ limit: 60 }),
    ])
      .then(([c, s, m]) => {
        if (cancelled) return;
        setCounts(c);
        setSeries(s.items);
        setMovies(m.items);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      style={{
        padding: "1.25rem",
        color: "var(--text-primary, #e8e4dc)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <header style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "Geist, sans-serif",
            fontSize: "1.75rem",
            fontWeight: 600,
          }}
        >
          Video Library
        </h1>
        <div style={{ opacity: 0.7, marginTop: "0.25rem", fontSize: "0.875rem" }}>
          New typed view backed by the video series model. Read-only for now.
        </div>
        {counts && (
          <div
            style={{
              display: "flex",
              gap: "1.25rem",
              marginTop: "0.75rem",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.75rem",
              opacity: 0.85,
            }}
          >
            <span>series: {counts.series}</span>
            <span>movies: {counts.movies}</span>
            <span>episodes: {counts.episodes}</span>
          </div>
        )}
      </header>

      <nav
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1rem",
          borderBottom: "1px solid rgba(196, 154, 90, 0.25)",
        }}
      >
        {(["series", "movies"] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              borderRadius: 0,
              border: "none",
              borderBottom:
                tab === key
                  ? "2px solid #c49a5a"
                  : "2px solid transparent",
              background: "transparent",
              padding: "0.5rem 0.875rem",
              color: "inherit",
              cursor: "pointer",
              fontFamily: "Geist, sans-serif",
              textTransform: "capitalize",
              fontWeight: tab === key ? 600 : 400,
            }}
          >
            {key}
          </button>
        ))}
      </nav>

      {error && (
        <div
          style={{
            borderLeft: "2px solid #ff8080",
            padding: "0.5rem 0.75rem",
            color: "#ff8080",
            marginBottom: "1rem",
            fontSize: "0.875rem",
          }}
        >
          Failed to load: {error}
        </div>
      )}

      {tab === "series" && (
        <section>
          {series.length === 0 ? (
            <div style={{ opacity: 0.6 }}>No series yet.</div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "1rem",
              }}
            >
              {series.map((s) => (
                <article
                  key={s.id}
                  style={{
                    background: "rgba(18, 18, 20, 0.6)",
                    border: "1px solid rgba(196, 154, 90, 0.18)",
                    padding: "0.75rem",
                    borderRadius: 0,
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontFamily: "Geist, sans-serif",
                      fontSize: "1rem",
                      fontWeight: 500,
                    }}
                  >
                    {s.title}
                  </h2>
                  <div
                    style={{
                      opacity: 0.65,
                      fontSize: "0.75rem",
                      marginTop: "0.25rem",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {s.seasonCount} season{s.seasonCount === 1 ? "" : "s"} ·{" "}
                    {s.episodeCount} episode{s.episodeCount === 1 ? "" : "s"}
                  </div>
                  {s.firstAirDate && (
                    <div style={{ opacity: 0.55, fontSize: "0.75rem", marginTop: "0.125rem" }}>
                      First aired {s.firstAirDate}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "movies" && (
        <section>
          {movies.length === 0 ? (
            <div style={{ opacity: 0.6 }}>No movies yet.</div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "1rem",
              }}
            >
              {movies.map((m) => (
                <article
                  key={m.id}
                  style={{
                    background: "rgba(18, 18, 20, 0.6)",
                    border: "1px solid rgba(196, 154, 90, 0.18)",
                    padding: "0.75rem",
                    borderRadius: 0,
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontFamily: "Geist, sans-serif",
                      fontSize: "1rem",
                      fontWeight: 500,
                    }}
                  >
                    {m.title}
                  </h2>
                  {m.releaseDate && (
                    <div
                      style={{
                        opacity: 0.65,
                        fontSize: "0.75rem",
                        marginTop: "0.25rem",
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                    >
                      {m.releaseDate}
                    </div>
                  )}
                  {m.runtime && (
                    <div style={{ opacity: 0.55, fontSize: "0.75rem" }}>
                      {m.runtime} min
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @obscura/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(app\)/video-library/page.tsx apps/web/src/components/routes/video-library-page-client.tsx
git commit -m "feat(web): add /video-library route with movies and series tabs"
```

---

### Task 6: Update migration banner copy

**Files:**
- Modify: `apps/web/src/components/system/migration-banner.tsx`

- [ ] **Step 1: Update the warning text and confirm dialog**

Find the confirm dialog and the warning description in the banner. Replace the destructive language with the safe version:

- Confirm prompt: `Finalize "${staged.name}"? This is now a non-destructive operation — the legacy tables stay in place, the migration row is marked complete, and you can continue using both the old and new UI surfaces. Proceed?`
- Description text: change `"Library scans are paused until you finalize. Finalizing drops the legacy scenes and scene_folders tables..."` to `"The new typed video tables have been populated from your existing scenes. The legacy tables remain in place, so the existing UI continues to work; finalize simply marks this migration complete and unlocks the next round of cleanup work."`

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @obscura/web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/system/migration-banner.tsx
git commit -m "feat(web): update migration banner for non-destructive finalize"
```

---

### Task 7: CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add entries**

Under `## [Unreleased]` → `### What's New`:

```markdown
- **New Video Library view.** A new `/video-library` page surfaces the typed series/season/episode and movie model introduced over the previous releases. Two tabs — Series and Movies — show grids with counts at the top. It's intentionally read-only and lightweight; the full UI port of the existing scenes/folders pages is planned for a follow-up release. In the meantime, both the old UI and the new Video Library view coexist, and clicking "Finalize migration" in the banner is now a safe, non-destructive operation.
```

Under `### Changed`:

```markdown
- **`videos_to_series_model_v1` finalize is now non-destructive.** The original plan was for finalize to drop the legacy `scenes` and `scene_folders` tables, but since the existing UI still reads from them, dropping them would break the app. Finalize now just marks the migration complete and leaves the legacy schema in place. A future cleanup release will drop the legacy tables after the web UI has been fully adapted.
- **Migration banner** — destructive warning replaced with a safe confirm. The banner now explains that finalize is a no-op drop and that both UIs continue to work after confirmation.
```

Under `### Added`:

```markdown
- **Video library service and routes** — new read-only endpoints `GET /video/library/counts`, `GET /video/movies`, `GET /video/movies/:id`, `GET /video/series`, `GET /video/series/:id`, and `GET /video/episodes/:id`. Backed by a small Drizzle service that queries the typed tables directly. Consumed by the new Video Library web page.
- **`fetchVideoLibraryCounts` / `fetchVideoMovies` / `fetchVideoSeriesList` / `fetchVideoSeriesDetail`** in `apps/web/src/lib/api/video-library.ts` — typed wrappers for the new endpoints.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for Plan D3 testable surface"
```

---

## Final verification

```bash
pnpm typecheck
pnpm test:unit
git log --oneline main..HEAD | wc -l
```

Expected: all green. ~7 commits on the branch.

---

## Manual test plan

After merging D3 to main:

1. **Restart the API and worker** with `pnpm dev` or the equivalent.
2. **Check `/system/status`** — confirm `videos_to_series_model_v1` is in `staged` status after the orchestrator runs it.
3. **Check the DB** — confirm `video_series`, `video_seasons`, `video_episodes`, `video_movies` have rows copied from the legacy scenes.
4. **Visit `/video-library`** in the web UI — confirm the page renders, counts are populated, Series/Movies tabs show data.
5. **Check the banner** — confirm it appears on every page.
6. **Click Finalize** — confirm the dialog, accept, verify status goes to `complete` and the banner disappears. Confirm `scenes` / `scene_folders` are STILL in the DB (non-destructive).
7. **Trigger a new scan** — confirm new files are written to `video_*` tables and appear in `/video-library`. Confirm the old `/scenes` UI still renders the pre-migration data.

At this point the whole pipeline is end-to-end verified.
