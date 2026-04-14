# Video Series Model — Plan D2: Backend Completion + Minimal UI

> **For agentic workers:** Use superpowers:subagent-driven-development.

**Goal:** Finish the backend side of the Series→Season→Episode reshape and ship a minimal user-visible surface (migration banner, user docs). Explicitly defer the full web-UI rewrite — 58 files touch `scenes`/`scene_folders` and adapting them all is a multi-plan effort that warrants its own dedicated sequence. D2's job is to complete the backend so that the UI rewrite can proceed in isolation against a stable data contract.

**Architecture:** Three deliverables. (1) A new `processLibraryScan` that uses `classifyVideoFile` and writes to `video_series`/`video_seasons`/`video_episodes`/`video_movies` instead of `scenes`/`scene_folders`. (2) The `acceptSeriesScrape` handler with cascade-spec walking, plus its HTTP route. (3) A small web deliverable: a migration banner component that surfaces the staged migration with a (destructive) finalize button behind a clear warning, plus `docs/library-organization.md`.

**After this ships:** The backend contract is complete. A future "Plan D3" will adapt the web UI to read from the new typed tables. Until D3 lands, users see the banner on boot, can choose to finalize (destructively drops legacy tables — their UI breaks until D3), or ignore it and keep using the legacy-read UI while new scans silently populate the new tables.

---

## Scope explicitly deferred to a future plan (D3)

- **Web UI adaptation** — `components/routes/scenes-page-client.tsx` (1393 LOC), `scene-edit.tsx` (1117 LOC), `scene-detail.tsx` (840 LOC), `lib/api/media.ts` fetch functions, performer/studio/tag detail pages, dashboard, search, collections. None of these change in D2.
- **Identify UI tabs refactor** — Movies / Series / Episodes tabs. The existing `identify-video-folders-tab.tsx` continues to drive folder-level identify.
- **Cascade review screen + ImagePicker component** — the cascade accept handler ships in D2 but the UI that drives it (assembling the `CascadeAcceptSpec` from per-episode checkboxes) is D3.
- **Folder view component rename pass** — `components/scene-folders/` stays as-is.
- **MovieDB plugin updates** — different repo, coordinated separately.

---

## What D2 does change

### New files

- `apps/worker/src/processors/library-scan-video.ts` — the new scan pipeline. Named with a `-video` suffix to avoid colliding with the old file during review; Task 2 wires it in as the registered processor.
- `apps/api/src/services/scrape-accept-series.service.ts` — `acceptSeriesScrape` with cascade support.
- `apps/web/src/components/system/migration-banner.tsx` — React component rendering any staged migrations with a finalize action.
- `apps/web/src/lib/api/system.ts` — client-side API calls for `/system/status` and `/system/migrations/:name/finalize`.
- `docs/library-organization.md` — user-facing markdown.

### Modified files

- `apps/worker/src/processors/library-scan.ts` — delete the old implementation; export the new one from `library-scan-video.ts` under the old function name so the runtime registration keeps working. OR leave the file empty with a single re-export.
- `apps/worker/src/lib/lockdown.ts` — delete, no longer needed (the new scan is lockdown-safe since it targets the new tables).
- `apps/api/src/routes/video-accept.ts` — add `POST /video/series/:id/accept-scrape` route.
- `packages/contracts/src/index.ts` — add `videoSeriesAcceptScrape` route constant.
- `apps/web/src/components/app-shell.tsx` — render `<MigrationBanner />` above `<CanvasHeader />`.
- `CHANGELOG.md` — document the landings.

---

## Task list

### Task 1: New scan pipeline (writes to video_* tables)

**Files:**
- Create: `apps/worker/src/processors/library-scan-video.ts`
- Modify: `apps/worker/src/processors/library-scan.ts` (become a re-export shim)
- Delete: `apps/worker/src/lib/lockdown.ts` (no longer needed)

The new scan pipeline is structurally similar to the old one but writes to the typed tables. Key differences from the old `processLibraryScan`:

- Uses `classifyVideoFile` from `@obscura/media-core` instead of deriving depth manually.
- For each classified file, upserts into `video_movies` (when `kind === "movie"`) or into `video_series`/`video_seasons`/`video_episodes` (when `kind === "episode"`) instead of `scenes`.
- Builds the series tree up front (via `buildSeriesTree` from the migration's `series-tree.ts`, OR an inlined equivalent if the migration module isn't importable from the worker).
- Preserves user state on upserts: when a `video_episodes` or `video_movies` row already exists by `file_path`, do NOT touch user-edited fields (`rating`, `is_nsfw`, `organized`, `play_count`, `orgasm_count`, `play_duration`, `resume_time`, `last_played_at`, custom title/overview). Do update file/probe fields when they change.
- Enqueues the same downstream jobs (`media-probe`, `fingerprint`, `preview`, `trickplay`) keyed on `entityType: "video_episode"` or `"video_movie"` instead of `"scene"`.
- Does NOT call `syncSceneFoldersForRoot`. The folder hierarchy is derived from the series/season structure now, not a separate sync pass.
- Does NOT read legacy scene_folder rows.
- Does NOT take a lockdown check. The new scan targets the new tables, which are safe to write even during the `staged` state of the migration (the migration itself wrote them the first time; re-running the scan just upserts).

**This task is the heaviest in the plan. Budget most of your context for it.**

- [ ] **Step 1: Read the existing `processLibraryScan`** at `apps/worker/src/processors/library-scan.ts` top to bottom. Understand the structure: library-root lookup, file discovery, per-file scene upsert, performer/tag linking via `linkSidecarMetadata`, job enqueueing, folder hierarchy sync.

- [ ] **Step 2: Write `apps/worker/src/processors/library-scan-video.ts`**

The file should export a function with the same signature as the old `processLibraryScan`:

```ts
export async function processLibraryScan(job: Job): Promise<void>
```

Structure:

1. Fetch the library root from `library_roots` by `job.data.libraryRootId`.
2. Mark the job active (same helper the old code uses).
3. Fetch `library_settings`.
4. Call `discoverVideoFiles(root.path, root.recursive)` to get the file list.
5. Read each file's sidecar metadata via `readSidecarMetadata(filePath)` (reuse the existing helper).
6. Classify each file via:
   ```ts
   classifyVideoFile(filePath, {
     libraryRootPath: root.path,
     scanMovies: root.scanMovies ?? true,  // fall back to true for backward compat
     scanSeries: root.scanSeries ?? true,
   });
   ```
7. Split classified results into `movies: VideoClassificationMovie[]` and `episodes: VideoClassificationEpisode[]`, skipping rejected/skipped with a warning log.
8. Build the series tree via the logic from `apps/api/src/db/data-migrations/videos_to_series_model_v1/series-tree.ts`. If you can't import it from the worker (cross-app), inline the ~30-line `buildSeriesTree` function in the worker file — it's pure and small.
9. **Upsert series**: for each series in the tree, `INSERT ... ON CONFLICT (folder_path) DO UPDATE SET updated_at = now() RETURNING id`. Preserve user fields by not including them in the update set.
10. **Upsert seasons**: for each season, `INSERT ... ON CONFLICT (series_id, season_number) DO UPDATE SET updated_at = now() RETURNING id`.
11. **Upsert episodes**: for each episode file, `INSERT ... ON CONFLICT (file_path) DO UPDATE SET` a limited set of fields (file_size, duration, width, height, etc.) — preserve user fields (rating, is_nsfw, organized, play_count, etc.).
    - Apply sidecar metadata (NFO → JSON → filename parser priority) only when the DB value is null.
    - `organized` should default to `false` for new rows; don't overwrite existing `organized = true` rows.
12. **Upsert movies**: similar to episodes but keyed on `library_root_id + file_path`. Same preserve-user-state rules.
13. **Link performers/tags** via a new `linkVideoSidecarMetadata(videoId, entityKind, tagNames, performerNames)` helper that mirrors the old `linkSidecarMetadata` but writes to the typed join tables (`video_episode_performers` / `video_movie_performers` / etc.).
14. **Enqueue downstream jobs** — the existing `enqueuePendingSceneJob` helper takes a `sceneId`; it needs to learn about `videoEpisodeId` and `videoMovieId`. The cleanest path is to add a new `enqueuePendingVideoJob(queueName, entityKind, entityId, trigger)` helper in `apps/worker/src/lib/enqueue.ts` that takes an entity kind and id. The downstream processors (`media-probe`, `fingerprint`, `preview`, `trickplay`) will need matching updates to read the new entity kinds — **this is out of scope for D2**. For now, enqueue a log-and-skip placeholder, OR leave the downstream jobs unqueued with a `// TODO: Plan D3 wires these up` comment.
15. **Update library_roots.lastScannedAt** via an UPDATE.
16. **Do NOT** call `syncSceneFoldersForRoot`. Do NOT enqueue `gallery-scan` or `audio-scan` in this function; those continue to run independently from their own scheduler entries.
17. Do NOT touch `scenes` or `scene_folders` tables in any way.

