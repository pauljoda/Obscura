# Video Series Model — Plan C: Plugin Contract Rework

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Land the plugin contract pieces that the new video model needs — new `Normalized*Result` types for movie/series/season/episode, new plugin capability flags, an `ImageCandidate` shape for multi-image pickers, new normalizer functions with tests, and a schema migration that adds `proposed_result` + `cascade_parent_id` columns to `scrape_results`. Everything stays additive; the existing scene/folder/gallery/image/audio shapes and their normalizers are untouched.

**Architecture:** Pure type and schema additions. No changes to executor dispatch, accept flow, or the MovieDB plugin itself. Plan D consumes these types to build the cascade review UI and the accept service. The existing plugin contract continues to work exactly as it does today.

**Reference spec:** `docs/superpowers/specs/2026-04-13-video-series-model-design.md`, Section 7.

---

## Scope explicitly cut from Plan C

- **MovieDB plugin source.** Lives in a sibling repo (`obscura-community-plugins`). Plan C does not touch it. When the plugin's maintainer is ready, they adopt the new capability flags and normalized shapes.
- **Accept service.** `scrape-accept.service.ts` and the HTTP routes that call it are deferred to Plan D, where the UI that consumes them also lands.
- **Stash-compat adapter updates.** Stays as-is. Stash plugins continue returning scene shapes; the current adapter handles them.
- **Web UI.** Plan D.
- **Removal of existing `proposed_*` columns.** Adding a new column is additive; the old ones stay until the UI stops reading them.

---

## File Structure

### New files

- `packages/plugins/src/normalized-video.ts` — new `NormalizedMovieResult`, `NormalizedSeriesResult`, `NormalizedSeasonResult`, `NormalizedEpisodeResult`, and `ImageCandidate` types, plus normalizer functions and tests.
- `packages/plugins/src/normalized-video.test.ts` — unit tests for the four normalizers.
- `apps/api/drizzle/0011_<drizzle-name>.sql` — generated migration adding `proposed_result` JSONB and `cascade_parent_id` FK columns to `scrape_results`.

### Modified files

- `packages/plugins/src/types.ts` — extend `PluginCapabilities` with the new capability keys; append `pluginCapabilityKeys` (used by the manifest parser).
- `packages/plugins/src/index.ts` — re-export from the new `normalized-video` module.
- `packages/db/src/schema.ts` — add two new columns to `scrapeResults`.
- `apps/api/src/db/migrate.ts` — add `LEGACY_SCHEMA_SENTINELS` entry for migration 0011.
- `packages/contracts/src/index.ts` — re-export the new types from `@obscura/plugins` so Plan D's web UI and `scrape-accept.service.ts` can import them.
- `CHANGELOG.md` — document the additions.

---

## Task list

### Task 1: New capability keys on `PluginCapabilities`

**Files:**
- Modify: `packages/plugins/src/types.ts`

- [ ] **Step 1: Add new capability fields**

Find the `PluginCapabilities` interface in `packages/plugins/src/types.ts`. Add these fields to the interface:

```ts
  // Movies — Plan C
  movieByName?: boolean;
  movieByURL?: boolean;
  movieByFragment?: boolean;

  // Series (show-level lookup)
  seriesByName?: boolean;
  seriesByURL?: boolean;
  seriesByFragment?: boolean;

  // Series cascade (returns full season+episode tree)
  seriesCascade?: boolean;

  // Episode per-file lookup
  episodeByName?: boolean;
  episodeByFragment?: boolean;
```

Also find `pluginCapabilityKeys` (array of capability key strings, used by the manifest parser validation) and append all nine new keys to it in the same order.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @obscura/plugins typecheck
```

- [ ] **Step 3: Commit**

```bash
git add packages/plugins/src/types.ts
git commit -m "feat(plugins): add movie/series/episode capability flags"
```

---

### Task 2: Video normalization types and normalizer functions (TDD)

**Files:**
- Create: `packages/plugins/src/normalized-video.ts`
- Create: `packages/plugins/src/normalized-video.test.ts`

- [ ] **Step 1: Write the failing test**

Write `packages/plugins/src/normalized-video.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  normalizeImageCandidate,
  normalizeMovieResult,
  normalizeSeriesResult,
  normalizeSeasonResult,
  normalizeEpisodeResult,
} from "./normalized-video";

