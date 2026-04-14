# Video Series Model — Plan A: Data Model Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the backend foundation for the Series → Season → Episode / Movie reshape: new typed tables, a generic staged data-migration framework, a pure parsing library, and the `/system/*` endpoints the future migration banner will consume. No user-visible changes. No data is migrated yet. No retired tables are touched.

**Architecture:** Three self-contained pieces that can be tested in isolation. (1) New `video_*` tables added alongside the existing `scenes`/`scene_folders` with a single drizzle migration — coexistence, not replacement. (2) A reusable `DataMigration` interface with an orchestrator wired into `runMigrations`, an empty registry, and API endpoints for status/finalize. No concrete migration is registered yet. (3) A pure-function parsing library under `packages/media-core/src/parsing/` for folder and filename metadata extraction, with comprehensive unit tests. Nothing in this plan writes to the new tables from the scan pipeline or exposes them to the UI — that comes in Plan B.

**Tech Stack:** TypeScript, drizzle-orm + drizzle-kit, PostgreSQL 16, Fastify, pnpm workspaces, Vitest for unit tests.

**Reference spec:** `docs/superpowers/specs/2026-04-13-video-series-model-design.md`. This plan implements Sections 4 (data model), 5 (parsing library subset), and 6.1 (the generic framework — not the concrete migration).

---

## File Structure

### New files this plan creates

**Parsing library (`packages/media-core/src/parsing/`):**
- `packages/media-core/src/parsing/index.ts` — re-exports
- `packages/media-core/src/parsing/types.ts` — shared types for parser results
- `packages/media-core/src/parsing/parse-season-folder.ts`
- `packages/media-core/src/parsing/parse-season-folder.test.ts`
- `packages/media-core/src/parsing/parse-series-folder.ts`
- `packages/media-core/src/parsing/parse-series-folder.test.ts`
- `packages/media-core/src/parsing/parse-episode-filename.ts`
- `packages/media-core/src/parsing/parse-episode-filename.test.ts`
- `packages/media-core/src/parsing/parse-movie-filename.ts`
- `packages/media-core/src/parsing/parse-movie-filename.test.ts`

**External IDs contracts (`packages/contracts/src/`):**
- `packages/contracts/src/external-ids.ts` — `KnownExternalIdProviders` constants, `ExternalIds` type

**External IDs helpers (`packages/plugins/src/`):**
- `packages/plugins/src/external-ids.ts` — typed `get`/`set`/`has` helpers

**Drizzle migration:**
- `apps/api/drizzle/0010_<drizzle-generated>.sql` — generated, contents reviewed and committed

**Data-migration framework (`apps/api/src/db/data-migrations/`):**
- `apps/api/src/db/data-migrations/types.ts` — interface definitions
- `apps/api/src/db/data-migrations/registry.ts` — registered migrations list (empty to start)
- `apps/api/src/db/data-migrations/run.ts` — orchestrator
- `apps/api/src/db/data-migrations/lockdown.ts` — write-lockdown guard helper
- `apps/api/src/db/data-migrations/README.md` — short developer doc for the framework

**System routes (`apps/api/src/routes/`):**
- `apps/api/src/routes/system.ts` — `/system/status` and `/system/migrations/:name/finalize`

### Existing files this plan modifies

- `packages/db/src/schema.ts` — add new tables, add `library_roots.scanMovies` and `scanSeries`, add `data_migrations` table
- `apps/api/src/db/migrate.ts` — add `LEGACY_SCHEMA_SENTINELS` entry for 0010, call the data-migration orchestrator after `reconcileSchema`
- `apps/api/src/app.ts` — register `systemRoutes`
- `packages/contracts/src/index.ts` — add system route constants, re-export from `external-ids.ts`
- `packages/media-core/src/index.ts` — re-export parsing module
- `packages/plugins/src/index.ts` — re-export `external-ids` helpers
- `CHANGELOG.md` — document each landed task group

### Files explicitly NOT touched in this plan

- `apps/worker/**` — scan pipeline is untouched. Plan B does that.
- `apps/api/src/routes/scenes.ts`, `scene-folders.ts`, `plugins.ts` — untouched. Plans B/C.
- `apps/api/src/services/scene.service.ts`, `scene-folder.service.ts` — untouched.
- `apps/web/**` — no UI work in Plan A. Plan D.
- `CLAUDE.md` — no policy changes.

---

## Task list

### Task 1: Scaffold the parsing module directory

**Files:**
- Create: `packages/media-core/src/parsing/index.ts`
- Create: `packages/media-core/src/parsing/types.ts`

- [ ] **Step 1: Create the types file**

Write `packages/media-core/src/parsing/types.ts`:

```ts
export interface ParsedSeasonFolder {
  /** Parsed season number (0 = Specials). Null when unrecognized. */
  seasonNumber: number | null;
  /** Optional display title if the folder name contained one. */
  title: string | null;
}

export interface ParsedSeriesFolder {
  /** Cleaned-up display title derived from the folder name. */
  title: string;
  /** Year parsed from a trailing `(YYYY)` or `[YYYY]` hint. */
  year: number | null;
}

export interface ParsedEpisodeFilename {
  seasonNumber: number | null;
  episodeNumber: number | null;
  absoluteEpisodeNumber: number | null;
  title: string | null;
  year: number | null;
}

export interface ParsedMovieFilename {
  title: string;
  year: number | null;
}
```

- [ ] **Step 2: Create the index file**

Write `packages/media-core/src/parsing/index.ts`:

```ts
export * from "./types";
export { parseSeasonFolder } from "./parse-season-folder";
export { parseSeriesFolder } from "./parse-series-folder";
export { parseEpisodeFilename } from "./parse-episode-filename";
export { parseMovieFilename } from "./parse-movie-filename";
```

This file references modules that don't exist yet — that's expected. They're added in Tasks 2–5. A typecheck will fail until Task 5 is done; don't run it mid-sequence.

- [ ] **Step 3: Commit**

```bash
git add packages/media-core/src/parsing/index.ts packages/media-core/src/parsing/types.ts
git commit -m "feat(media-core): scaffold parsing module"
```

---

### Task 2: parseSeasonFolder — TDD

**Files:**
- Create: `packages/media-core/src/parsing/parse-season-folder.test.ts`
- Create: `packages/media-core/src/parsing/parse-season-folder.ts`

- [ ] **Step 1: Write the failing test file**

Write `packages/media-core/src/parsing/parse-season-folder.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseSeasonFolder } from "./parse-season-folder";

describe("parseSeasonFolder", () => {
  it("parses 'Season 1' style", () => {
    expect(parseSeasonFolder("Season 1")).toEqual({ seasonNumber: 1, title: null });
    expect(parseSeasonFolder("Season 01")).toEqual({ seasonNumber: 1, title: null });
    expect(parseSeasonFolder("Season_1")).toEqual({ seasonNumber: 1, title: null });
    expect(parseSeasonFolder("season.1")).toEqual({ seasonNumber: 1, title: null });
  });

  it("parses 'S01' style", () => {
    expect(parseSeasonFolder("S1")).toEqual({ seasonNumber: 1, title: null });
    expect(parseSeasonFolder("S01")).toEqual({ seasonNumber: 1, title: null });
    expect(parseSeasonFolder("S 01")).toEqual({ seasonNumber: 1, title: null });
    expect(parseSeasonFolder("S10")).toEqual({ seasonNumber: 10, title: null });
  });

  it("parses non-English variants", () => {
    expect(parseSeasonFolder("Saison 1")).toEqual({ seasonNumber: 1, title: null });
    expect(parseSeasonFolder("Temporada 2")).toEqual({ seasonNumber: 2, title: null });
    expect(parseSeasonFolder("Staffel 3")).toEqual({ seasonNumber: 3, title: null });
  });

  it("maps Specials/Special/Extras/OVA to season 0", () => {
    expect(parseSeasonFolder("Specials")).toEqual({ seasonNumber: 0, title: "Specials" });
    expect(parseSeasonFolder("Special")).toEqual({ seasonNumber: 0, title: "Specials" });
    expect(parseSeasonFolder("Extras")).toEqual({ seasonNumber: 0, title: "Specials" });
    expect(parseSeasonFolder("OVA")).toEqual({ seasonNumber: 0, title: "Specials" });
  });

  it("parses bare-number folders", () => {
    expect(parseSeasonFolder("1")).toEqual({ seasonNumber: 1, title: null });
    expect(parseSeasonFolder("01")).toEqual({ seasonNumber: 1, title: null });
    expect(parseSeasonFolder("12")).toEqual({ seasonNumber: 12, title: null });
  });

  it("returns nulls for unrecognized folder names", () => {
    expect(parseSeasonFolder("Breaking Bad")).toEqual({ seasonNumber: null, title: null });
    expect(parseSeasonFolder("Behind The Scenes")).toEqual({ seasonNumber: null, title: null });
    expect(parseSeasonFolder("")).toEqual({ seasonNumber: null, title: null });
  });

  it("is case-insensitive", () => {
    expect(parseSeasonFolder("season 1")).toEqual({ seasonNumber: 1, title: null });
    expect(parseSeasonFolder("SEASON 01")).toEqual({ seasonNumber: 1, title: null });
    expect(parseSeasonFolder("s01")).toEqual({ seasonNumber: 1, title: null });
    expect(parseSeasonFolder("specials")).toEqual({ seasonNumber: 0, title: "Specials" });
  });

  it("trims surrounding whitespace", () => {
    expect(parseSeasonFolder("  Season 1  ")).toEqual({ seasonNumber: 1, title: null });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @obscura/media-core test -- parse-season-folder
```

Expected: FAIL with "Cannot find module './parse-season-folder'" or similar.

- [ ] **Step 3: Write the minimal implementation**

Write `packages/media-core/src/parsing/parse-season-folder.ts`:

