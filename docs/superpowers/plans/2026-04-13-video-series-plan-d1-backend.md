# Video Series Model — Plan D1: Backend Activation

> **For agentic workers:** Use superpowers:subagent-driven-development to execute.

**Goal:** Flip the backend over to the new video model. Register the `videos_to_series_model_v1` data migration so it stages on next boot; wire the scan worker so it skips video scans during staged/finalizing lockdown; land the `scrape-accept` service with single-entity movie and episode handlers plus HTTP routing; prepare the surface the Plan D2 web UI will consume.

**Architecture:** Three small modules added in `apps/api/src/services/` + `apps/api/src/routes/` + a one-line registry change. The cascade accept path for series (which requires the cascade review UI to drive it) is intentionally deferred to Plan D2. The scan pipeline itself is NOT rewritten here — it continues to target `scenes` but skips cleanly during lockdown; the rewrite lands alongside the UI in D2.

**After this plan ships:** the next app boot stages the migration. Legacy tables stay in place (finalize is user-triggered). Write lockdown activates: the existing scan worker notices the lockdown and exits cleanly with a "paused" job record instead of writing to the old tables. UI continues to work (reads succeed). New `/video/movies/:id/accept-scrape` and `/video/episodes/:id/accept-scrape` routes exist and are exercised by integration tests.

**Reference spec:** `docs/superpowers/specs/2026-04-13-video-series-model-design.md` Section 7.4 (accept flow).

---

## Scope explicitly cut from D1

- **Series cascade accept.** Requires the review UI to assemble the `CascadeAcceptSpec`. Lands in D2.
- **New scan pipeline rewrite.** `processLibraryScan` still targets the legacy `scenes` table. Lands in D2.
- **Identify UI tabs and cascade review screen.** D2.
- **Migration banner and finalize button UI.** D2 (the route `POST /system/migrations/:name/finalize` already exists from Plan A).
- **Folder-view component rename pass.** D2.
- **MovieDB plugin updates.** Different repo; coordinated separately.

---

## File Structure

### New files
- `apps/api/src/services/scrape-accept.service.ts` — typed accept handlers for movie and episode.
- `apps/api/src/routes/video-accept.ts` — HTTP handlers that delegate to the service.
- `apps/api/src/services/scrape-accept.service.test.ts` — unit tests against an in-memory DB via the integration test pattern.

### Modified files
- `apps/api/src/db/data-migrations/registry.ts` — register `videosToSeriesModelV1`.
- `apps/worker/src/processors/library-scan.ts` — early-return when lockdown is active.
- `apps/api/src/app.ts` — register `videoAcceptRoutes`.
- `packages/contracts/src/index.ts` — add new route constants.
- `CHANGELOG.md` — document each landing.

---

## Task list

### Task 1: Register the data migration

**Files:** `apps/api/src/db/data-migrations/registry.ts`

- [ ] **Step 1: Add the import and register**

Replace the current empty registry contents with:

```ts
import type { DataMigration } from "./types";
import { videosToSeriesModelV1 } from "./videos_to_series_model_v1";

/**
 * Ordered list of registered data migrations. The orchestrator walks
 * this array in declaration order on every boot.
 */
export const dataMigrationsRegistry: DataMigration[] = [
  videosToSeriesModelV1,
];
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @obscura/api typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/data-migrations/registry.ts
git commit -m "feat(api): register videos_to_series_model_v1 migration"
```

**Do NOT run the migrator yet** — that would stage the migration against your dev DB. Whoever is running D1 in production will get the stage on next boot; dev can run it explicitly after Task 5 verifies everything else.

---

### Task 2: Scan worker lockdown guard

**Files:** `apps/worker/src/processors/library-scan.ts`

- [ ] **Step 1: Find the top of `processLibraryScan`**

```bash
grep -n "export async function processLibraryScan" apps/worker/src/processors/library-scan.ts
```

- [ ] **Step 2: Add a lockdown check**