describe("normalizeImageCandidate", () => {
  it("returns null for non-object input", () => {
    expect(normalizeImageCandidate(null)).toBeNull();
    expect(normalizeImageCandidate("https://x.com/img.jpg")).toBeNull();
  });

  it("requires a valid URL", () => {
    expect(normalizeImageCandidate({ url: "" })).toBeNull();
    expect(normalizeImageCandidate({ url: "not-a-url" })).toBeNull();
  });

  it("extracts the full candidate shape", () => {
    const result = normalizeImageCandidate({
      url: "https://image.tmdb.org/t/p/original/abc.jpg",
      language: "en",
      width: 1920,
      height: 1080,
      aspectRatio: 1.78,
      rank: 8.5,
      source: "tmdb",
    });
    expect(result).toEqual({
      url: "https://image.tmdb.org/t/p/original/abc.jpg",
      language: "en",
      width: 1920,
      height: 1080,
      aspectRatio: 1.78,
      rank: 8.5,
      source: "tmdb",
    });
  });

  it("defaults source to 'unknown' if missing", () => {
    const result = normalizeImageCandidate({
      url: "https://image.tmdb.org/x.jpg",
    });
    expect(result?.source).toBe("unknown");
  });
});

describe("normalizeMovieResult", () => {
  it("returns null for non-object input", () => {
    expect(normalizeMovieResult(null)).toBeNull();
    expect(normalizeMovieResult("Heat")).toBeNull();
  });

  it("extracts a minimal movie shape", () => {
    const result = normalizeMovieResult({
      title: "Heat",
      releaseDate: "1995-12-15",
      overview: "A master thief...",
    });
    expect(result?.title).toBe("Heat");
    expect(result?.releaseDate).toBe("1995-12-15");
    expect(result?.overview).toBe("A master thief...");
    expect(result?.posterCandidates).toEqual([]);
  });

  it("normalizes image candidate arrays", () => {
    const result = normalizeMovieResult({
      title: "Heat",
      posterCandidates: [
        { url: "https://image.tmdb.org/t/p/original/poster1.jpg", rank: 9 },
        { url: "https://image.tmdb.org/t/p/original/poster2.jpg", rank: 7 },
        { url: "" }, // dropped
      ],
    });
    expect(result?.posterCandidates.length).toBe(2);
  });

  it("deduplicates tag and cast lists case-insensitively", () => {
    const result = normalizeMovieResult({
      title: "Heat",
      genres: ["Crime", "crime", "Drama"],
      cast: [
        { name: "Al Pacino", character: "Hanna" },
        { name: "AL PACINO", character: "Other" },
        { name: "Robert De Niro" },
      ],
    });
    expect(result?.genres.length).toBe(2);
    expect(result?.cast?.length).toBe(2);
  });

  it("reads external_ids as a string map", () => {
    const result = normalizeMovieResult({
      title: "Heat",
      externalIds: { tmdb: "949", imdb: "tt0113277" },
    });
    expect(result?.externalIds).toEqual({ tmdb: "949", imdb: "tt0113277" });
  });
});

describe("normalizeSeriesResult", () => {
  it("returns null for non-object input", () => {
    expect(normalizeSeriesResult(null)).toBeNull();
  });

  it("extracts a shallow series without seasons", () => {
    const result = normalizeSeriesResult({
      title: "Breaking Bad",
      firstAirDate: "2008-01-20",
      status: "ended",
    });
    expect(result?.title).toBe("Breaking Bad");
    expect(result?.firstAirDate).toBe("2008-01-20");
    expect(result?.status).toBe("ended");
    expect(result?.seasons).toEqual([]);
  });

  it("recursively normalizes nested seasons and episodes (cascade)", () => {
    const result = normalizeSeriesResult({
      title: "Breaking Bad",
      seasons: [
        {
          seasonNumber: 1,
          title: "Season 1",
          episodes: [
            { seasonNumber: 1, episodeNumber: 1, title: "Pilot" },
            { seasonNumber: 1, episodeNumber: 2, title: "Cat's in the Bag" },
          ],
        },
      ],
    });
    expect(result?.seasons.length).toBe(1);
    expect(result?.seasons[0].seasonNumber).toBe(1);
    expect(result?.seasons[0].episodes.length).toBe(2);
    expect(result?.seasons[0].episodes[0].title).toBe("Pilot");
  });

  it("preserves candidate lists for disambiguation", () => {
    const result = normalizeSeriesResult({
      title: "The Office",
      candidates: [
        { externalIds: { tmdb: "2316" }, title: "The Office (US)", year: 2005 },
        { externalIds: { tmdb: "2996" }, title: "The Office (UK)", year: 2001 },
      ],
    });
    expect(result?.candidates?.length).toBe(2);
    expect(result?.candidates?.[0].year).toBe(2005);
  });
});