```ts
import type { ParsedSeasonFolder } from "./types";

const SPECIALS_WORDS = new Set([
  "specials",
  "special",
  "extras",
  "ova",
]);

const SEASON_LONG_PATTERNS: RegExp[] = [
  /^\s*season[\s._-]*(\d{1,3})\s*$/i,          // Season 1, Season_01, season.1
  /^\s*saison[\s._-]*(\d{1,3})\s*$/i,          // French
  /^\s*temporada[\s._-]*(\d{1,3})\s*$/i,       // Spanish / Portuguese
  /^\s*staffel[\s._-]*(\d{1,3})\s*$/i,         // German
];

const SEASON_SHORT_PATTERN = /^\s*s[\s._-]*(\d{1,3})\s*$/i;   // S1, S01, S 01
const BARE_NUMBER_PATTERN = /^\s*(\d{1,3})\s*$/;              // 1, 01, 12

export function parseSeasonFolder(name: string): ParsedSeasonFolder {
  if (!name) return { seasonNumber: null, title: null };

  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  if (SPECIALS_WORDS.has(lower)) {
    return { seasonNumber: 0, title: "Specials" };
  }

  for (const pattern of SEASON_LONG_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return { seasonNumber: Number.parseInt(match[1], 10), title: null };
    }
  }

  const shortMatch = trimmed.match(SEASON_SHORT_PATTERN);
  if (shortMatch) {
    return { seasonNumber: Number.parseInt(shortMatch[1], 10), title: null };
  }

  const bareMatch = trimmed.match(BARE_NUMBER_PATTERN);
  if (bareMatch) {
    return { seasonNumber: Number.parseInt(bareMatch[1], 10), title: null };
  }

  return { seasonNumber: null, title: null };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter @obscura/media-core test -- parse-season-folder
```

Expected: PASS with all assertions green.

- [ ] **Step 5: Commit**

```bash
git add packages/media-core/src/parsing/parse-season-folder.ts packages/media-core/src/parsing/parse-season-folder.test.ts
git commit -m "feat(media-core): add parseSeasonFolder with tests"
```

---

### Task 3: parseSeriesFolder — TDD

**Files:**
- Create: `packages/media-core/src/parsing/parse-series-folder.test.ts`
- Create: `packages/media-core/src/parsing/parse-series-folder.ts`

- [ ] **Step 1: Write the failing test file**

Write `packages/media-core/src/parsing/parse-series-folder.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseSeriesFolder } from "./parse-series-folder";

describe("parseSeriesFolder", () => {
  it("returns the folder name as the title with no year", () => {
    expect(parseSeriesFolder("Breaking Bad")).toEqual({
      title: "Breaking Bad",
      year: null,
    });
  });

  it("extracts year from trailing (YYYY)", () => {
    expect(parseSeriesFolder("The Office (2005)")).toEqual({
      title: "The Office",
      year: 2005,
    });
  });

  it("extracts year from trailing [YYYY]", () => {
    expect(parseSeriesFolder("Westworld [2016]")).toEqual({
      title: "Westworld",
      year: 2016,
    });
  });

  it("collapses dot and underscore separators into spaces", () => {
    expect(parseSeriesFolder("Breaking.Bad")).toEqual({
      title: "Breaking Bad",
      year: null,
    });
    expect(parseSeriesFolder("Breaking_Bad")).toEqual({
      title: "Breaking Bad",
      year: null,
    });
  });

  it("strips common release-group suffixes", () => {
    expect(parseSeriesFolder("Breaking.Bad.1080p.WEB-DL.x264-GROUP")).toEqual({
      title: "Breaking Bad",
      year: null,
    });
    expect(parseSeriesFolder("The Expanse 2160p HDR x265")).toEqual({
      title: "The Expanse",
      year: null,
    });
  });

  it("keeps year when present alongside release tags", () => {
    expect(parseSeriesFolder("The.Office.2005.1080p.WEB-DL")).toEqual({
      title: "The Office",
      year: 2005,
    });
  });

  it("collapses repeated whitespace", () => {
    expect(parseSeriesFolder("The    Expanse")).toEqual({
      title: "The Expanse",
      year: null,
    });
  });

  it("handles empty string", () => {
    expect(parseSeriesFolder("")).toEqual({ title: "", year: null });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @obscura/media-core test -- parse-series-folder
```

Expected: FAIL (module not found).

- [ ] **Step 3: Write the implementation**

Write `packages/media-core/src/parsing/parse-series-folder.ts`:

```ts
import type { ParsedSeriesFolder } from "./types";

const YEAR_PATTERN_PAREN = /\((\d{4})\)/;
const YEAR_PATTERN_BRACKET = /\[(\d{4})\]/;
const YEAR_PATTERN_BARE = /(?:^|[\s.])((?:19|20)\d{2})(?:[\s.]|$)/;

// Tokens we strip after extracting year/title. Match common release-group
// artifacts — resolution, HDR, codec, source, group suffix.
const RELEASE_TOKEN_PATTERNS: RegExp[] = [
  /\b\d{3,4}p\b/gi,              // 480p, 720p, 1080p, 2160p
  /\bhdr\d*\b/gi,                // HDR, HDR10
  /\bsdr\b/gi,
  /\bweb[-.]?dl\b/gi,
  /\bweb[-.]?rip\b/gi,
  /\bbluray\b/gi,
  /\bbdrip\b/gi,
  /\bdvdrip\b/gi,
  /\bhdtv\b/gi,
  /\bx26[45]\b/gi,
  /\bh[-.]?26[45]\b/gi,
  /\bhevc\b/gi,
  /\bavc\b/gi,
  /\baac\b/gi,
  /\bac3\b/gi,
  /\bdts\b/gi,
  /-[A-Za-z0-9]+$/,              // trailing "-GROUP"
];

export function parseSeriesFolder(name: string): ParsedSeriesFolder {
  if (!name) return { title: "", year: null };

  let working = name;

  let year: number | null = null;
  const parenMatch = working.match(YEAR_PATTERN_PAREN);
  if (parenMatch) {
    year = Number.parseInt(parenMatch[1], 10);
    working = working.replace(YEAR_PATTERN_PAREN, " ");
  } else {
    const bracketMatch = working.match(YEAR_PATTERN_BRACKET);
    if (bracketMatch) {
      year = Number.parseInt(bracketMatch[1], 10);
      working = working.replace(YEAR_PATTERN_BRACKET, " ");
    } else {
      const bareMatch = working.match(YEAR_PATTERN_BARE);
      if (bareMatch) {
        year = Number.parseInt(bareMatch[1], 10);
        working = working.replace(bareMatch[1], " ");
      }
    }
  }

  for (const pattern of RELEASE_TOKEN_PATTERNS) {
    working = working.replace(pattern, " ");
  }

  const title = working
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { title, year };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter @obscura/media-core test -- parse-series-folder
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/media-core/src/parsing/parse-series-folder.ts packages/media-core/src/parsing/parse-series-folder.test.ts
git commit -m "feat(media-core): add parseSeriesFolder with tests"
```

---

### Task 4: parseEpisodeFilename — TDD

**Files:**
- Create: `packages/media-core/src/parsing/parse-episode-filename.test.ts`
- Create: `packages/media-core/src/parsing/parse-episode-filename.ts`

- [ ] **Step 1: Write the failing test file**

Write `packages/media-core/src/parsing/parse-episode-filename.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseEpisodeFilename } from "./parse-episode-filename";

describe("parseEpisodeFilename", () => {
  it("parses S01E02 style", () => {
    expect(parseEpisodeFilename("Show.Name.S01E02.mkv")).toEqual({
      seasonNumber: 1,
      episodeNumber: 2,
      absoluteEpisodeNumber: null,
      title: null,
      year: null,
    });
  });

  it("parses S01E02 with title", () => {
    expect(parseEpisodeFilename("Breaking Bad - S01E02 - Cat's in the Bag.mkv")).toEqual({
      seasonNumber: 1,
      episodeNumber: 2,
      absoluteEpisodeNumber: null,
      title: "Cat's in the Bag",
      year: null,
    });
  });

  it("parses s1e2 lowercase", () => {
    expect(parseEpisodeFilename("show.s1e2.mkv")).toMatchObject({
      seasonNumber: 1,
      episodeNumber: 2,
    });
  });

  it("parses S01.E02 dotted", () => {
    expect(parseEpisodeFilename("Show.S01.E02.1080p.mkv")).toMatchObject({
      seasonNumber: 1,
      episodeNumber: 2,
    });
  });

  it("parses 1x02 style", () => {
    expect(parseEpisodeFilename("Show - 1x02 - Title.mkv")).toMatchObject({
      seasonNumber: 1,
      episodeNumber: 2,
      title: "Title",
    });
  });

  it("parses 01x02 style", () => {
    expect(parseEpisodeFilename("Show 01x02.mkv")).toMatchObject({
      seasonNumber: 1,
      episodeNumber: 2,
    });
  });

  it("parses 'Season 1 Episode 2' long form", () => {
    expect(parseEpisodeFilename("Show Season 1 Episode 2.mkv")).toMatchObject({
      seasonNumber: 1,
      episodeNumber: 2,
    });
    expect(parseEpisodeFilename("Show - Season 1 - Episode 2.mkv")).toMatchObject({
      seasonNumber: 1,
      episodeNumber: 2,
    });
  });

  it("parses bare absolute episode numbers (anime convention)", () => {
    expect(parseEpisodeFilename("One Piece - 005 - The Curse of Demon Sword.mkv")).toEqual({
      seasonNumber: null,
      episodeNumber: null,
      absoluteEpisodeNumber: 5,
      title: "The Curse of Demon Sword",
      year: null,
    });
  });

  it("parses bare absolute episode numbers with dot separators", () => {
    expect(parseEpisodeFilename("One.Piece.005.1080p.mkv")).toMatchObject({
      absoluteEpisodeNumber: 5,
    });
  });

  it("does not treat resolution as an episode number", () => {
    // 1080 is resolution context, not episode number
    expect(parseEpisodeFilename("Show.1080p.mkv")).toEqual({
      seasonNumber: null,
      episodeNumber: null,
      absoluteEpisodeNumber: null,
      title: null,
      year: null,
    });
  });

  it("extracts year from filename", () => {
    expect(parseEpisodeFilename("Show.S01E02.2019.mkv")).toMatchObject({
      seasonNumber: 1,
      episodeNumber: 2,
      year: 2019,
    });
    expect(parseEpisodeFilename("Show (2019) - S01E02.mkv")).toMatchObject({
      seasonNumber: 1,
      episodeNumber: 2,
      year: 2019,
    });
  });

  it("returns all nulls for unrecognized filenames", () => {
    expect(parseEpisodeFilename("random garbage.mkv")).toEqual({
      seasonNumber: null,
      episodeNumber: null,
      absoluteEpisodeNumber: null,
      title: null,
      year: null,
    });
  });

  it("ignores file extensions", () => {
    expect(parseEpisodeFilename("Show.S01E02")).toMatchObject({
      seasonNumber: 1,
      episodeNumber: 2,
    });
    expect(parseEpisodeFilename("Show.S01E02.mp4")).toMatchObject({
      seasonNumber: 1,
      episodeNumber: 2,
    });
  });

  it("handles an absolute path argument", () => {
    expect(parseEpisodeFilename("/media/tv/Show/Season 1/Show.S01E02.mkv")).toMatchObject({
      seasonNumber: 1,
      episodeNumber: 2,
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @obscura/media-core test -- parse-episode-filename
```