- [ ] **Step 3: Replace `library-scan.ts` with a re-export shim**

Replace the entire contents of `apps/worker/src/processors/library-scan.ts` with:

```ts
export { processLibraryScan } from "./library-scan-video";
```

This keeps the existing `runtime.ts` registration (`"library-scan": processLibraryScan`) working without changes.

- [ ] **Step 4: Delete the lockdown guard**

Delete `apps/worker/src/lib/lockdown.ts`. The new scan doesn't need it.

If any existing test imports from that file, update the test imports to remove the dependency.

- [ ] **Step 5: Typecheck and smoke**

```bash
pnpm --filter @obscura/worker typecheck
pnpm typecheck
```

Both must pass. If downstream-job enqueueing doesn't compile because the helpers have typed `sceneId` arguments, use the TODO-comment approach from Step 2 item 14 and leave them unqueued in Plan D2.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/processors/library-scan.ts apps/worker/src/processors/library-scan-video.ts
git rm apps/worker/src/lib/lockdown.ts
git commit -m "feat(worker): new library-scan pipeline writes to video_* tables"
```

---

### Task 2: `acceptSeriesScrape` handler

**Files:**
- Modify: `apps/api/src/services/scrape-accept.service.ts` (append `acceptSeriesScrape`)

- [ ] **Step 1: Append the handler to the existing service file**

At the end of `apps/api/src/services/scrape-accept.service.ts`, add:

```ts
import {
  videoSeries,
  videoSeasons,
} from "@obscura/db/src/schema";
import type { NormalizedSeriesResult } from "@obscura/contracts";

export interface CascadeAcceptSpec {
  acceptAllSeasons?: boolean;
  seasonOverrides?: Record<
    number,
    {
      accepted: boolean;
      fieldMask?: AcceptFieldMask;
      episodes?: Record<
        number,
        {
          accepted: boolean;
          fieldMask?: AcceptFieldMask;
        }
      >;
    }
  >;
}

export interface AcceptSeriesInput {
  scrapeResultId: string;
  seriesId: string;
  result: NormalizedSeriesResult;
  fieldMask?: AcceptFieldMask;
  cascade?: CascadeAcceptSpec;
}