describe("normalizeSeasonResult", () => {
  it("returns null for non-object input", () => {
    expect(normalizeSeasonResult(null)).toBeNull();
  });

  it("extracts a season shape with episodes", () => {
    const result = normalizeSeasonResult({
      seasonNumber: 1,
      title: "Season 1",
      airDate: "2008-01-20",
      episodes: [{ seasonNumber: 1, episodeNumber: 1, title: "Pilot" }],
    });
    expect(result?.seasonNumber).toBe(1);
    expect(result?.title).toBe("Season 1");
    expect(result?.episodes.length).toBe(1);
  });

  it("defaults seasonNumber to 0 when missing", () => {
    const result = normalizeSeasonResult({ title: "Specials" });
    expect(result?.seasonNumber).toBe(0);
  });
});

describe("normalizeEpisodeResult", () => {
  it("returns null for non-object input", () => {
    expect(normalizeEpisodeResult(null)).toBeNull();
  });

  it("extracts a full episode shape", () => {
    const result = normalizeEpisodeResult({
      seasonNumber: 1,
      episodeNumber: 2,
      absoluteEpisodeNumber: 2,
      title: "Cat's in the Bag",
      airDate: "2008-01-27",
      runtime: 48,
      stillCandidates: [
        { url: "https://image.tmdb.org/t/p/w780/still.jpg" },
      ],
      matched: true,
    });
    expect(result?.seasonNumber).toBe(1);
    expect(result?.episodeNumber).toBe(2);
    expect(result?.absoluteEpisodeNumber).toBe(2);
    expect(result?.title).toBe("Cat's in the Bag");
    expect(result?.runtime).toBe(48);
    expect(result?.stillCandidates.length).toBe(1);
    expect(result?.matched).toBe(true);
  });

  it("defaults matched to undefined when missing", () => {
    const result = normalizeEpisodeResult({
      seasonNumber: 1,
      episodeNumber: 1,
    });
    expect(result?.matched).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
pnpm --filter @obscura/plugins test -- normalized-video
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Write the implementation**

Write `packages/plugins/src/normalized-video.ts`:

```ts
/**
 * Normalized shapes for the video subsystem's new typed results:
 * movie, series (with optional cascade children), season, episode.
 * Paired normalizer functions convert raw plugin output into these
 * shapes, mirroring the style of the existing per-entity normalizers
 * in ./normalizer.ts — trim strings, drop empties, validate URLs,
 * deduplicate case-insensitively, preserve external_ids as-is.
 *
 * These types coexist with the existing NormalizedVideoResult /
 * NormalizedFolderResult / NormalizedGalleryResult / etc. types; they
 * are additive, not replacements, because the existing shapes are
 * still used by legacy scene/folder/gallery flows that Plan D will
 * retire once the UI has adapted.
 */

export interface ImageCandidate {
  url: string;
  language?: string | null;
  width?: number;
  height?: number;
  aspectRatio?: number;
  rank?: number;
  source: string;
}

export interface NormalizedCastMember {
  name: string;
  character?: string | null;
  order?: number | null;
}

export interface NormalizedMovieResult {
  title: string;
  originalTitle?: string | null;
  overview?: string | null;
  tagline?: string | null;
  releaseDate?: string | null;
  runtime?: number | null;
  genres: string[];
  studioName?: string | null;
  cast?: NormalizedCastMember[];
  posterCandidates: ImageCandidate[];
  backdropCandidates: ImageCandidate[];
  logoCandidates: ImageCandidate[];
  externalIds: Record<string, string>;
  rating?: number | null;
  contentRating?: string | null;
}

export interface NormalizedSeriesResult {
  title: string;
  originalTitle?: string | null;
  overview?: string | null;
  tagline?: string | null;
  firstAirDate?: string | null;
  endAirDate?: string | null;
  status?: "returning" | "ended" | "canceled" | "unknown" | null;
  genres: string[];
  studioName?: string | null;
  cast?: NormalizedCastMember[];
  posterCandidates: ImageCandidate[];
  backdropCandidates: ImageCandidate[];
  logoCandidates: ImageCandidate[];
  externalIds: Record<string, string>;
  seasons: NormalizedSeasonResult[];
  candidates?: NormalizedSeriesCandidate[];
}

export interface NormalizedSeriesCandidate {
  externalIds: Record<string, string>;
  title: string;
  year?: number | null;
  overview?: string | null;
  posterUrl?: string | null;
  popularity?: number | null;
}

export interface NormalizedSeasonResult {
  seasonNumber: number;
  title?: string | null;
  overview?: string | null;
  airDate?: string | null;
  posterCandidates: ImageCandidate[];
  externalIds: Record<string, string>;
  episodes: NormalizedEpisodeResult[];
}

export interface NormalizedEpisodeResult {
  seasonNumber: number;
  episodeNumber: number;
  absoluteEpisodeNumber?: number | null;
  title?: string | null;
  overview?: string | null;
  airDate?: string | null;
  runtime?: number | null;
  stillCandidates: ImageCandidate[];
  guestStars?: NormalizedCastMember[];
  externalIds: Record<string, string>;
  matched?: boolean;
  localFilePath?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toIntOrNull(value: unknown): number | null {
  const n = toNumberOrNull(value);
  if (n === null) return null;
  return Number.isInteger(n) ? n : Math.trunc(n);
}

function toBooleanOrUndefined(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  return undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const normalized = toStringOrNull(item);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function toExternalIds(value: unknown): Record<string, string> {
  if (!isObject(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    const trimmedKey = key.trim();
    const trimmedValue = toStringOrNull(raw);
    if (!trimmedKey || !trimmedValue) continue;
    out[trimmedKey] = trimmedValue;
  }
  return out;
}

function isValidUrl(value: string): boolean {
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:image/")
  );
}

export function normalizeImageCandidate(value: unknown): ImageCandidate | null {
  if (!isObject(value)) return null;
  const url = toStringOrNull(value.url);
  if (!url || !isValidUrl(url)) return null;
  return {
    url,
    language: toStringOrNull(value.language),
    width: toIntOrNull(value.width) ?? undefined,
    height: toIntOrNull(value.height) ?? undefined,
    aspectRatio: toNumberOrNull(value.aspectRatio) ?? undefined,
    rank: toNumberOrNull(value.rank) ?? undefined,
    source: toStringOrNull(value.source) ?? "unknown",
  };
}

function toImageCandidates(value: unknown): ImageCandidate[] {
  if (!Array.isArray(value)) return [];
  const out: ImageCandidate[] = [];
  for (const raw of value) {
    const candidate = normalizeImageCandidate(raw);
    if (candidate) out.push(candidate);
  }
  return out;
}

function toCastMembers(value: unknown): NormalizedCastMember[] {
  if (!Array.isArray(value)) return [];
  const out: NormalizedCastMember[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!isObject(raw)) continue;
    const name = toStringOrNull(raw.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      character: toStringOrNull(raw.character),
      order: toIntOrNull(raw.order),
    });
  }
  return out;
}

// ─── Public normalizers ─────────────────────────────────────────────

export function normalizeMovieResult(raw: unknown): NormalizedMovieResult | null {
  if (!isObject(raw)) return null;
  const title = toStringOrNull(raw.title);
  if (!title) return null;
  return {
    title,
    originalTitle: toStringOrNull(raw.originalTitle),
    overview: toStringOrNull(raw.overview),
    tagline: toStringOrNull(raw.tagline),
    releaseDate: toStringOrNull(raw.releaseDate),
    runtime: toIntOrNull(raw.runtime),
    genres: toStringArray(raw.genres),
    studioName: toStringOrNull(raw.studioName),
    cast: toCastMembers(raw.cast),
    posterCandidates: toImageCandidates(raw.posterCandidates),
    backdropCandidates: toImageCandidates(raw.backdropCandidates),
    logoCandidates: toImageCandidates(raw.logoCandidates),
    externalIds: toExternalIds(raw.externalIds),
    rating: toNumberOrNull(raw.rating),
    contentRating: toStringOrNull(raw.contentRating),
  };
}

export function normalizeEpisodeResult(raw: unknown): NormalizedEpisodeResult | null {
  if (!isObject(raw)) return null;
  const seasonNumber = toIntOrNull(raw.seasonNumber) ?? 0;
  const episodeNumber = toIntOrNull(raw.episodeNumber);
  if (episodeNumber === null) return null;
  return {
    seasonNumber,
    episodeNumber,
    absoluteEpisodeNumber: toIntOrNull(raw.absoluteEpisodeNumber),
    title: toStringOrNull(raw.title),
    overview: toStringOrNull(raw.overview),
    airDate: toStringOrNull(raw.airDate),
    runtime: toIntOrNull(raw.runtime),
    stillCandidates: toImageCandidates(raw.stillCandidates),
    guestStars: toCastMembers(raw.guestStars),
    externalIds: toExternalIds(raw.externalIds),
    matched: toBooleanOrUndefined(raw.matched),
    localFilePath: toStringOrNull(raw.localFilePath),
  };
}

export function normalizeSeasonResult(raw: unknown): NormalizedSeasonResult | null {
  if (!isObject(raw)) return null;
  const seasonNumber = toIntOrNull(raw.seasonNumber) ?? 0;
  const episodes: NormalizedEpisodeResult[] = Array.isArray(raw.episodes)
    ? raw.episodes
        .map((e) => normalizeEpisodeResult(e))
        .filter((e): e is NormalizedEpisodeResult => e !== null)
    : [];
  return {
    seasonNumber,
    title: toStringOrNull(raw.title),
    overview: toStringOrNull(raw.overview),
    airDate: toStringOrNull(raw.airDate),
    posterCandidates: toImageCandidates(raw.posterCandidates),
    externalIds: toExternalIds(raw.externalIds),
    episodes,
  };
}

export function normalizeSeriesResult(raw: unknown): NormalizedSeriesResult | null {
  if (!isObject(raw)) return null;
  const title = toStringOrNull(raw.title);
  if (!title) return null;

  const seasons: NormalizedSeasonResult[] = Array.isArray(raw.seasons)
    ? raw.seasons
        .map((s) => normalizeSeasonResult(s))
        .filter((s): s is NormalizedSeasonResult => s !== null)
    : [];

  const candidates: NormalizedSeriesCandidate[] | undefined = Array.isArray(
    raw.candidates,
  )
    ? raw.candidates
        .map((c) => {
          if (!isObject(c)) return null;
          const candTitle = toStringOrNull(c.title);
          if (!candTitle) return null;
          return {
            externalIds: toExternalIds(c.externalIds),
            title: candTitle,
            year: toIntOrNull(c.year),
            overview: toStringOrNull(c.overview),
            posterUrl: toStringOrNull(c.posterUrl),
            popularity: toNumberOrNull(c.popularity),
          };
        })
        .filter((c): c is NormalizedSeriesCandidate => c !== null)
    : undefined;

  const status = toStringOrNull(raw.status);
  const validStatus =
    status === "returning" || status === "ended" ||
    status === "canceled" || status === "unknown"
      ? status
      : null;

  return {
    title,
    originalTitle: toStringOrNull(raw.originalTitle),
    overview: toStringOrNull(raw.overview),
    tagline: toStringOrNull(raw.tagline),
    firstAirDate: toStringOrNull(raw.firstAirDate),
    endAirDate: toStringOrNull(raw.endAirDate),
    status: validStatus,
    genres: toStringArray(raw.genres),
    studioName: toStringOrNull(raw.studioName),
    cast: toCastMembers(raw.cast),
    posterCandidates: toImageCandidates(raw.posterCandidates),
    backdropCandidates: toImageCandidates(raw.backdropCandidates),
    logoCandidates: toImageCandidates(raw.logoCandidates),
    externalIds: toExternalIds(raw.externalIds),
    seasons,
    candidates,
  };
}
```

- [ ] **Step 4: Run the test and confirm PASS**

```bash
pnpm --filter @obscura/plugins test -- normalized-video
```

- [ ] **Step 5: Commit**

```bash
git add packages/plugins/src/normalized-video.ts packages/plugins/src/normalized-video.test.ts
git commit -m "feat(plugins): add normalized movie/series/season/episode shapes"
```

---

### Task 3: Re-export video normalizers from plugins index

**Files:**
- Modify: `packages/plugins/src/index.ts`

- [ ] **Step 1: Append the re-export**

Add at the end of `packages/plugins/src/index.ts`:

```ts
export * from "./normalized-video";
```

- [ ] **Step 2: Typecheck and run full plugins test suite**

```bash
pnpm --filter @obscura/plugins typecheck
pnpm --filter @obscura/plugins test
```

Expected: everything green.

- [ ] **Step 3: Commit**

```bash
git add packages/plugins/src/index.ts
git commit -m "feat(plugins): re-export normalized video result types"
```

---

### Task 4: `scrape_results` schema additions

**Files:**
- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Find `scrapeResults` in schema.ts**

```bash
grep -n "scrapeResults = pgTable\|scrape_results" packages/db/src/schema.ts | head -10
```

- [ ] **Step 2: Add two new columns**

Inside the `scrapeResults` `pgTable` definition, add these two new columns after the existing `rawResult` column (or any consistent position — match the file's style):

```ts
    proposedResult: jsonb("proposed_result").$type<Record<string, unknown>>(),
    cascadeParentId: uuid("cascade_parent_id"),
```

The `cascadeParentId` column is a self-referential FK pointing back to another `scrape_results` row. Drizzle self-references are fine at the table-definition level but require `.references(() => scrapeResults.id, { onDelete: "cascade" })` appended to the column. However, Drizzle doesn't cleanly support self-references in a single `pgTable` call on all versions, so the cleanest path is to add the foreign key in the migration SQL by hand, not through drizzle-kit. Define the column as a plain `uuid()` in the schema and append the FK constraint in Step 5 below.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @obscura/db typecheck
```

- [ ] **Step 4: Generate migration**

```bash
pnpm --filter @obscura/api db:generate
```

Expected: drizzle-kit creates `apps/api/drizzle/0011_<name>.sql` containing two `ALTER TABLE "scrape_results" ADD COLUMN` statements.

- [ ] **Step 5: Review and hand-append the self-reference FK**

Open `apps/api/drizzle/0011_<name>.sql`. Confirm it contains only:

```sql
ALTER TABLE "scrape_results" ADD COLUMN "proposed_result" jsonb;
--> statement-breakpoint
ALTER TABLE "scrape_results" ADD COLUMN "cascade_parent_id" uuid;
```

Append a `--> statement-breakpoint` and then the FK constraint:

```sql
--> statement-breakpoint
ALTER TABLE "scrape_results"
  ADD CONSTRAINT "scrape_results_cascade_parent_id_fk"
  FOREIGN KEY ("cascade_parent_id")
  REFERENCES "scrape_results"("id")
  ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scrape_results_cascade_parent_idx"
  ON "scrape_results" ("cascade_parent_id");
```

**Review checklist** (per CLAUDE.md):
- No `DROP TABLE`.
- No `DROP COLUMN`.
- No column renames.
- The existing `proposed_*` columns (proposedTitle, proposedDate, etc.) are NOT touched — they stay as-is.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema.ts apps/api/drizzle/0011_*.sql apps/api/drizzle/meta/_journal.json apps/api/drizzle/meta/0011_snapshot.json
git commit -m "feat(db): add proposed_result and cascade_parent_id to scrape_results"
```

---

### Task 5: `LEGACY_SCHEMA_SENTINELS` entry for 0011

**Files:**
- Modify: `apps/api/src/db/migrate.ts`

- [ ] **Step 1: Find the generated migration filename**

```bash
ls apps/api/drizzle/0011_*.sql | sed 's|.*/||; s|\.sql$||'
```

- [ ] **Step 2: Add the sentinel**

In `apps/api/src/db/migrate.ts`, add a new entry inside `LEGACY_SCHEMA_SENTINELS` after the existing `0010_natural_meteorite` entry. Use the filename from step 1:

```ts
  "0010_natural_meteorite": (c) => tableExists(c, "video_series"),
  "0011_<filename-from-step-1>": (c) =>
    columnExists(c, "scrape_results", "proposed_result"),
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @obscura/api typecheck
```

- [ ] **Step 4: Apply the migration locally**

```bash
pnpm --filter @obscura/api db:migrate
```

Expected: `Migrations up to date` with no errors.

- [ ] **Step 5: Verify the new columns exist**

```bash
docker compose -f infra/docker/docker-compose.yml exec -T postgres psql -U obscura -d obscura -c "\d scrape_results" | grep -E "proposed_result|cascade_parent_id"
```

Expected: both columns listed.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/db/migrate.ts
git commit -m "feat(api): add legacy schema sentinel for migration 0011"
```

---

### Task 6: Re-export from `@obscura/contracts`

**Files:**
- Modify: `packages/contracts/src/index.ts`

The new normalized video types need to be importable from `@obscura/contracts` so Plan D's web UI and accept service can consume them without depending on the plugins engine.

- [ ] **Step 1: Add a one-line re-export**

At the end of `packages/contracts/src/index.ts`, add:

```ts
export type {
  ImageCandidate,
  NormalizedCastMember,
  NormalizedMovieResult,
  NormalizedSeriesResult,
  NormalizedSeriesCandidate,
  NormalizedSeasonResult,
  NormalizedEpisodeResult,
} from "@obscura/plugins";
```

This is a type-only re-export — zero runtime cost. If `@obscura/contracts` does not currently depend on `@obscura/plugins`, check `packages/contracts/package.json`. If the dependency is missing, add it as a workspace dependency:

```json
"dependencies": {
  "@obscura/plugins": "workspace:*"
}
```

If adding the dep creates a circular dependency (plugins → contracts → plugins), reverse the direction: define the types in `@obscura/contracts` first, then re-export them from `@obscura/plugins`. Report which direction you ended up going.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @obscura/contracts typecheck
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add packages/contracts/src/index.ts packages/contracts/package.json
git commit -m "feat(contracts): re-export normalized video result types"
```

---

### Task 7: CHANGELOG entry

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add entries under `## [Unreleased]` → `### Added`**

```markdown
- **Normalized movie/series/season/episode result types** in `@obscura/plugins` — new `NormalizedMovieResult`, `NormalizedSeriesResult` (with optional cascade children), `NormalizedSeasonResult`, `NormalizedEpisodeResult`, and `ImageCandidate` shapes, plus normalizer functions that trim/validate/dedupe plugin output in the same style as the existing scene/folder normalizers. Re-exported from `@obscura/contracts` for consumption by the web UI and the upcoming scrape-accept service.
- **New plugin capability flags** for `movieByName` / `movieByURL` / `movieByFragment`, `seriesByName` / `seriesByURL` / `seriesByFragment`, `seriesCascade`, and `episodeByName` / `episodeByFragment`. Plugins can now declare that they return movie- or series-shaped data. Existing scene/folder/gallery capabilities are unchanged.
- **`scrape_results.proposed_result` JSONB column and `cascade_parent_id` self-reference** — the proposed_result column holds the full typed normalized result for video-subsystem scrapes, and cascade_parent_id links child season/episode scrape rows to their parent series scrape so the review UI can walk the cascade tree. Migration `0011` adds these columns non-destructively; the existing `proposed_*` columns stay in place for legacy consumers.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for Plan C plugin contract additions"
```

---

## Final verification

- [ ] **Step 1: Full workspace typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 2: Unit tests**

```bash
pnpm test:unit
```

Expected: all green, including the ~20 new normalizer tests from Task 2.

- [ ] **Step 3: Commit count**

```bash
git log --oneline main..HEAD | wc -l
```

Expected: ~7 commits.

---

## Notes for the implementing engineer

- **Do not** modify `packages/plugins/src/normalizer.ts` or the existing `NormalizedVideoResult`/`NormalizedFolderResult`/etc. types. They continue to serve the legacy scene/folder/gallery flows until Plan D adapts the UI and retires them.
- **Do not** modify `apps/api/src/routes/plugins.ts` or the existing accept flow. Plan D adds the new accept service.
- **Do not** modify the MovieDB plugin — it lives in a sibling repo and is updated independently.
- `cascade_parent_id` requires a self-reference FK. Drizzle's `pgTable` definition gets the column typed correctly as `uuid`, but the FK constraint is added by hand in the generated SQL because drizzle-kit's self-reference support is finicky across versions. This is the same "hand-append" pattern used for the `external_ids->>'tmdb'` functional indexes in migration 0010.
- The normalizers follow the existing style in `packages/plugins/src/normalizer.ts`: trim strings, drop empties, validate URLs, deduplicate case-insensitively, return `null` when the input is malformed. Do not add zod or any validation library; the codebase intentionally uses hand-written normalization.
- External IDs normalization is shared across the four new result types. The helper `toExternalIds` (defined in `normalized-video.ts`) accepts any object and returns a sanitized `Record<string, string>`; keys and values are trimmed, empties are dropped, non-string values are ignored.
- The `NormalizedSeriesResult.seasons` field recursively normalizes each season and each of its episodes. A plugin returning a cascade result just nests the children; the normalizer flattens malformed children (returns empty arrays instead of throwing).