Expected: FAIL (module not found).

- [ ] **Step 3: Write the implementation**

Write `packages/media-core/src/parsing/parse-episode-filename.ts`:

```ts
import path from "node:path";
import type { ParsedEpisodeFilename } from "./types";

const EXTENSION_STRIP = /\.[A-Za-z0-9]{1,5}$/;

// Ordered most specific → least specific.
const EPISODE_PATTERNS: RegExp[] = [
  // S01E02, S01.E02, S01xE02, s1e2
  /s(\d{1,3})[\s._-]*x?e(\d{1,3})/i,
  // 1x02, 01x02 — but the '1080p' case is handled by requiring non-digit boundary before and after
  /(?:^|[^\d])(\d{1,2})x(\d{1,3})(?!\d)/,
  // Season 1 Episode 2 / Season 1 - Episode 2
  /season[\s._-]*(\d{1,3})[\s._-]+episode[\s._-]*(\d{1,3})/i,
];

// Absolute episode number (bare 3-digit or 2-digit with strong separator context).
// Matches "- 005 -", ".005.", " 05 -". Avoids matching year-sized numbers.
const ABSOLUTE_EPISODE_PATTERN = /(?:^|[\s._-])-?[\s._-]*(\d{2,4})[\s._-]+/;

const YEAR_PATTERN_PAREN = /\((\d{4})\)/;
const YEAR_PATTERN_BARE = /(?:^|[\s._-])((?:19|20)\d{2})(?:[\s._-]|$)/;

const RESOLUTION_TOKEN = /\b\d{3,4}p\b/i;

function stripExtension(name: string): string {
  return name.replace(EXTENSION_STRIP, "");
}

function extractYear(input: string): { year: number | null; cleaned: string } {
  const parenMatch = input.match(YEAR_PATTERN_PAREN);
  if (parenMatch) {
    return {
      year: Number.parseInt(parenMatch[1], 10),
      cleaned: input.replace(YEAR_PATTERN_PAREN, " "),
    };
  }
  const bareMatch = input.match(YEAR_PATTERN_BARE);
  if (bareMatch) {
    return {
      year: Number.parseInt(bareMatch[1], 10),
      cleaned: input.replace(bareMatch[1], " "),
    };
  }
  return { year: null, cleaned: input };
}

function cleanTitle(raw: string): string {
  return raw
    .replace(RESOLUTION_TOKEN, " ")
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-_.]+|[\s\-_.]+$/g, "")
    .trim();
}

export function parseEpisodeFilename(filePath: string): ParsedEpisodeFilename {
  const basename = path.basename(filePath);
  const withoutExt = stripExtension(basename);
  const yearResult = extractYear(withoutExt);
  const working = yearResult.cleaned;
  const year = yearResult.year;

  for (const pattern of EPISODE_PATTERNS) {
    const match = working.match(pattern);
    if (match) {
      const seasonNumber = Number.parseInt(match[1], 10);
      const episodeNumber = Number.parseInt(match[2], 10);
      const afterMatch = working.slice((match.index ?? 0) + match[0].length);
      const title = cleanTitle(afterMatch) || null;
      return {
        seasonNumber,
        episodeNumber,
        absoluteEpisodeNumber: null,
        title,
        year,
      };
    }
  }

  // Absolute episode fallback. Strip the year first so we don't match it.
  // Strip resolution tokens too (1080 etc) for the same reason.
  const absScratch = working.replace(RESOLUTION_TOKEN, " ");
  const absMatch = absScratch.match(ABSOLUTE_EPISODE_PATTERN);
  if (absMatch) {
    const candidate = Number.parseInt(absMatch[1], 10);
    // Reject numbers that look like years (1900-2099).
    if (candidate < 1900 || candidate > 2099) {
      const afterMatch = absScratch.slice((absMatch.index ?? 0) + absMatch[0].length);
      const title = cleanTitle(afterMatch) || null;
      return {
        seasonNumber: null,
        episodeNumber: null,
        absoluteEpisodeNumber: candidate,
        title,
        year,
      };
    }
  }

  return {
    seasonNumber: null,
    episodeNumber: null,
    absoluteEpisodeNumber: null,
    title: null,
    year,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter @obscura/media-core test -- parse-episode-filename
```

Expected: PASS. If the "does not treat resolution as an episode number" test fails because the absolute pattern picked up 1080, confirm the `RESOLUTION_TOKEN` strip happens before the absolute-episode scan. If the "anime convention" test fails because the pattern didn't match `005`, confirm the regex allows both 3-digit and 2-digit matches with separator context.

- [ ] **Step 5: Commit**

```bash
git add packages/media-core/src/parsing/parse-episode-filename.ts packages/media-core/src/parsing/parse-episode-filename.test.ts
git commit -m "feat(media-core): add parseEpisodeFilename with tests"
```

---

### Task 5: parseMovieFilename — TDD

**Files:**
- Create: `packages/media-core/src/parsing/parse-movie-filename.test.ts`
- Create: `packages/media-core/src/parsing/parse-movie-filename.ts`

- [ ] **Step 1: Write the failing test file**

Write `packages/media-core/src/parsing/parse-movie-filename.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseMovieFilename } from "./parse-movie-filename";

describe("parseMovieFilename", () => {
  it("returns the cleaned filename as title with no year", () => {
    expect(parseMovieFilename("Heat.mkv")).toEqual({ title: "Heat", year: null });
  });

  it("extracts year from (YYYY)", () => {
    expect(parseMovieFilename("Blade Runner (1982).mkv")).toEqual({
      title: "Blade Runner",
      year: 1982,
    });
  });

  it("extracts year from bare YYYY with separator context", () => {
    expect(parseMovieFilename("Inception.2010.1080p.BluRay.x264.mkv")).toEqual({
      title: "Inception",
      year: 2010,
    });
  });

  it("extracts year from [YYYY]", () => {
    expect(parseMovieFilename("Arrival [2016].mkv")).toEqual({
      title: "Arrival",
      year: 2016,
    });
  });

  it("strips release-group suffixes and resolution", () => {
    expect(parseMovieFilename("The Dark Knight.2008.2160p.HDR.HEVC-GROUP.mkv")).toEqual({
      title: "The Dark Knight",
      year: 2008,
    });
  });

  it("collapses dots and underscores into spaces", () => {
    expect(parseMovieFilename("Mad_Max_Fury_Road.2015.mkv")).toEqual({
      title: "Mad Max Fury Road",
      year: 2015,
    });
  });

  it("handles absolute paths", () => {
    expect(parseMovieFilename("/media/movies/Heat (1995).mkv")).toEqual({
      title: "Heat",
      year: 1995,
    });
  });

  it("returns empty title for empty input", () => {
    expect(parseMovieFilename("")).toEqual({ title: "", year: null });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --filter @obscura/media-core test -- parse-movie-filename
```

Expected: FAIL (module not found).

- [ ] **Step 3: Write the implementation**

Write `packages/media-core/src/parsing/parse-movie-filename.ts`:

```ts
import path from "node:path";
import { parseSeriesFolder } from "./parse-series-folder";
import type { ParsedMovieFilename } from "./types";

const EXTENSION_STRIP = /\.[A-Za-z0-9]{1,5}$/;

export function parseMovieFilename(filePath: string): ParsedMovieFilename {
  if (!filePath) return { title: "", year: null };
  const basename = path.basename(filePath).replace(EXTENSION_STRIP, "");
  // Reuse parseSeriesFolder's cleanup logic — the shape of a movie filename
  // (Title.Year.release-tags) is identical to a series folder.
  const parsed = parseSeriesFolder(basename);
  return { title: parsed.title, year: parsed.year };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --filter @obscura/media-core test -- parse-movie-filename
```

Expected: PASS.

- [ ] **Step 5: Run the full parsing test suite**

```bash
pnpm --filter @obscura/media-core test -- parsing
```

Expected: PASS across all four parser test files.

- [ ] **Step 6: Commit**

```bash
git add packages/media-core/src/parsing/parse-movie-filename.ts packages/media-core/src/parsing/parse-movie-filename.test.ts
git commit -m "feat(media-core): add parseMovieFilename with tests"
```

---

### Task 6: Re-export the parsing module from media-core

**Files:**
- Modify: `packages/media-core/src/index.ts`

- [ ] **Step 1: Find the end of the current exports in media-core index**

```bash
grep -n "^export" packages/media-core/src/index.ts | tail -10
```

- [ ] **Step 2: Append a re-export of the parsing module**

Add this line at the end of `packages/media-core/src/index.ts` (on its own line, after the last existing export):

```ts
export * from "./parsing";
```