export async function acceptSeriesScrape(
  input: AcceptSeriesInput,
): Promise<{ episodesUpdated: number; seasonsUpdated: number }> {
  const mask = applyMask(input.fieldMask);
  const patch: Record<string, unknown> = {};
  if (mask.title) patch.title = input.result.title;
  if (mask.overview) patch.overview = input.result.overview;
  if (mask.tagline) patch.tagline = input.result.tagline;
  if (mask.releaseDate) patch.firstAirDate = input.result.firstAirDate;
  if (mask.externalIds) patch.externalIds = input.result.externalIds;
  if (mask.studio && input.result.studioName) {
    patch.studioId = await upsertStudioByName(input.result.studioName);
  }
  patch.organized = true;
  patch.updatedAt = new Date();

  if (Object.keys(patch).length > 0) {
    await db.update(videoSeries).set(patch).where(eq(videoSeries.id, input.seriesId));
  }

  if (mask.genres && input.result.genres.length > 0) {
    for (const genre of input.result.genres) {
      const tagId = await upsertTagByName(genre);
      await db
        .insert(videoSeriesTags)
        .values({ seriesId: input.seriesId, tagId })
        .onConflictDoNothing();
    }
  }

  if (mask.cast && input.result.cast && input.result.cast.length > 0) {
    for (const member of input.result.cast) {
      const performerId = await upsertPerformerByName(member.name);
      await db
        .insert(videoSeriesPerformers)
        .values({
          seriesId: input.seriesId,
          performerId,
          character: member.character ?? null,
          order: member.order ?? null,
        })
        .onConflictDoNothing();
    }
  }

  let seasonsUpdated = 0;
  let episodesUpdated = 0;

  if (input.cascade && input.result.seasons.length > 0) {
    const existingSeasons = await db
      .select({ id: videoSeasons.id, seasonNumber: videoSeasons.seasonNumber })
      .from(videoSeasons)
      .where(eq(videoSeasons.seriesId, input.seriesId));

    for (const proposedSeason of input.result.seasons) {
      const override = input.cascade.seasonOverrides?.[proposedSeason.seasonNumber];
      const acceptThisSeason =
        input.cascade.acceptAllSeasons ||
        (override?.accepted ?? input.cascade.acceptAllSeasons ?? true);
      if (!acceptThisSeason) continue;

      const existingSeason = existingSeasons.find(
        (s) => s.seasonNumber === proposedSeason.seasonNumber,
      );
      if (!existingSeason) continue;

      const seasonPatch: Record<string, unknown> = {};
      const seasonMask = applyMask(override?.fieldMask);
      if (seasonMask.title) seasonPatch.title = proposedSeason.title;
      if (seasonMask.overview) seasonPatch.overview = proposedSeason.overview;
      if (seasonMask.airDate) seasonPatch.airDate = proposedSeason.airDate;
      if (seasonMask.externalIds) seasonPatch.externalIds = proposedSeason.externalIds;
      seasonPatch.updatedAt = new Date();

      await db
        .update(videoSeasons)
        .set(seasonPatch)
        .where(eq(videoSeasons.id, existingSeason.id));
      seasonsUpdated += 1;

      if (proposedSeason.episodes.length > 0) {
        const existingEpisodes = await db
          .select({
            id: videoEpisodes.id,
            episodeNumber: videoEpisodes.episodeNumber,
          })
          .from(videoEpisodes)
          .where(eq(videoEpisodes.seasonId, existingSeason.id));

        for (const proposedEp of proposedSeason.episodes) {
          const epOverride = override?.episodes?.[proposedEp.episodeNumber];
          const acceptThisEpisode = epOverride?.accepted ?? true;
          if (!acceptThisEpisode) continue;

          const existingEp = existingEpisodes.find(
            (e) => e.episodeNumber === proposedEp.episodeNumber,
          );
          if (!existingEp) continue;

          const epPatch: Record<string, unknown> = {};
          const epMask = applyMask(epOverride?.fieldMask);
          if (epMask.title) epPatch.title = proposedEp.title;
          if (epMask.overview) epPatch.overview = proposedEp.overview;
          if (epMask.airDate) epPatch.airDate = proposedEp.airDate;
          if (epMask.runtime) epPatch.runtime = proposedEp.runtime;
          if (epMask.externalIds) epPatch.externalIds = proposedEp.externalIds;
          epPatch.organized = true;
          epPatch.updatedAt = new Date();

          await db
            .update(videoEpisodes)
            .set(epPatch)
            .where(eq(videoEpisodes.id, existingEp.id));
          episodesUpdated += 1;
        }
      }
    }
  }

  await db
    .update(scrapeResults)
    .set({ status: "accepted", appliedAt: new Date(), updatedAt: new Date() })
    .where(eq(scrapeResults.id, input.scrapeResultId));

  return { seasonsUpdated, episodesUpdated };
}
```

Import `videoSeriesTags` and `videoSeriesPerformers` from the schema alongside the existing imports.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @obscura/api typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/services/scrape-accept.service.ts
git commit -m "feat(api): add acceptSeriesScrape with cascade support"
```

---

### Task 3: HTTP route for series accept

**Files:**
- Modify: `apps/api/src/routes/video-accept.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Add route constant**

In `packages/contracts/src/index.ts`, add to `apiRoutes`:

```ts
  videoSeriesAcceptScrape: "/video/series/:id/accept-scrape",
```

- [ ] **Step 2: Add route handler**

In `apps/api/src/routes/video-accept.ts`, add:

```ts
import {
  acceptSeriesScrape,
  type CascadeAcceptSpec,
} from "../services/scrape-accept.service";
import type { NormalizedSeriesResult } from "@obscura/contracts";