Near the top of `processLibraryScan`, after the library root lookup and before the file discovery, add:

```ts
import { getLockdownStatus } from "@obscura/api/db/data-migrations/lockdown";
```

...at the top of the file with the other imports. Then inside the function body, after the root is fetched:

```ts
  const lockdown = await getLockdownStatus(getDatabaseClient());
  if (lockdown.active) {
    console.log(
      `[library-scan] skipping scan of ${root.label}: migration "${lockdown.blockedBy}" is ${lockdown.blockingStatus}`,
    );
    return;
  }
```

**Watchouts:**
- `@obscura/api` may not be importable from the worker as a package. If so, use a relative path: `../../../api/src/db/data-migrations/lockdown`, OR copy the `getLockdownStatus` function into a new `apps/worker/src/lib/lockdown.ts` that queries the same table. Match whatever pattern the worker uses today for other cross-app reads.
- `getDatabaseClient()` likewise may not exist in the worker. The worker has its own DB connection setup — find how other worker processors get the raw client (e.g., `apps/worker/src/db.ts` or `apps/worker/src/lib/db.ts`). Use the same mechanism.
- If the worker's DB connection is a Drizzle instance and not the raw `postgres` client, the cleanest fix is to expose a raw-client getter alongside the Drizzle getter, the same pattern Plan A added for the API in `apps/api/src/db/index.ts`.

Report which approach you ended up taking.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @obscura/worker typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/processors/library-scan.ts
# plus any new lockdown helper you added to the worker
git commit -m "feat(worker): skip library scans while a data migration is staged"
```

---

### Task 3: `scrape-accept` service — movie and episode handlers

**Files:**
- Create: `apps/api/src/services/scrape-accept.service.ts`

- [ ] **Step 1: Write the service**

```ts
import { eq } from "drizzle-orm";
import {
  scrapeResults,
  videoMovies,
  videoEpisodes,
  performers,
  tags,
  studios,
  videoMoviePerformers,
  videoMovieTags,
  videoEpisodePerformers,
  videoEpisodeTags,
} from "@obscura/db/src/schema";
import type {
  NormalizedMovieResult,
  NormalizedEpisodeResult,
} from "@obscura/contracts";
import { getDatabase } from "../db";

export interface AcceptFieldMask {
  title?: boolean;
  overview?: boolean;
  tagline?: boolean;
  releaseDate?: boolean;
  airDate?: boolean;
  runtime?: boolean;
  genres?: boolean;
  studio?: boolean;
  cast?: boolean;
  rating?: boolean;
  contentRating?: boolean;
  externalIds?: boolean;
}

const FULL_MASK: Required<AcceptFieldMask> = {
  title: true,
  overview: true,
  tagline: true,
  releaseDate: true,
  airDate: true,
  runtime: true,
  genres: true,
  studio: true,
  cast: true,
  rating: true,
  contentRating: true,
  externalIds: true,
};

function applyMask(mask: AcceptFieldMask | undefined): Required<AcceptFieldMask> {
  return { ...FULL_MASK, ...mask };
}

async function upsertPerformerByName(name: string): Promise<string> {
  const db = getDatabase();
  const [existing] = await db
    .select({ id: performers.id })
    .from(performers)
    .where(eq(performers.name, name))
    .limit(1);
  if (existing) return existing.id;
  const [inserted] = await db
    .insert(performers)
    .values({ name })
    .returning({ id: performers.id });
  return inserted.id;
}

async function upsertTagByName(name: string): Promise<string> {
  const db = getDatabase();
  const [existing] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(eq(tags.name, name))
    .limit(1);
  if (existing) return existing.id;
  const [inserted] = await db
    .insert(tags)
    .values({ name })
    .returning({ id: tags.id });
  return inserted.id;
}