- [ ] **Step 3: Typecheck the package**

```bash
pnpm --filter @obscura/media-core exec tsc --noEmit
```

Expected: no errors. If there's a name collision between an existing export and one of the parsing types or functions, rename the one in `./parsing/types.ts` with a more specific name and update the usages.

- [ ] **Step 4: Re-run the full media-core test suite**

```bash
pnpm --filter @obscura/media-core test
```

Expected: all tests pass, including the existing tests in `packages/media-core/src/index.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/media-core/src/index.ts
git commit -m "feat(media-core): re-export parsing module from package root"
```

---

### Task 7: External-IDs constants in contracts

**Files:**
- Create: `packages/contracts/src/external-ids.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Create the external-ids contracts file**

Write `packages/contracts/src/external-ids.ts`:

```ts
/**
 * Flexible provider → string map used on every video entity (series,
 * seasons, episodes, movies) and every scrape result. Values are always
 * strings. A value may be a bare ID, a full URL, or a composite — the
 * plugin that wrote it decides the format.
 */
export type ExternalIds = Record<string, string>;

/**
 * Conventional provider keys. These are used for display labels, icons,
 * and plugin ergonomics. They are NOT enforced at the database layer —
 * a plugin may write any key it wants, including a `custom:<pluginId>`
 * namespace for proprietary providers.
 */
export const KnownExternalIdProviders = {
  tmdb: "tmdb",
  tvdb: "tvdb",
  imdb: "imdb",
  anidb: "anidb",
  mal: "mal",
  trakt: "trakt",
} as const;

export type KnownExternalIdProvider =
  (typeof KnownExternalIdProviders)[keyof typeof KnownExternalIdProviders];

export interface ExternalIdProviderDescriptor {
  key: string;
  label: string;
  linkTemplate?: (value: string) => string;
}

export const EXTERNAL_ID_PROVIDER_DESCRIPTORS: Record<
  KnownExternalIdProvider,
  ExternalIdProviderDescriptor
> = {
  tmdb: {
    key: "tmdb",
    label: "The Movie Database",
    linkTemplate: (value) => `https://www.themoviedb.org/?id=${value}`,
  },
  tvdb: {
    key: "tvdb",
    label: "TheTVDB",
    linkTemplate: (value) => `https://thetvdb.com/?id=${value}`,
  },
  imdb: {
    key: "imdb",
    label: "IMDb",
    linkTemplate: (value) => `https://www.imdb.com/title/${value}/`,
  },
  anidb: {
    key: "anidb",
    label: "AniDB",
    linkTemplate: (value) =>
      `https://anidb.net/anime/?aid=${encodeURIComponent(value)}`,
  },
  mal: {
    key: "mal",
    label: "MyAnimeList",
    linkTemplate: (value) => `https://myanimelist.net/anime/${value}`,
  },
  trakt: {
    key: "trakt",
    label: "Trakt",
    linkTemplate: (value) => `https://trakt.tv/${value}`,
  },
};
```

- [ ] **Step 2: Re-export from the contracts index**

Append to `packages/contracts/src/index.ts` (on its own new line after the last export):

```ts
export * from "./external-ids";
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @obscura/contracts exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/src/external-ids.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): add ExternalIds type and KnownExternalIdProviders constants"
```

---

### Task 8: External-IDs helpers in plugins package

**Files:**
- Create: `packages/plugins/src/external-ids.ts`
- Modify: `packages/plugins/src/index.ts`

- [ ] **Step 1: Write the helpers file**

Write `packages/plugins/src/external-ids.ts`:

```ts
import type { ExternalIds } from "@obscura/contracts";

/**
 * Read a provider value from an entity's external_ids column.
 * Returns undefined when the provider key is not present.
 */
export function getExternalId(
  externalIds: ExternalIds | null | undefined,
  provider: string,
): string | undefined {
  if (!externalIds) return undefined;
  const value = externalIds[provider];
  return typeof value === "string" ? value : undefined;
}

/**
 * Merge a provider value into an existing external_ids map, returning a
 * new object. Does not mutate the input. Does not clobber other provider
 * keys. Passing an empty or whitespace-only value removes the key.
 */
export function setExternalId(
  externalIds: ExternalIds | null | undefined,
  provider: string,
  value: string,
): ExternalIds {
  const base: ExternalIds = { ...(externalIds ?? {}) };
  const trimmed = value?.trim() ?? "";
  if (trimmed === "") {
    delete base[provider];
  } else {
    base[provider] = trimmed;
  }
  return base;
}

/**
 * Check whether a provider key is present on an entity.
 */
export function hasExternalId(
  externalIds: ExternalIds | null | undefined,
  provider: string,
): boolean {
  return getExternalId(externalIds, provider) !== undefined;
}

/**
 * Merge two external_ids maps. Keys in `incoming` win over keys in `base`.
 */
export function mergeExternalIds(
  base: ExternalIds | null | undefined,
  incoming: ExternalIds | null | undefined,
): ExternalIds {
  return { ...(base ?? {}), ...(incoming ?? {}) };
}
```

- [ ] **Step 2: Re-export from the plugins index**

Append to `packages/plugins/src/index.ts`:

```ts
export * from "./external-ids";
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @obscura/plugins exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/plugins/src/external-ids.ts packages/plugins/src/index.ts
git commit -m "feat(plugins): add typed external-ids helpers"
```

---

### Task 9: Add new tables to the Drizzle schema

**Files:**
- Modify: `packages/db/src/schema.ts`

This is the longest task in the plan. It adds six new entity tables, six new join tables, the `data_migrations` framework table, and two new columns on `library_roots`. Everything is additive — no column drops, no table drops, no destructive changes.

- [ ] **Step 1: Open the schema file and find the end of `libraryRoots`**

```bash
grep -n "export const libraryRoots" packages/db/src/schema.ts
grep -n "export const libraryRootsRelations\|^export const librarySettings" packages/db/src/schema.ts
```

Expected: line numbers for where `libraryRoots` starts and where the next export begins.

- [ ] **Step 2: Add `scanMovies` and `scanSeries` columns to `libraryRoots`**

In `packages/db/src/schema.ts`, find the existing `libraryRoots` definition (around line 144) and add two new columns immediately after `scanVideos`:

```ts
    scanVideos: boolean("scan_videos").default(true).notNull(),
    scanMovies: boolean("scan_movies").default(false).notNull(),
    scanSeries: boolean("scan_series").default(false).notNull(),
    scanImages: boolean("scan_images").default(true).notNull(),
```

Defaults are `false` on purpose — the migration is additive and does not auto-enable these on existing libraries until the user opts in from library settings UI (Plan D). Existing installs continue to use `scan_videos`.

- [ ] **Step 3: Find the end of the schema file**

```bash
wc -l packages/db/src/schema.ts
```

Note the line count — the new tables get appended at the end of the file.

- [ ] **Step 4: Append the new tables at the end of `packages/db/src/schema.ts`**

Add this full block at the end of the file:

```ts
// ─── Video Series Model (Plan A) ────────────────────────────────────
// New typed tables for the Series → Season → Episode / Movie reshape.
// These coexist with scenes/scene_folders until the data migration in
// Plan B populates them and the finalize step drops the old tables.

export const videoSeries = pgTable(
  "video_series",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    libraryRootId: uuid("library_root_id")
      .references(() => libraryRoots.id, { onDelete: "cascade" })
      .notNull(),
    folderPath: text("folder_path").notNull(),
    relativePath: text("relative_path").notNull(),
    title: text("title").notNull(),
    sortTitle: text("sort_title"),
    originalTitle: text("original_title"),
    overview: text("overview"),
    tagline: text("tagline"),
    status: text("status"),
    firstAirDate: text("first_air_date"),
    endAirDate: text("end_air_date"),
    posterPath: text("poster_path"),
    backdropPath: text("backdrop_path"),
    logoPath: text("logo_path"),
    studioId: uuid("studio_id").references(() => studios.id, {
      onDelete: "set null",
    }),
    rating: real("rating"),
    contentRating: text("content_rating"),
    isNsfw: boolean("is_nsfw").default(false).notNull(),
    organized: boolean("organized").default(false).notNull(),
    externalIds: jsonb("external_ids")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("video_series_folder_path_idx").on(table.folderPath),
    index("video_series_library_root_idx").on(table.libraryRootId),
    index("video_series_studio_idx").on(table.studioId),
    index("video_series_is_nsfw_idx").on(table.isNsfw),
  ],
);

export const videoSeasons = pgTable(
  "video_seasons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seriesId: uuid("series_id")
      .references(() => videoSeries.id, { onDelete: "cascade" })
      .notNull(),
    seasonNumber: integer("season_number").notNull(),
    folderPath: text("folder_path"),
    title: text("title"),
    overview: text("overview"),
    posterPath: text("poster_path"),
    airDate: text("air_date"),
    externalIds: jsonb("external_ids")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("video_seasons_series_season_idx").on(
      table.seriesId,
      table.seasonNumber,
    ),
    index("video_seasons_series_idx").on(table.seriesId),
  ],
);