// Inside the videoAcceptRoutes function, after the existing episode route:

  app.post(apiRoutes.videoSeriesAcceptScrape, async (request, reply) => {
    const { id: seriesId } = request.params as { id: string };
    const body = request.body as AcceptBody & { cascade?: CascadeAcceptSpec };
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
    const counts = await acceptSeriesScrape({
      scrapeResultId: body.scrapeResultId,
      seriesId,
      result: proposed as NormalizedSeriesResult,
      fieldMask: body.fieldMask,
      cascade: body.cascade,
    });
    return { ok: true, ...counts };
  });
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @obscura/api typecheck
pnpm --filter @obscura/contracts typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/src/index.ts apps/api/src/routes/video-accept.ts
git commit -m "feat(api): add /video/series/:id/accept-scrape route"
```

---

### Task 4: Migration banner React component

**Files:**
- Create: `apps/web/src/lib/api/system.ts`
- Create: `apps/web/src/components/system/migration-banner.tsx`
- Modify: `apps/web/src/components/app-shell.tsx`

- [ ] **Step 1: Write the web API client**

Create `apps/web/src/lib/api/system.ts`:

```ts
import { apiBaseUrl } from "./config";

export interface SystemStatus {
  migrations: Array<{
    name: string;
    description: string;
    status:
      | "pending"
      | "staging"
      | "staged"
      | "finalizing"
      | "complete"
      | "failed";
  }>;
  lockdown: {
    active: boolean;
    blockedBy: string | null;
    blockingStatus: string | null;
  };
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch(`${apiBaseUrl}/system/status`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json();
}

export async function finalizeMigration(name: string): Promise<void> {
  const res = await fetch(
    `${apiBaseUrl}/system/migrations/${encodeURIComponent(name)}/finalize`,
    { method: "POST" },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `status ${res.status}`);
  }
}
```

If the project's API client uses a different base-URL import path, find it and use it. Check one of the existing files in `apps/web/src/lib/api/` for the pattern.

- [ ] **Step 2: Write the banner component**

Create `apps/web/src/components/system/migration-banner.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import {
  fetchSystemStatus,
  finalizeMigration,
  type SystemStatus,
} from "@/lib/api/system";