async function upsertStudioByName(name: string): Promise<string> {
  const db = getDatabase();
  const [existing] = await db
    .select({ id: studios.id })
    .from(studios)
    .where(eq(studios.name, name))
    .limit(1);
  if (existing) return existing.id;
  const [inserted] = await db
    .insert(studios)
    .values({ name })
    .returning({ id: studios.id });
  return inserted.id;
}

export interface AcceptMovieInput {
  scrapeResultId: string;
  movieId: string;
  result: NormalizedMovieResult;
  fieldMask?: AcceptFieldMask;
}

export async function acceptMovieScrape(
  input: AcceptMovieInput,
): Promise<void> {
  const db = getDatabase();
  const mask = applyMask(input.fieldMask);
  const patch: Record<string, unknown> = {};
  if (mask.title) patch.title = input.result.title;
  if (mask.overview) patch.overview = input.result.overview;
  if (mask.tagline) patch.tagline = input.result.tagline;
  if (mask.releaseDate) patch.releaseDate = input.result.releaseDate;
  if (mask.runtime) patch.runtime = input.result.runtime;
  if (mask.rating && input.result.rating !== null && input.result.rating !== undefined) {
    patch.rating = Math.round(input.result.rating);
  }
  if (mask.contentRating) patch.contentRating = input.result.contentRating;
  if (mask.externalIds) patch.externalIds = input.result.externalIds;

  if (mask.studio && input.result.studioName) {
    const studioId = await upsertStudioByName(input.result.studioName);
    patch.studioId = studioId;
  }

  patch.organized = true;
  patch.updatedAt = new Date();

  if (Object.keys(patch).length > 0) {
    await db.update(videoMovies).set(patch).where(eq(videoMovies.id, input.movieId));
  }

  if (mask.genres && input.result.genres.length > 0) {
    for (const genre of input.result.genres) {
      const tagId = await upsertTagByName(genre);
      await db
        .insert(videoMovieTags)
        .values({ movieId: input.movieId, tagId })
        .onConflictDoNothing();
    }
  }

  if (mask.cast && input.result.cast && input.result.cast.length > 0) {
    for (const member of input.result.cast) {
      const performerId = await upsertPerformerByName(member.name);
      await db
        .insert(videoMoviePerformers)
        .values({
          movieId: input.movieId,
          performerId,
          character: member.character ?? null,
          order: member.order ?? null,
        })
        .onConflictDoNothing();
    }
  }

  await db
    .update(scrapeResults)
    .set({ status: "accepted", appliedAt: new Date(), updatedAt: new Date() })
    .where(eq(scrapeResults.id, input.scrapeResultId));
}

export interface AcceptEpisodeInput {
  scrapeResultId: string;
  episodeId: string;
  result: NormalizedEpisodeResult;
  fieldMask?: AcceptFieldMask;
}