export const videoEpisodes = pgTable(
  "video_episodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .references(() => videoSeasons.id, { onDelete: "cascade" })
      .notNull(),
    seriesId: uuid("series_id")
      .references(() => videoSeries.id, { onDelete: "cascade" })
      .notNull(),
    seasonNumber: integer("season_number").notNull(),
    episodeNumber: integer("episode_number"),
    absoluteEpisodeNumber: integer("absolute_episode_number"),
    title: text("title"),
    overview: text("overview"),
    airDate: text("air_date"),
    stillPath: text("still_path"),
    runtime: integer("runtime"),
    externalIds: jsonb("external_ids")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    // File and probe
    filePath: text("file_path").notNull(),
    fileSize: real("file_size"),
    duration: real("duration"),
    width: integer("width"),
    height: integer("height"),
    frameRate: real("frame_rate"),
    bitRate: integer("bit_rate"),
    codec: text("codec"),
    container: text("container"),
    // Fingerprints
    checksumMd5: text("checksum_md5"),
    oshash: text("oshash"),
    phash: text("phash"),
    // Generated assets
    thumbnailPath: text("thumbnail_path"),
    cardThumbnailPath: text("card_thumbnail_path"),
    previewPath: text("preview_path"),
    spritePath: text("sprite_path"),
    trickplayVttPath: text("trickplay_vtt_path"),
    // Watch state and user fields
    playCount: integer("play_count").default(0).notNull(),
    orgasmCount: integer("orgasm_count").default(0).notNull(),
    playDuration: real("play_duration").default(0).notNull(),
    resumeTime: real("resume_time").default(0).notNull(),
    lastPlayedAt: timestamp("last_played_at"),
    rating: integer("rating"),
    isNsfw: boolean("is_nsfw").default(false).notNull(),
    organized: boolean("organized").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("video_episodes_file_path_idx").on(table.filePath),
    index("video_episodes_season_idx").on(table.seasonId),
    index("video_episodes_series_idx").on(table.seriesId),
    index("video_episodes_is_nsfw_idx").on(table.isNsfw),
  ],
);