export function MigrationBanner() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSystemStatus()
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(() => {
        /* keep banner hidden on error */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;
  const staged = status.migrations.find((m) => m.status === "staged");
  if (!staged) return null;

  const handleFinalize = async () => {
    if (
      !window.confirm(
        `Finalize "${staged.name}"? This will drop the legacy scenes and scene_folders tables. Your existing UI may break until the new UI is released. This action is irreversible.`,
      )
    ) {
      return;
    }
    setFinalizing(true);
    setError(null);
    try {
      await finalizeMigration(staged.name);
      const next = await fetchSystemStatus();
      setStatus(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <div
      style={{
        borderBottom: "1px solid rgba(196, 154, 90, 0.35)",
        background:
          "linear-gradient(0deg, rgba(196, 154, 90, 0.07), rgba(196, 154, 90, 0.12))",
        padding: "0.75rem 1.25rem",
        color: "var(--text-primary, #e8e4dc)",
        fontFamily: "Inter, sans-serif",
        fontSize: "0.875rem",
      }}
      role="status"
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 auto", minWidth: "20rem" }}>
          <strong style={{ fontFamily: "Geist, sans-serif" }}>
            Migration staged — {staged.name}
          </strong>
          <div style={{ opacity: 0.8, marginTop: "0.125rem" }}>
            {staged.description}
          </div>
          <div style={{ opacity: 0.6, marginTop: "0.25rem", fontSize: "0.75rem" }}>
            Library scans are paused until you finalize. Finalizing drops the
            legacy <code>scenes</code> and <code>scene_folders</code> tables —
            the current UI depends on these and will break until the new UI
            ships. Only finalize if you know what you're doing.
          </div>
          {error && (
            <div style={{ color: "#ff8080", marginTop: "0.25rem" }}>{error}</div>
          )}
        </div>
        <button
          type="button"
          onClick={handleFinalize}
          disabled={finalizing}
          style={{
            borderRadius: 0,
            border: "1px solid rgba(196, 154, 90, 0.6)",
            background: finalizing
              ? "rgba(196, 154, 90, 0.2)"
              : "rgba(196, 154, 90, 0.32)",
            padding: "0.5rem 1rem",
            color: "inherit",
            fontFamily: "Inter, sans-serif",
            fontSize: "0.8125rem",
            fontWeight: 500,
            cursor: finalizing ? "default" : "pointer",
          }}
        >
          {finalizing ? "Finalizing…" : "Finalize migration"}
        </button>
      </div>
    </div>
  );
}
```

The inline styles match the Dark Room token palette by hex approximation so the component doesn't need to touch any design system files. When the UI is properly adapted in a future plan, this banner should be rewritten to use the real CSS classes / design tokens.

- [ ] **Step 3: Wire it into `app-shell.tsx`**

Find `apps/web/src/components/app-shell.tsx` (around line 48 per the exploration). Locate where `<CanvasHeader />` is rendered inside `AppShellMain`. Add an import:

```tsx
import { MigrationBanner } from "./system/migration-banner";
```

And add the banner directly above `<CanvasHeader />`:

```tsx
<MigrationBanner />
<CanvasHeader ... />
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @obscura/web typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api/system.ts apps/web/src/components/system/migration-banner.tsx apps/web/src/components/app-shell.tsx
git commit -m "feat(web): add migration banner component"
```

---

### Task 5: `docs/library-organization.md`

**Files:**
- Create: `docs/library-organization.md`

- [ ] **Step 1: Write the user-facing docs**

Write a single markdown file at `docs/library-organization.md` covering:

1. One-paragraph intro: "Obscura organizes video libraries into Movies and Series."
2. The two toggles (`scanMovies`, `scanSeries`) and what they control.
3. The rule: files at root → movies, files one level deep → flat series, files two levels deep → seasoned series, depth≥3 → rejected.
4. Good layout examples as markdown code trees:
   - Movies-only library
   - Flat series (Case A)
   - Series with seasons (Case B)
   - Mixed library
   - Specials folder
5. Bad layouts and what happens (depth too deep, loose file with scanMovies off).
6. Filename conventions table.
7. Metadata source priority (NFO → JSON sidecar → filename parser).

Keep it to ~200 lines. Use the structure from spec Section 9.9 verbatim if it helps.

- [ ] **Step 2: Commit**

```bash
git add docs/library-organization.md
git commit -m "docs: library organization rules for series and movies"
```

---

### Task 6: CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add entries under `## [Unreleased]`**

Under `### What's New`, add:

```markdown
- **Migration banner now visible in the app.** If Obscura detects a staged data migration, a brass-accented banner appears at the top of every page with a short description and a "Finalize migration" button. Finalizing drops the legacy `scenes` and `scene_folders` tables — the current UI depends on these, so clicking it will break the existing views until the new UI ships. The banner's warning text makes that tradeoff explicit.
- **Library organization guide** — new `docs/library-organization.md` explains how files under a library root are classified into movies, flat series, and seasoned series, with good/bad layout examples and filename convention tips.
```

Under `### Added`, add:

```markdown
- **New `processLibraryScan` pipeline** — replaces the old scan with one that writes directly to `video_series` / `video_seasons` / `video_episodes` / `video_movies`. Uses `classifyVideoFile` for per-file routing and builds the series tree up front. The worker's obsolete `lib/lockdown.ts` is removed; the new pipeline is safe to run during the staged state because it targets the new tables.
- **`acceptSeriesScrape` cascade handler** in `apps/api/src/services/scrape-accept.service.ts` — accepts a `NormalizedSeriesResult` with optional `CascadeAcceptSpec` that walks the cascade tree, applying series, season, and episode field masks. Upserts performers/tags/studios on the way.
- **`POST /video/series/:id/accept-scrape` route** — HTTP entry point for the cascade accept handler. Consumes a `scrapeResultId`, optional `fieldMask`, and optional `cascade` spec.
- **`/system/status` and migration-finalize web API client** in `apps/web/src/lib/api/system.ts` — typed wrappers for the existing backend endpoints, consumed by the new migration banner.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for Plan D2 completion"
```

---

## Final verification

```bash
pnpm typecheck
pnpm test:unit
git log --oneline main..HEAD | wc -l
```

Expected: all green, ~6-7 commits.

---

## Notes

- **Downstream jobs are unwired.** The new scan pipeline enqueues nothing for `media-probe`, `fingerprint`, `preview`, `trickplay` because those processors still expect `sceneId`. Adapting them is Plan D3's job. In the meantime, new episodes/movies that appear will have file metadata from the scan but no probe/fingerprint/preview generation. Manually running the legacy probe against scenes will no longer work either — the scenes table is frozen.
- **UI still reads from `scenes`/`scene_folders`.** Until Plan D3 adapts `lib/api/media.ts` + the 58 affected files, the existing pages render the frozen legacy state. New content shows up in the database but not in the UI. This is the explicit trade-off.
- **Do NOT click Finalize on production data in this state.** The banner warns about this; the warning is real. Finalize drops the legacy tables; the UI depends on them.