export async function acceptEpisodeScrape(
  input: AcceptEpisodeInput,
): Promise<void> {
  const db = getDatabase();
  const mask = applyMask(input.fieldMask);
  const patch: Record<string, unknown> = {};
  if (mask.title) patch.title = input.result.title;
  if (mask.overview) patch.overview = input.result.overview;
  if (mask.airDate) patch.airDate = input.result.airDate;
  if (mask.runtime) patch.runtime = input.result.runtime;
  if (mask.externalIds) patch.externalIds = input.result.externalIds;
  // Episode placement fields
  if (input.result.seasonNumber !== undefined && input.result.seasonNumber !== null) {
    patch.seasonNumber = input.result.seasonNumber;
  }
  if (input.result.episodeNumber !== undefined && input.result.episodeNumber !== null) {
    patch.episodeNumber = input.result.episodeNumber;
  }
  if (
    input.result.absoluteEpisodeNumber !== undefined &&
    input.result.absoluteEpisodeNumber !== null
  ) {
    patch.absoluteEpisodeNumber = input.result.absoluteEpisodeNumber;
  }

  patch.organized = true;
  patch.updatedAt = new Date();

  if (Object.keys(patch).length > 0) {
    await db
      .update(videoEpisodes)
      .set(patch)
      .where(eq(videoEpisodes.id, input.episodeId));
  }

  if (mask.cast && input.result.guestStars && input.result.guestStars.length > 0) {
    for (const star of input.result.guestStars) {
      const performerId = await upsertPerformerByName(star.name);
      await db
        .insert(videoEpisodePerformers)
        .values({
          episodeId: input.episodeId,
          performerId,
          character: star.character ?? null,
          order: star.order ?? null,
        })
        .onConflictDoNothing();
    }
  }

  await db
    .update(scrapeResults)
    .set({ status: "accepted", appliedAt: new Date(), updatedAt: new Date() })
    .where(eq(scrapeResults.id, input.scrapeResultId));
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @obscura/api typecheck
```

If `getDatabase()` isn't the Drizzle client accessor, find the real name (e.g., `getDb`, `db`, or a direct import from `apps/api/src/db/index.ts`) and use it. Match the pattern used by `apps/api/src/services/scene.service.ts` or similar.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/scrape-accept.service.ts
git commit -m "feat(api): add scrape-accept service for movie and episode"
```

---

### Task 4: Route endpoints for the accept service

**Files:**
- Create: `apps/api/src/routes/video-accept.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Add route constants**

In `packages/contracts/src/index.ts`, inside the `apiRoutes` object, add:

```ts
  videoMovieAcceptScrape: "/video/movies/:id/accept-scrape",
  videoEpisodeAcceptScrape: "/video/episodes/:id/accept-scrape",
```

- [ ] **Step 2: Write the route file**

Create `apps/api/src/routes/video-accept.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { apiRoutes } from "@obscura/contracts";
import type {
  NormalizedMovieResult,
  NormalizedEpisodeResult,
} from "@obscura/contracts";
import { scrapeResults } from "@obscura/db/src/schema";
import { getDatabase } from "../db";
import {
  acceptMovieScrape,
  acceptEpisodeScrape,
  type AcceptFieldMask,
} from "../services/scrape-accept.service";

interface AcceptBody {
  scrapeResultId: string;
  fieldMask?: AcceptFieldMask;
}

export async function videoAcceptRoutes(app: FastifyInstance) {
  app.post(apiRoutes.videoMovieAcceptScrape, async (request, reply) => {
    const { id: movieId } = request.params as { id: string };
    const body = request.body as AcceptBody;
    if (!body?.scrapeResultId) {
      return reply.code(400).send({ ok: false, error: "scrapeResultId required" });
    }
    const db = getDatabase();
    const [row] = await db
      .select()
      .from(scrapeResults)
      .where(eq(scrapeResults.id, body.scrapeResultId))
      .limit(1);
    if (!row) {
      return reply.code(404).send({ ok: false, error: "scrape result not found" });
    }
    const proposed = row.proposedResult as unknown;
    if (!proposed || typeof proposed !== "object") {
      return reply.code(400).send({
        ok: false,
        error: "scrape result has no proposed_result payload",
      });
    }
    await acceptMovieScrape({
      scrapeResultId: body.scrapeResultId,
      movieId,
      result: proposed as NormalizedMovieResult,
      fieldMask: body.fieldMask,
    });
    return { ok: true };
  });

  app.post(apiRoutes.videoEpisodeAcceptScrape, async (request, reply) => {
    const { id: episodeId } = request.params as { id: string };
    const body = request.body as AcceptBody;
    if (!body?.scrapeResultId) {
      return reply.code(400).send({ ok: false, error: "scrapeResultId required" });
    }
    const db = getDatabase();
    const [row] = await db
      .select()
      .from(scrapeResults)
      .where(eq(scrapeResults.id, body.scrapeResultId))
      .limit(1);
    if (!row) {
      return reply.code(404).send({ ok: false, error: "scrape result not found" });
    }
    const proposed = row.proposedResult as unknown;
    if (!proposed || typeof proposed !== "object") {
      return reply.code(400).send({
        ok: false,
        error: "scrape result has no proposed_result payload",
      });
    }
    await acceptEpisodeScrape({
      scrapeResultId: body.scrapeResultId,
      episodeId,
      result: proposed as NormalizedEpisodeResult,
      fieldMask: body.fieldMask,
    });
    return { ok: true };
  });
}
```

- [ ] **Step 3: Register in `app.ts`**

Add the import:
```ts
import { videoAcceptRoutes } from "./routes/video-accept";
```

And register after the existing last `app.register(...)`:
```ts
  await app.register(videoAcceptRoutes);
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/index.ts apps/api/src/routes/video-accept.ts apps/api/src/app.ts
git commit -m "feat(api): add /video/movies and /video/episodes accept-scrape routes"
```

---

### Task 5: CHANGELOG

**Files:** `CHANGELOG.md`

- [ ] **Step 1: Add entries under `## [Unreleased]`**

Under `### What's New`, add:

```markdown
- **Video migration is now live.** On next boot, Obscura detects existing scene data and stages the migration into the new typed series/season/episode/movie tables, preserving ratings, watch progress, and NSFW state. Library scans pause automatically during the staged window. The in-app migration banner and finalize button arrive in the next release — until then, scans stay paused and nothing is destroyed; the legacy tables remain in place and fully readable.
```

Under `### Added`, add:

```markdown
- **`videos_to_series_model_v1` registered** — the data migration is now part of `dataMigrationsRegistry` and will run its `stage()` phase on the next API/worker boot if it detects an existing populated `scenes` table and empty new video tables.
- **Scan worker lockdown guard** — `processLibraryScan` short-circuits cleanly when a data migration is in a staging or staged state, logging the reason and exiting without touching the database.
- **`scrape-accept` service** (`apps/api/src/services/scrape-accept.service.ts`) with `acceptMovieScrape` and `acceptEpisodeScrape` — typed handlers that apply a `NormalizedMovieResult` or `NormalizedEpisodeResult` back onto the target row, upsert related performers/tags/studios, and mark the scrape result as accepted.
- **`POST /video/movies/:id/accept-scrape` and `POST /video/episodes/:id/accept-scrape`** routes — HTTP entry points that consume a `scrapeResultId` + optional field mask and delegate to the scrape-accept service. Registered alongside the existing system and plugin routes.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for Plan D1 backend activation"
```

---

## Final verification

- [ ] **Typecheck:** `pnpm typecheck`
- [ ] **Unit tests:** `pnpm test:unit`
- [ ] **Commit count:** `git log --oneline main..HEAD | wc -l` should be around 5.
- [ ] **DO NOT run `pnpm --filter @obscura/api db:migrate` on the dev DB unless you want to stage the migration locally.** Staging on dev is the expected behavior of D1; just know that once it fires, the dev DB enters lockdown until you manually call `POST /system/migrations/videos_to_series_model_v1/finalize` (which drops the legacy tables — irreversible) or run `DELETE FROM data_migrations WHERE name = 'videos_to_series_model_v1'` to reset.

---

## Notes

- The service returns `void` on success. The route handlers return `{ok: true}` — clients can trust any 2xx as success.
- Field mask defaults: passing no mask or an empty object means "accept everything." Plan D2's cascade review UI may want per-field opt-out, which is already supported by setting mask fields to `false`.
- The cascade path for series is intentionally not here. D2 adds `acceptSeriesScrape` with a `CascadeAcceptSpec` that walks child season and episode scrape rows linked by `cascade_parent_id`.
- When the migration stages on boot, `getLockdownStatus` in the scan worker returns `active: true` and the worker logs and exits. No data is touched. When the user eventually runs finalize (D2), the worker picks up normal scans on the next enqueue — though at that point the old scenes table is gone, and the existing `processLibraryScan` still targets `scenes`, which means it will crash on the next run until D2 ships the rewrite. That's the expected staging-window behavior: between D1 and D2 shipping, scans are paused.