export const videoMovies = pgTable(
  "video_movies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    libraryRootId: uuid("library_root_id")
      .references(() => libraryRoots.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    sortTitle: text("sort_title"),
    originalTitle: text("original_title"),
    overview: text("overview"),
    tagline: text("tagline"),
    releaseDate: text("release_date"),
    runtime: integer("runtime"),
    posterPath: text("poster_path"),
    backdropPath: text("backdrop_path"),
    logoPath: text("logo_path"),
    studioId: uuid("studio_id").references(() => studios.id, {
      onDelete: "set null",
    }),
    rating: integer("rating"),
    contentRating: text("content_rating"),
    isNsfw: boolean("is_nsfw").default(false).notNull(),
    organized: boolean("organized").default(false).notNull(),
    externalIds: jsonb("external_ids")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    // File and probe
    filePath: text("file_path").notNull(),
    fileSize: real("file_size"),
    duration: real("duration"),
    width: integer("width"),
    height: integer("height"),
    frameRate: real("frame_rate"),
    bitRate: integer("bit_rate"),
    codec: text("codec"),
    container: text("container"),
    // Fingerprints
    checksumMd5: text("checksum_md5"),
    oshash: text("oshash"),
    phash: text("phash"),
    // Generated assets
    thumbnailPath: text("thumbnail_path"),
    cardThumbnailPath: text("card_thumbnail_path"),
    previewPath: text("preview_path"),
    spritePath: text("sprite_path"),
    trickplayVttPath: text("trickplay_vtt_path"),
    // Watch state and user fields
    playCount: integer("play_count").default(0).notNull(),
    orgasmCount: integer("orgasm_count").default(0).notNull(),
    playDuration: real("play_duration").default(0).notNull(),
    resumeTime: real("resume_time").default(0).notNull(),
    lastPlayedAt: timestamp("last_played_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("video_movies_file_path_idx").on(table.filePath),
    index("video_movies_library_root_idx").on(table.libraryRootId),
    index("video_movies_studio_idx").on(table.studioId),
    index("video_movies_is_nsfw_idx").on(table.isNsfw),
  ],
);

// ─── Join tables ────────────────────────────────────────────────────

export const videoMoviePerformers = pgTable(
  "video_movie_performers",
  {
    movieId: uuid("movie_id")
      .references(() => videoMovies.id, { onDelete: "cascade" })
      .notNull(),
    performerId: uuid("performer_id")
      .references(() => performers.id, { onDelete: "cascade" })
      .notNull(),
    character: text("character"),
    order: integer("order"),
  },
  (table) => [
    uniqueIndex("video_movie_performers_pk").on(
      table.movieId,
      table.performerId,
    ),
  ],
);

export const videoMovieTags = pgTable(
  "video_movie_tags",
  {
    movieId: uuid("movie_id")
      .references(() => videoMovies.id, { onDelete: "cascade" })
      .notNull(),
    tagId: uuid("tag_id")
      .references(() => tags.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [
    uniqueIndex("video_movie_tags_pk").on(table.movieId, table.tagId),
  ],
);

export const videoSeriesPerformers = pgTable(
  "video_series_performers",
  {
    seriesId: uuid("series_id")
      .references(() => videoSeries.id, { onDelete: "cascade" })
      .notNull(),
    performerId: uuid("performer_id")
      .references(() => performers.id, { onDelete: "cascade" })
      .notNull(),
    character: text("character"),
    order: integer("order"),
  },
  (table) => [
    uniqueIndex("video_series_performers_pk").on(
      table.seriesId,
      table.performerId,
    ),
  ],
);

export const videoSeriesTags = pgTable(
  "video_series_tags",
  {
    seriesId: uuid("series_id")
      .references(() => videoSeries.id, { onDelete: "cascade" })
      .notNull(),
    tagId: uuid("tag_id")
      .references(() => tags.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [
    uniqueIndex("video_series_tags_pk").on(table.seriesId, table.tagId),
  ],
);

export const videoEpisodePerformers = pgTable(
  "video_episode_performers",
  {
    episodeId: uuid("episode_id")
      .references(() => videoEpisodes.id, { onDelete: "cascade" })
      .notNull(),
    performerId: uuid("performer_id")
      .references(() => performers.id, { onDelete: "cascade" })
      .notNull(),
    character: text("character"),
    order: integer("order"),
  },
  (table) => [
    uniqueIndex("video_episode_performers_pk").on(
      table.episodeId,
      table.performerId,
    ),
  ],
);

export const videoEpisodeTags = pgTable(
  "video_episode_tags",
  {
    episodeId: uuid("episode_id")
      .references(() => videoEpisodes.id, { onDelete: "cascade" })
      .notNull(),
    tagId: uuid("tag_id")
      .references(() => tags.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [
    uniqueIndex("video_episode_tags_pk").on(table.episodeId, table.tagId),
  ],
);

// ─── Staged-migration framework ─────────────────────────────────────

export const dataMigrations = pgTable("data_migrations", {
  name: text("name").primaryKey(),
  status: text("status").notNull().default("pending"),
  stagedAt: timestamp("staged_at"),
  finalizedAt: timestamp("finalized_at"),
  failedAt: timestamp("failed_at"),
  lastError: text("last_error"),
  metrics: jsonb("metrics")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

The `studios`, `performers`, and `tags` references must resolve to existing exports in the same file. These are already defined higher up — do not add new imports.

- [ ] **Step 5: Typecheck the schema package**

```bash
pnpm --filter @obscura/db exec tsc --noEmit
```

Expected: no errors. If you see "Cannot find name 'performers'" or similar, confirm the new tables are placed below all the referenced tables (`studios`, `performers`, `tags`, `libraryRoots`) in the file. They should be at the very bottom.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): add video series schema and data_migrations table"
```

---

### Task 10: Generate and review the Drizzle migration

**Files:**
- Create: `apps/api/drizzle/0010_<name>.sql` (generated)
- Modify: `apps/api/drizzle/meta/_journal.json` (generated)

- [ ] **Step 1: Generate the migration**

```bash
pnpm --filter @obscura/api db:generate
```

Expected: drizzle-kit prints something like `✓ Your SQL migration file ➜ drizzle/0010_<adjective>_<noun>.sql` and updates `drizzle/meta/_journal.json`. Note the generated filename — you'll need it in the next task.

- [ ] **Step 2: Open the generated SQL file and read it top to bottom**

```bash
ls apps/api/drizzle/0010_*.sql
cat apps/api/drizzle/0010_*.sql
```

Expected SQL content — a `CREATE TABLE` for each of:

- `video_series`
- `video_seasons`
- `video_episodes`
- `video_movies`
- `video_movie_performers`
- `video_movie_tags`
- `video_series_performers`
- `video_series_tags`
- `video_episode_performers`
- `video_episode_tags`
- `data_migrations`

Plus `ALTER TABLE library_roots ADD COLUMN scan_movies ...` and `ADD COLUMN scan_series ...`. Plus `CREATE UNIQUE INDEX` and `CREATE INDEX` statements for every index declared in the schema.

**Review checklist (per CLAUDE.md):**
- No `DROP TABLE` anywhere in the file.
- No `DROP COLUMN` anywhere.
- No column renames (drizzle-kit emits those as drop-then-add — **stop and fix by hand** if you see one).
- Every foreign key has an `ON DELETE` clause that matches the `.references()` call in schema.ts.
- The `--> statement-breakpoint` separator appears between statements.

If the file looks correct, continue. If there's anything destructive, stop and flag it to the user before proceeding.

- [ ] **Step 3: Append functional BTREE indexes for `external_ids`**

Drizzle-kit cannot emit functional indexes on JSONB expressions from the `pgTable` definition, so we add them by hand to the generated SQL file. These cover the scraping-dedupe lookups that plans C and D rely on.

Append the following to the end of the generated `apps/api/drizzle/0010_*.sql` file, with a `--> statement-breakpoint` separator between each statement and the preceding one:

```sql
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_series_tmdb_idx"
  ON "video_series" ((external_ids->>'tmdb'));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_seasons_tmdb_idx"
  ON "video_seasons" ((external_ids->>'tmdb'));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_episodes_tmdb_idx"
  ON "video_episodes" ((external_ids->>'tmdb'));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_movies_tmdb_idx"
  ON "video_movies" ((external_ids->>'tmdb'));
```

`IF NOT EXISTS` is used so the migration is safe to re-run if a partial apply ever happens. These indexes are intentionally TMDb-only — additional provider indexes can be added in follow-up migrations when new plugins justify them.

- [ ] **Step 4: Commit the generated migration and journal**

```bash
git add apps/api/drizzle/0010_*.sql apps/api/drizzle/meta/_journal.json
git commit -m "feat(db): generate migration 0010 for video series schema"
```

---

### Task 11: Add `LEGACY_SCHEMA_SENTINELS` entry for migration 0010

**Files:**
- Modify: `apps/api/src/db/migrate.ts`

Per CLAUDE.md: "Whenever you add a new `drizzle/NNNN_*.sql` file, add a matching entry to `LEGACY_SCHEMA_SENTINELS` in the same commit so the smart bridge can detect the new migration on legacy installs."

This is a separate commit from Task 10 only because the two files live in different packages and we want each commit atomic. If you prefer, squash these two commits — both are part of the same logical change.

- [ ] **Step 1: Open `apps/api/src/db/migrate.ts` to the `LEGACY_SCHEMA_SENTINELS` block**

```bash
grep -n "LEGACY_SCHEMA_SENTINELS" apps/api/src/db/migrate.ts
```

Expected: line number around 135.

- [ ] **Step 2: Find the exact migration filename generated in Task 10**

```bash
ls apps/api/drizzle/0010_*.sql | sed 's|.*/||; s|\.sql$||'
```

Note the name (e.g. `0010_happy_aurora`). The sentinel key must match exactly.

- [ ] **Step 3: Add the sentinel entry**

In `apps/api/src/db/migrate.ts`, add a new line inside `LEGACY_SCHEMA_SENTINELS` after the `0009_gray_yellowjacket` entry, substituting the actual filename from Step 2:

```ts
  "0009_gray_yellowjacket": (c) => tableExists(c, "external_ids"),
  "0010_<filename-from-step-2>": (c) => tableExists(c, "video_series"),
};
```

The sentinel uses `video_series` because it's unambiguously created by migration 0010 and never existed before it.

- [ ] **Step 4: Typecheck the API package**

```bash
pnpm --filter @obscura/api exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/migrate.ts
git commit -m "feat(api): add legacy schema sentinel for migration 0010"
```

---

### Task 12: Apply migration against a local dev database and verify

**Files:** no file changes, verification only.

- [ ] **Step 1: Confirm a local database is reachable**

```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres
```

or equivalent for your local setup. Expected: postgres container healthy.

- [ ] **Step 2: Run the migrator**

```bash
pnpm --filter @obscura/api db:migrate
```

Expected output: `[obscura migrate] Migrations up to date` and `[obscura migrate] Schema reconcile complete`, with no errors.

- [ ] **Step 3: Verify the new tables exist in the database**

```bash
docker compose -f infra/docker/docker-compose.yml exec -T postgres \
  psql -U obscura -d obscura -c "\dt video_*"
```

Expected: a listing that includes `video_series`, `video_seasons`, `video_episodes`, `video_movies`, `video_movie_performers`, `video_movie_tags`, `video_series_performers`, `video_series_tags`, `video_episode_performers`, `video_episode_tags`.

- [ ] **Step 4: Verify `data_migrations` exists**

```bash
docker compose -f infra/docker/docker-compose.yml exec -T postgres \
  psql -U obscura -d obscura -c "\d data_migrations"
```

Expected: column listing matching the schema — `name text PK`, `status text`, `staged_at timestamp`, `finalized_at timestamp`, `failed_at timestamp`, `last_error text`, `metrics jsonb`, `created_at timestamp`, `updated_at timestamp`.

- [ ] **Step 5: Verify new library_roots columns**

```bash
docker compose -f infra/docker/docker-compose.yml exec -T postgres \
  psql -U obscura -d obscura -c "\d library_roots"
```

Expected: `scan_movies` and `scan_series` columns present alongside `scan_videos`, both boolean, both `NOT NULL DEFAULT false`.

- [ ] **Step 6: Verify scenes and scene_folders are still intact**

```bash
docker compose -f infra/docker/docker-compose.yml exec -T postgres \
  psql -U obscura -d obscura -c "\dt scenes"
docker compose -f infra/docker/docker-compose.yml exec -T postgres \
  psql -U obscura -d obscura -c "\dt scene_folders"
```

Expected: both still listed. This plan is additive only.

No commit — this task is verification only.

---

### Task 13: DataMigration interface types

**Files:**
- Create: `apps/api/src/db/data-migrations/types.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p apps/api/src/db/data-migrations
```

- [ ] **Step 2: Write the types file**

Write `apps/api/src/db/data-migrations/types.ts`:

```ts
import type { Sql } from "postgres";

/**
 * The four lifecycle states a data migration can be in. Stored in
 * `data_migrations.status` as text.
 *
 * - pending     — not yet staged. Will be staged on next boot.
 * - staging     — stage() is currently running (transient; only visible
 *                 if a previous process crashed mid-stage).
 * - staged      — stage() completed successfully. Waiting for a user to
 *                 click the finalize button. Write lockdown is active.
 * - finalizing  — finalize() is currently running (transient).
 * - complete    — fully done. Will be skipped on future boots.
 * - failed      — stage() or finalize() threw. last_error holds the
 *                 message. Operator must investigate and clear manually.
 */
export type DataMigrationStatus =
  | "pending"
  | "staging"
  | "staged"
  | "finalizing"
  | "complete"
  | "failed";

export interface DataMigrationRow {
  name: string;
  status: DataMigrationStatus;
  stagedAt: Date | null;
  finalizedAt: Date | null;
  failedAt: Date | null;
  lastError: string | null;
  metrics: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataMigrationContext {
  /**
   * Raw postgres.js client. Use this for SQL, transactions, and adapter
   * reads against retired-table schemas. Drizzle is intentionally NOT
   * exposed here — data migrations own their own query shapes and must
   * not import from packages/db/src/schema.ts for tables that may be
   * retired later.
   */
  client: Sql;
  logger: {
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
  };
  reportProgress(pct: number, message?: string): void;
}

export interface PrecheckResult {
  ok: boolean;
  reasons: string[];
}

export interface StageResult {
  metrics: Record<string, unknown>;
  warnings: string[];
}

export interface FinalizeResult {
  metrics: Record<string, unknown>;
}

export interface DataMigration {
  /** Stable unique id. E.g. "videos_to_series_model_v1". */
  name: string;
  /** Human-readable description shown in the migration banner. */
  description: string;
  /**
   * Optional safety check. Called before stage(). Return `{ok: false, reasons}`
   * to skip the migration entirely and leave status `pending` with a warning.
   * Use this to detect "fresh install, nothing to migrate" conditions.
   */
  precheck?(ctx: DataMigrationContext): Promise<PrecheckResult>;
  /**
   * Non-destructive. Reads from old tables (via a frozen legacy-schema
   * adapter owned by this migration), writes to new tables. Must run
   * inside a single transaction wrapper provided by the orchestrator.
   */
  stage(ctx: DataMigrationContext): Promise<StageResult>;
  /**
   * Destructive. Drops retired tables and columns. Only called via the
   * /system/migrations/:name/finalize endpoint after the user confirms.
   * Runs inside a transaction.
   */
  finalize(ctx: DataMigrationContext): Promise<FinalizeResult>;
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @obscura/api exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/db/data-migrations/types.ts
git commit -m "feat(api): add DataMigration interface types"
```

---

### Task 14: Registry file (empty)

**Files:**
- Create: `apps/api/src/db/data-migrations/registry.ts`

- [ ] **Step 1: Write the registry file**

Write `apps/api/src/db/data-migrations/registry.ts`:

```ts
import type { DataMigration } from "./types";

/**
 * Ordered list of registered data migrations. The orchestrator walks
 * this array in declaration order on every boot.
 *
 * Plan B adds `videos_to_series_model_v1` to this list. Plan A
 * intentionally ships it empty so the framework can be exercised
 * without any destructive migration in flight.
 */
export const dataMigrationsRegistry: DataMigration[] = [];
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/db/data-migrations/registry.ts
git commit -m "feat(api): add empty data migrations registry"
```

---

### Task 15: Orchestrator (`run.ts`)

**Files:**
- Create: `apps/api/src/db/data-migrations/run.ts`

- [ ] **Step 1: Write the orchestrator**

Write `apps/api/src/db/data-migrations/run.ts`:

```ts
import type { Sql } from "postgres";
import { dataMigrationsRegistry } from "./registry";
import type {
  DataMigration,
  DataMigrationContext,
  DataMigrationRow,
  DataMigrationStatus,
} from "./types";

function makeContext(client: Sql): DataMigrationContext {
  return {
    client,
    logger: {
      info: (msg, meta) => console.log(`[data-migration] ${msg}`, meta ?? {}),
      warn: (msg, meta) =>
        console.warn(`[data-migration] ${msg}`, meta ?? {}),
      error: (msg, meta) =>
        console.error(`[data-migration] ${msg}`, meta ?? {}),
    },
    reportProgress: (pct, message) => {
      console.log(
        `[data-migration] progress=${pct}${message ? ` ${message}` : ""}`,
      );
    },
  };
}

async function ensureRow(
  client: Sql,
  migration: DataMigration,
): Promise<DataMigrationRow> {
  const existing = await client<DataMigrationRow[]>`
    SELECT
      name,
      status,
      staged_at      AS "stagedAt",
      finalized_at   AS "finalizedAt",
      failed_at      AS "failedAt",
      last_error     AS "lastError",
      metrics,
      created_at     AS "createdAt",
      updated_at     AS "updatedAt"
    FROM data_migrations
    WHERE name = ${migration.name}
  `;
  if (existing.length > 0) return existing[0];

  const inserted = await client<DataMigrationRow[]>`
    INSERT INTO data_migrations (name, status, metrics)
    VALUES (${migration.name}, 'pending', '{}'::jsonb)
    RETURNING
      name,
      status,
      staged_at      AS "stagedAt",
      finalized_at   AS "finalizedAt",
      failed_at      AS "failedAt",
      last_error     AS "lastError",
      metrics,
      created_at     AS "createdAt",
      updated_at     AS "updatedAt"
  `;
  return inserted[0];
}

async function setStatus(
  client: Sql,
  name: string,
  patch: {
    status: DataMigrationStatus;
    metrics?: Record<string, unknown>;
    stagedAt?: Date;
    finalizedAt?: Date;
    failedAt?: Date;
    lastError?: string | null;
  },
): Promise<void> {
  await client`
    UPDATE data_migrations
    SET
      status        = ${patch.status},
      metrics       = COALESCE(${patch.metrics ?? null}::jsonb, metrics),
      staged_at     = COALESCE(${patch.stagedAt ?? null}, staged_at),
      finalized_at  = COALESCE(${patch.finalizedAt ?? null}, finalized_at),
      failed_at     = COALESCE(${patch.failedAt ?? null}, failed_at),
      last_error    = ${patch.lastError ?? null},
      updated_at    = now()
    WHERE name = ${name}
  `;
}

export interface StageBootReport {
  name: string;
  status: DataMigrationStatus;
  description: string;
}

/**
 * Runs all registered migrations to the `staged` state (or skips them
 * if already staged/complete). Called from runMigrations() after the
 * drizzle migrator finishes. Never runs finalize() — that only happens
 * via the /system/migrations/:name/finalize endpoint.
 *
 * Returns a report the caller can use to log boot status. Does not
 * throw for individual migration failures — they're recorded as
 * `failed` and the boot continues in a degraded state.
 */
export async function runStagedMigrations(
  client: Sql,
): Promise<StageBootReport[]> {
  const report: StageBootReport[] = [];

  for (const migration of dataMigrationsRegistry) {
    const row = await ensureRow(client, migration);
    const ctx = makeContext(client);

    if (row.status === "complete") {
      report.push({
        name: migration.name,
        status: "complete",
        description: migration.description,
      });
      continue;
    }

    if (row.status === "staged") {
      ctx.logger.info(
        `migration ${migration.name} is staged and awaiting finalize`,
      );
      report.push({
        name: migration.name,
        status: "staged",
        description: migration.description,
      });
      continue;
    }

    if (row.status === "failed") {
      ctx.logger.error(
        `migration ${migration.name} is in failed state — skipping`,
        { lastError: row.lastError },
      );
      report.push({
        name: migration.name,
        status: "failed",
        description: migration.description,
      });
      continue;
    }

    if (row.status === "pending" || row.status === "staging") {
      if (migration.precheck) {
        const precheck = await migration.precheck(ctx);
        if (!precheck.ok) {
          ctx.logger.info(
            `migration ${migration.name} precheck failed — skipping`,
            { reasons: precheck.reasons },
          );
          // Leave status as pending; it'll be retried on next boot.
          report.push({
            name: migration.name,
            status: "pending",
            description: migration.description,
          });
          continue;
        }
      }

      await setStatus(client, migration.name, { status: "staging" });
      try {
        const result = await client.begin(async (tx) => {
          return migration.stage({ ...ctx, client: tx });
        });
        await setStatus(client, migration.name, {
          status: "staged",
          metrics: result.metrics,
          stagedAt: new Date(),
          lastError: null,
        });
        ctx.logger.info(`migration ${migration.name} staged`, result.metrics);
        report.push({
          name: migration.name,
          status: "staged",
          description: migration.description,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await setStatus(client, migration.name, {
          status: "failed",
          failedAt: new Date(),
          lastError: message,
        });
        ctx.logger.error(`migration ${migration.name} stage() threw`, {
          message,
        });
        report.push({
          name: migration.name,
          status: "failed",
          description: migration.description,
        });
      }
    }
  }

  return report;
}

/**
 * Runs the finalize phase for a single named migration. Called from
 * the /system/migrations/:name/finalize route handler. Throws on
 * missing/invalid state — the caller translates that into an HTTP error.
 */
export async function finalizeMigration(
  client: Sql,
  name: string,
): Promise<void> {
  const migration = dataMigrationsRegistry.find((m) => m.name === name);
  if (!migration) {
    throw new Error(`Unknown migration: ${name}`);
  }
  const rows = await client<DataMigrationRow[]>`
    SELECT status FROM data_migrations WHERE name = ${name}
  `;
  if (rows.length === 0) {
    throw new Error(`Migration row not found: ${name}`);
  }
  if (rows[0].status !== "staged") {
    throw new Error(
      `Migration ${name} is in status ${rows[0].status}, cannot finalize`,
    );
  }

  const ctx = makeContext(client);
  await setStatus(client, name, { status: "finalizing" });
  try {
    const result = await client.begin(async (tx) => {
      return migration.finalize({ ...ctx, client: tx });
    });
    await setStatus(client, name, {
      status: "complete",
      metrics: result.metrics,
      finalizedAt: new Date(),
      lastError: null,
    });
    ctx.logger.info(`migration ${name} finalized`, result.metrics);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setStatus(client, name, {
      status: "failed",
      failedAt: new Date(),
      lastError: message,
    });
    throw err;
  }
}

/**
 * Returns the current status of every registered migration for use by
 * the /system/status endpoint. Never throws.
 */
export async function getMigrationStatuses(
  client: Sql,
): Promise<StageBootReport[]> {
  const rows = await client<Array<{ name: string; status: DataMigrationStatus }>>`
    SELECT name, status FROM data_migrations
  `;
  const byName = new Map(rows.map((r) => [r.name, r.status]));
  return dataMigrationsRegistry.map((m) => ({
    name: m.name,
    description: m.description,
    status: byName.get(m.name) ?? "pending",
  }));
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @obscura/api exec tsc --noEmit
```

Expected: no errors. If `client.begin` has a different signature in the project's postgres-js version, adjust — the shape is `(fn: (tx: Sql) => Promise<T>) => Promise<T>`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/data-migrations/run.ts
git commit -m "feat(api): add data migration orchestrator"
```

---

### Task 16: Wire orchestrator into `runMigrations`

**Files:**
- Modify: `apps/api/src/db/migrate.ts`

- [ ] **Step 1: Add the import**

Near the top of `apps/api/src/db/migrate.ts`, after the existing imports, add:

```ts
import { runStagedMigrations } from "./data-migrations/run";
```

- [ ] **Step 2: Call the orchestrator after `reconcileSchema`**

Find the block near line 505:

```ts
    await reconcileSchema(client);
    console.log("[obscura migrate] Schema reconcile complete");
  } finally {
    await client.end();
  }
```

Replace it with:

```ts
    await reconcileSchema(client);
    console.log("[obscura migrate] Schema reconcile complete");

    // Run any registered staged data migrations. Each registered
    // migration is driven to the `staged` state (or skipped if already
    // staged/complete/failed). Finalize is user-initiated via the
    // /system/migrations/:name/finalize endpoint.
    const report = await runStagedMigrations(client);
    if (report.length > 0) {
      console.log("[obscura migrate] Data migration status:", report);
    }
  } finally {
    await client.end();
  }
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @obscura/api exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run the migrator to exercise the empty registry path**

```bash
pnpm --filter @obscura/api db:migrate
```

Expected: normal migration output followed by no data-migration messages (the registry is empty). The `[obscura migrate] Data migration status:` line should not print since the report array is empty.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/migrate.ts
git commit -m "feat(api): wire data migration orchestrator into runMigrations"
```

---

### Task 17: Write-lockdown guard helper

**Files:**
- Create: `apps/api/src/db/data-migrations/lockdown.ts`

This module exposes a single function that route handlers can call to check whether the API is currently in a lockdown state due to a staged or finalizing migration. Plan A ships it but does not wire it into any routes — Plan B wires it into the scan and video-write handlers as those routes get built.

- [ ] **Step 1: Write the module**

Write `apps/api/src/db/data-migrations/lockdown.ts`:

```ts
import type { Sql } from "postgres";
import type { DataMigrationStatus } from "./types";

export interface LockdownStatus {
  /** True when a registered migration is in `staged` or `finalizing` state. */
  active: boolean;
  /** The name of the first migration that caused the lockdown, if active. */
  blockedBy: string | null;
  /** The status of that blocking migration. */
  blockingStatus: DataMigrationStatus | null;
}

/**
 * Check the `data_migrations` table for any migration in a state that
 * should block video writes. Reads are permitted during all states.
 *
 * This function is cheap (single indexed query) and safe to call from
 * route handlers on every write request.
 */
export async function getLockdownStatus(
  client: Sql,
): Promise<LockdownStatus> {
  const rows = await client<
    Array<{ name: string; status: DataMigrationStatus }>
  >`
    SELECT name, status
    FROM data_migrations
    WHERE status IN ('staged', 'finalizing', 'staging')
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  if (rows.length === 0) {
    return { active: false, blockedBy: null, blockingStatus: null };
  }
  return {
    active: true,
    blockedBy: rows[0].name,
    blockingStatus: rows[0].status,
  };
}

/**
 * Throws a standard error with a machine-readable `.code` property if
 * video writes are currently locked down. Route handlers should call
 * this at the top of any write path that touches video entities.
 *
 * Example:
 *   await assertNotLockedDown(client);
 *   await writeTheThing(...);
 */
export async function assertNotLockedDown(client: Sql): Promise<void> {
  const status = await getLockdownStatus(client);
  if (!status.active) return;
  const err = new Error(
    `Video writes are temporarily disabled while migration "${status.blockedBy}" is ${status.blockingStatus}.`,
  );
  (err as Error & { code?: string }).code = "MIGRATION_LOCKDOWN";
  throw err;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @obscura/api exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/data-migrations/lockdown.ts
git commit -m "feat(api): add write-lockdown guard helper for data migrations"
```

---

### Task 18: System route constants in contracts

**Files:**
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Find the end of the apiRoutes object**

```bash
grep -n "^} as const" packages/contracts/src/index.ts | head -5
```

Identify the closing `} as const;` of the `apiRoutes` object.

- [ ] **Step 2: Add the new system routes**

Insert these entries just before the closing `} as const;` of `apiRoutes`:

```ts
  systemStatus: "/system/status",
  systemMigrationFinalize: "/system/migrations/:name/finalize",
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @obscura/contracts exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/src/index.ts
git commit -m "feat(contracts): add system status and migration finalize routes"
```

---

### Task 19: `/system/*` route handlers

**Files:**
- Create: `apps/api/src/routes/system.ts`

- [ ] **Step 1: Write the route file**

Write `apps/api/src/routes/system.ts`:

```ts
import type { FastifyInstance } from "fastify";
import { apiRoutes } from "@obscura/contracts";
import { getDatabaseClient } from "../db";
import {
  finalizeMigration,
  getMigrationStatuses,
} from "../db/data-migrations/run";
import { getLockdownStatus } from "../db/data-migrations/lockdown";

export async function systemRoutes(app: FastifyInstance) {
  app.get(apiRoutes.systemStatus, async () => {
    const client = getDatabaseClient();
    const [migrations, lockdown] = await Promise.all([
      getMigrationStatuses(client),
      getLockdownStatus(client),
    ]);
    return {
      migrations,
      lockdown,
    };
  });

  app.post(apiRoutes.systemMigrationFinalize, async (request, reply) => {
    const { name } = request.params as { name: string };
    const client = getDatabaseClient();
    try {
      await finalizeMigration(client, name);
      return { ok: true, name };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(400);
      return { ok: false, error: message };
    }
  });
}
```

- [ ] **Step 2: Confirm `getDatabaseClient` exists**

```bash
grep -n "getDatabaseClient\|export function" apps/api/src/db/index.ts | head -20
```

Expected: a function or export that returns the raw postgres client. If it doesn't exist under that exact name, find the equivalent (e.g. `getClient`, `getSql`, `sql`) and substitute it in the import. The goal is a raw `Sql` instance from the `postgres` driver — the same type the migration orchestrator consumes.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @obscura/api exec tsc --noEmit
```

Expected: no errors. If `getDatabaseClient` isn't exported from `./db`, adjust the import to use whatever the project already uses to get the raw client. If no such helper exists, stop and add one — do not inline `postgres()` in the route handler.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/system.ts
git commit -m "feat(api): add /system/status and /system/migrations/:name/finalize routes"
```

---

### Task 20: Register system routes in `app.ts`

**Files:**
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Add the import**

In `apps/api/src/app.ts`, add after the existing route imports (around line 26):

```ts
import { systemRoutes } from "./routes/system";
```

- [ ] **Step 2: Register the route**

After `await app.register(pluginsRoutes);` (around line 90), add:

```ts
  await app.register(systemRoutes);
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @obscura/api exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Smoke-test the system status endpoint**

Start the API locally:

```bash
pnpm --filter @obscura/api dev
```

In another terminal:

```bash
curl -s http://localhost:4000/system/status | head -50
```

Expected: JSON with `{"migrations":[],"lockdown":{"active":false,"blockedBy":null,"blockingStatus":null}}`. The empty migrations array is correct — Plan A registers nothing.

Stop the dev server with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.ts
git commit -m "feat(api): register system routes"
```

---

### Task 21: Developer README for the data-migrations framework

**Files:**
- Create: `apps/api/src/db/data-migrations/README.md`

- [ ] **Step 1: Write the README**

Write `apps/api/src/db/data-migrations/README.md`:

```markdown
# Data Migrations Framework

This directory holds Obscura's reusable two-phase data migration
system. It is distinct from drizzle's `__drizzle_migrations` table,
which tracks schema DDL. The `data_migrations` table tracks data
*reshapes* that span two boots and preserve user state.

## When to use this

Use a data migration when you need to reshape existing rows across
tables in a way that can't be expressed as a simple `ALTER TABLE` or
backfill — for example, splitting one table into several typed tables,
merging entities, or changing the semantic model. Schema-only changes
continue to ship as drizzle migrations.

## Lifecycle

Each migration progresses through these states stored in
`data_migrations.status`:

1. **pending** — registered but not yet run.
2. **staging** — `stage()` is running (transient; only visible if a
   prior process crashed mid-stage).
3. **staged** — `stage()` succeeded. The app is in write-lockdown for
   affected entities. The web UI shows a banner with a finalize button.
4. **finalizing** — `finalize()` is running (transient).
5. **complete** — done. Skipped on future boots.
6. **failed** — `stage()` or `finalize()` threw. `last_error` holds the
   message. Requires manual investigation before retry.

## Writing a new migration

1. Create a directory `apps/api/src/db/data-migrations/<name>/`.
2. Inside it, add `index.ts` exporting a `DataMigration` object.
3. Add any frozen legacy-schema adapter modules for retired tables in
   the same directory — the main schema file must not reference
   retired tables.
4. Register the migration in `registry.ts` by appending it to
   `dataMigrationsRegistry` in the correct order.
5. When `finalize()` has shipped and been exercised, delete the legacy
   adapter modules in a follow-up commit.

## Contract

```ts
interface DataMigration {
  name: string;              // unique, stable
  description: string;       // shown in the UI banner
  precheck?(ctx): Promise<PrecheckResult>;
  stage(ctx): Promise<StageResult>;     // non-destructive, runs in a tx
  finalize(ctx): Promise<FinalizeResult>; // destructive, runs in a tx
}
```

- `stage()` runs automatically on boot after drizzle DDL migrations.
- `finalize()` only runs via a user click on `POST /system/migrations/:name/finalize`.
- Both run inside `client.begin` transactions provided by the
  orchestrator.
- `precheck()` is optional. Return `{ok: false, reasons}` to leave the
  migration in `pending` (e.g. "fresh install, nothing to migrate").

## Write lockdown

While any registered migration is in `staged` or `finalizing` state,
route handlers that write to affected entities must call
`assertNotLockedDown(client)` from `./lockdown.ts` and let the
resulting `MIGRATION_LOCKDOWN` error propagate. Reads are always
permitted. Images/galleries/audio routes are unaffected because this
plan is a video-subsystem reshape.
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/db/data-migrations/README.md
git commit -m "docs(api): document data migrations framework"
```

---

### Task 22: Add CHANGELOG entry

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add an entry under `## [Unreleased]`**

Under the existing `### Docs` entry we added when the spec was committed (or a new section if it's not there), append to the appropriate groups:

Add to `### Added`:

```markdown
- **Video series data model foundation (Plan A).** New `video_series`, `video_seasons`, `video_episodes`, `video_movies` tables with typed join tables, `data_migrations` framework table, and `library_roots.scan_movies` / `scan_series` columns. All additive — `scenes` and `scene_folders` are untouched. Not yet populated; this lands the tables so Plan B can migrate data into them.
- **Staged data migration framework.** Reusable `DataMigration` interface with a boot-time orchestrator, empty registry, write-lockdown guard, and `GET /system/status` / `POST /system/migrations/:name/finalize` endpoints. No concrete migration is registered yet.
- **Folder and filename parsing library** (`packages/media-core/src/parsing/`). Pure functions for `parseSeasonFolder`, `parseSeriesFolder`, `parseEpisodeFilename`, `parseMovieFilename`, with comprehensive unit tests. Supports English and common non-English season variants, bare numbers, absolute episode numbers (anime convention), and year extraction.
- **External IDs contract.** New `ExternalIds` type and `KnownExternalIdProviders` constants in `@obscura/contracts`, with typed `get`/`set`/`has`/`merge` helpers in `@obscura/plugins`.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for Plan A data model foundation"
```

---

### Task 23: Final integration check

**Files:** no file changes, verification only.

- [ ] **Step 1: Full typecheck across the repo**

```bash
pnpm typecheck
```

Expected: all packages pass.

- [ ] **Step 2: Full unit test run**

```bash
pnpm test:unit
```

Expected: all tests pass, including all four parser test files.

- [ ] **Step 3: Run the migrator one more time to confirm idempotence**

```bash
pnpm --filter @obscura/api db:migrate
```

Expected: `[obscura migrate] Migrations up to date`, no new migrations applied, no errors.

- [ ] **Step 4: Smoke-test the system status endpoint one more time**

```bash
pnpm --filter @obscura/api dev &
sleep 3
curl -s http://localhost:4000/system/status
# Stop the dev server however you normally do (fg + Ctrl+C, or kill %1)
```

Expected: same empty-migrations JSON as before.

- [ ] **Step 5: Confirm scenes/scene_folders are still present and healthy**

```bash
docker compose -f infra/docker/docker-compose.yml exec -T postgres \
  psql -U obscura -d obscura -c "SELECT count(*) FROM scenes"
docker compose -f infra/docker/docker-compose.yml exec -T postgres \
  psql -U obscura -d obscura -c "SELECT count(*) FROM scene_folders"
```

Expected: row counts match what they were before the migration. This plan is strictly additive.

No commit — verification only.

Plan A is complete. The next plan (Plan B: Scan pipeline and videos_to_series_model_v1 data migration) builds on everything here.

---

## Notes for the implementing engineer

- **Write lockdown is inert in Plan A.** `assertNotLockedDown` exists but is not called from any route. Plan B wires it into the scan worker and any video-write route as those get built. Do not retrofit existing scenes routes to call it — scenes writes stay permitted until the migration is registered.
- **The registry is empty on purpose.** If you're tempted to register a no-op migration to exercise the orchestrator, don't — the smoke test in Task 23 Step 4 exercises the no-migration path which is the correct behavior for Plan A.
- **External IDs helpers are not yet used by anything.** Plugins package exports them so Plan C can import them. No caller exists in Plan A. This is expected — the helpers have unit tests of their own if you want to add them (not required for the plan to ship), but a Plan A integration test isn't needed because nothing else consumes them yet.
- **The parsing library is not yet called from the scan pipeline.** Plan B imports it into the new `processLibraryScan`. In Plan A the parsers live in isolation and only the unit tests exercise them.
- **Schema re-export.** `apps/api/src/db/schema.ts` re-exports everything from `packages/db/src/schema.ts`. You do not need to touch `apps/api/src/db/schema.ts` at all — only edit the canonical file in the `@obscura/db` package.
- **`scan_movies` / `scan_series` defaults are `false`.** The UI work in Plan D adds toggles. Until then, existing libraries keep scanning via the legacy `scan_videos` pathway. Plan B's migration decides whether to flip these flags during stage() based on the user's existing `scan_videos` value and inferred content layout.
