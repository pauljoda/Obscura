/**
 * Database migration runner.
 *
 * Replaces `drizzle-kit push --force` at startup, which blindly applies every
 * diff drizzle-kit infers against the live schema and — with --force — cannot
 * be vetoed. That's fine on a fresh install but dangerous on upgrades: any
 * drift (a renamed column, a removed FK, anything) becomes a silent DROP.
 *
 * This runner uses drizzle-orm's migrator with versioned SQL files committed
 * under `apps/api/drizzle/`. Each migration applies idempotently once, tracked
 * in `drizzle.__drizzle_migrations`.
 *
 * Bridging existing installs:
 *
 * Before this runner existed, the production image applied schema via
 * `drizzle-kit push`, so existing deployments have some subset of the tables
 * but no `__drizzle_migrations` row. Running the migrator against that state
 * would re-run `CREATE TABLE ...` and fail on duplicates. We detect the
 * "legacy push install" by checking for `library_roots` without
 * `__drizzle_migrations`, and for those installs we:
 *   1. Apply this release's pre-baseline deltas — push-only schema tweaks
 *      that align the live schema with migration 0000 (the baseline).
 *      Idempotent via ADD/DROP COLUMN IF (NOT) EXISTS so re-running is safe.
 *   2. Probe each journal entry's sentinel against the live schema to find
 *      the highest migration the install has already reached, and seed ONLY
 *      that prefix of entries into `__drizzle_migrations` as "already
 *      applied". Anything beyond is left unseeded so the drizzle migrator
 *      runs those files normally on the next step.
 *
 * Why probe instead of seeding everything? An older bridge marked every
 * journal entry as applied unconditionally. That worked for installs whose
 * schema happened to match the latest migration, but silently lied to the
 * migrator about older installs: any migration the install hadn't actually
 * reached was marked applied and never ran, permanently stranding the DB
 * without the tables/columns that migration creates. The probe-based
 * approach degrades gracefully — installs that are truly current get the
 * same behaviour as before, and older installs pick up the missing
 * migrations via the normal migrator path.
 *
 * Fresh installs go through the migrator normally — migration 0000 builds the
 * full schema from scratch.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { runStagedMigrations } from "./data-migrations/run";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_FOLDER = path.resolve(__dirname, "../../drizzle");

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

async function readJournal(): Promise<Journal> {
  const journalPath = path.join(MIGRATIONS_FOLDER, "meta", "_journal.json");
  const raw = await readFile(journalPath, "utf8");
  return JSON.parse(raw) as Journal;
}

async function hashMigration(tag: string): Promise<string> {
  const sql = await readFile(path.join(MIGRATIONS_FOLDER, `${tag}.sql`), "utf8");
  return createHash("sha256").update(sql).digest("hex");
}

type SqlClient = ReturnType<typeof postgres>;

async function tableExists(
  client: SqlClient,
  tableName: string,
): Promise<boolean> {
  const [{ exists }] = await client<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${tableName}
    ) AS exists
  `;
  return exists;
}

async function columnExists(
  client: SqlClient,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const [{ exists }] = await client<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
        AND column_name = ${columnName}
    ) AS exists
  `;
  return exists;
}

/**
 * For each drizzle journal entry, a small introspection check that returns
 * `true` iff the migration's schema is already present in the live database.
 *
 * This is how the legacy-install bridge figures out how far a push-managed
 * install has progressed without a `__drizzle_migrations` ledger to read.
 * The bridge walks the journal in order, asks each sentinel, and seeds every
 * entry up to the first "not applied" as already applied — anything beyond
 * that point is left for the drizzle migrator to run in the normal path.
 *
 * Rules for keeping this in sync:
 *   - **Every journal entry must have a sentinel.** When you add a new
 *     `drizzle/NNNN_*.sql` file, add a matching probe here in the same PR.
 *   - Pick a sentinel that is unambiguously created or altered *by that
 *     migration*. Prefer a new table/column the migration introduces.
 *   - The probe must be safe on older installs too — a column check returns
 *     false cleanly if the table doesn't exist yet, but don't use probes
 *     that reference objects from later migrations.
 *   - If a sentinel is missing at runtime, the bridge logs a warning and
 *     stops detection at the previous entry (conservative: it'd rather run
 *     a migration twice against idempotent SQL than silently skip schema).
 */
const LEGACY_SCHEMA_SENTINELS: Record<
  string,
  (client: SqlClient) => Promise<boolean>
> = {
  "0000_initial": (c) => tableExists(c, "library_roots"),
  "0001_wandering_blue_shield": (c) =>
    columnExists(c, "scene_subtitles", "source_format"),
  "0002_bored_piledriver": (c) =>
    columnExists(c, "library_settings", "generate_phash"),
  "0003_colossal_donald_blake": (c) =>
    tableExists(c, "fingerprint_submissions"),
  "0004_mysterious_alex_power": (c) => tableExists(c, "scene_folders"),
  "0005_romantic_thundra": (c) =>
    columnExists(c, "scene_folders", "custom_name"),
  "0006_steady_old_lace": (c) => tableExists(c, "scene_folder_performers"),
  "0007_slow_marvel_apes": (c) =>
    columnExists(c, "library_settings", "use_library_root_as_folder"),
  "0008_loud_loa": (c) => tableExists(c, "collection_items"),
  "0009_gray_yellowjacket": (c) => tableExists(c, "external_ids"),
  "0010_natural_meteorite": (c) => tableExists(c, "video_series"),
  "0011_amazing_invisible_woman": (c) =>
    columnExists(c, "scrape_results", "proposed_result"),
  "0012_little_bill_hollister": (c) =>
    columnExists(c, "fingerprint_submissions", "entity_type"),
  "0013_blushing_bruce_banner": (c) =>
    // Sentinel column lives on video_series; video_subtitles and
    // video_markers are both new in this migration so either would work.
    columnExists(c, "video_series", "custom_name"),
  "0014_majestic_zaran": async (c) =>
    // 0014 drops a bunch of legacy columns. "Applied" == "columns are
    // gone". Bridged installs that still have them stop detection here
    // so the drizzle migrator runs 0014 normally.
    !(await columnExists(c, "library_roots", "scan_videos")),
};

/**
 * Probe the live schema to find the highest journal idx that appears to be
 * already applied. Returns -1 if migration 0000's sentinel fails — that's
 * a weird state (the caller only invokes this once `library_roots` exists)
 * but we surface it so the caller can decide how to handle it.
 *
 * Stops at the first "not applied" entry. If probing reveals a hole (a
 * later migration applied but an earlier one missing) we still stop at the
 * first gap — running the migrator on top of a hole is safer than pretending
 * the hole isn't there.
 */
async function probeLegacySchemaLevel(
  client: SqlClient,
  journal: Journal,
): Promise<number> {
  let highestApplied = -1;
  for (const entry of journal.entries) {
    const probe = LEGACY_SCHEMA_SENTINELS[entry.tag];
    if (!probe) {
      console.warn(
        `[obscura migrate] Legacy bridge has no schema probe for ${entry.tag}; ` +
          `stopping detection at idx ${highestApplied}. Add a sentinel to ` +
          `LEGACY_SCHEMA_SENTINELS in apps/api/src/db/migrate.ts whenever a ` +
          `new migration file is added.`,
      );
      break;
    }
    if (!(await probe(client))) {
      break;
    }
    highestApplied = entry.idx;
  }
  return highestApplied;
}

/**
 * Idempotently re-apply schema deltas that legacy-bridged installs may be
 * missing. This is only needed for installs that were bridged under the
 * *older* bridge (which seeded every journal entry as applied regardless of
 * the live schema) and therefore have a `__drizzle_migrations` ledger that
 * lies about what they actually ran. The new smart bridge only seeds the
 * prefix it can prove is applied, so freshly bridged installs don't need
 * this step — it's a no-op for them.
 *
 * Rules for anything added here:
 *   - Must be idempotent. Guard columns/tables/indexes with IF (NOT) EXISTS;
 *     wrap constraints that lack IF NOT EXISTS in a DO block that swallows
 *     `duplicate_object`.
 *   - Must mirror what a corresponding `drizzle/NNNN_*.sql` file creates
 *     for fresh installs. This function is the legacy-install twin of the
 *     migrator, not a place to introduce new schema.
 *   - Guard ALTERs against tables that may not exist on very old installs
 *     (wrap in `IF EXISTS` table check) — the smart bridge now lets the
 *     migrator create those tables, and reconcile must not crash if it
 *     happens to run before the migrator on a pre-baseline install.
 */
async function reconcileSchema(client: SqlClient): Promise<void> {
  // Post videos-to-series finalize, the scene_* tables are gone. The
  // scene-specific reconcile blocks below only run when their target
  // table still exists, so reconcile is a safe no-op on a finalized
  // install.
  const hasSceneSubtitles = await tableExists(client, "scene_subtitles");
  const hasSceneFolders = await tableExists(client, "scene_folders");
  const hasScenes = await tableExists(client, "scenes");

  // 0001_wandering_blue_shield: scene_subtitles source metadata.
  if (hasSceneSubtitles) {
    await client`
      ALTER TABLE scene_subtitles
      ADD COLUMN IF NOT EXISTS source_format text NOT NULL DEFAULT 'vtt'
    `;
    await client`
      ALTER TABLE scene_subtitles
      ADD COLUMN IF NOT EXISTS source_path text
    `;
  }

  // 0002_bored_piledriver: pHash generation toggle on library settings.
  await client`
    ALTER TABLE library_settings
    ADD COLUMN IF NOT EXISTS generate_phash boolean NOT NULL DEFAULT false
  `;

  // 0007_slow_marvel_apes: optional library label as top folder in scans.
  await client`
    ALTER TABLE library_settings
    ADD COLUMN IF NOT EXISTS use_library_root_as_folder boolean NOT NULL DEFAULT false
  `;

  // 0003_colossal_donald_blake: fingerprint_submissions table + FKs + indexes.
  await client`
    CREATE TABLE IF NOT EXISTS fingerprint_submissions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      scene_id uuid NOT NULL,
      stash_box_endpoint_id uuid NOT NULL,
      algorithm text NOT NULL,
      hash text NOT NULL,
      status text NOT NULL,
      error text,
      submitted_at timestamp DEFAULT now() NOT NULL
    )
  `;
  // The FK to scenes is only meaningful pre-finalize. On post-finalize
  // installs the scenes table is gone and the FK can't be re-added —
  // migration 0012 (which predates 0014) already dropped it anyway, so
  // we only re-add it when both tables exist.
  if (hasScenes) {
    await client`
      DO $$ BEGIN
        ALTER TABLE fingerprint_submissions
        ADD CONSTRAINT fingerprint_submissions_scene_id_scenes_id_fk
        FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `;
  }
  await client`
    DO $$ BEGIN
      ALTER TABLE fingerprint_submissions
      ADD CONSTRAINT fingerprint_submissions_stash_box_endpoint_id_stash_box_endpoints_id_fk
      FOREIGN KEY (stash_box_endpoint_id) REFERENCES public.stash_box_endpoints(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `;
  await client`
    CREATE UNIQUE INDEX IF NOT EXISTS fingerprint_submissions_unique
    ON fingerprint_submissions (scene_id, stash_box_endpoint_id, algorithm, hash)
  `;
  await client`
    CREATE INDEX IF NOT EXISTS fingerprint_submissions_scene_idx
    ON fingerprint_submissions (scene_id)
  `;
  await client`
    CREATE INDEX IF NOT EXISTS fingerprint_submissions_endpoint_idx
    ON fingerprint_submissions (stash_box_endpoint_id)
  `;

  // 0006_steady_old_lace: scene_folder enrichment (backdrop, details, studio, rating, date)
  // + scene_folder_performers / scene_folder_tags join tables.
  //
  // scene_folders itself is created by migration 0004, so on very old push
  // installs this table may not exist yet. The smart bridge lets the drizzle
  // migrator create it, but we still guard the ALTERs here so reconcile is
  // a safe no-op if it runs before/without the migrator having built 0004.
  if (hasSceneFolders) {
    await client`
      ALTER TABLE scene_folders ADD COLUMN IF NOT EXISTS backdrop_image_path text
    `;
    await client`
      ALTER TABLE scene_folders ADD COLUMN IF NOT EXISTS details text
    `;
    await client`
      ALTER TABLE scene_folders ADD COLUMN IF NOT EXISTS studio_id uuid
    `;
    await client`
      ALTER TABLE scene_folders ADD COLUMN IF NOT EXISTS rating integer
    `;
    await client`
      ALTER TABLE scene_folders ADD COLUMN IF NOT EXISTS date text
    `;
    await client`
      DO $$ BEGIN
        ALTER TABLE scene_folders
        ADD CONSTRAINT scene_folders_studio_id_studios_id_fk
        FOREIGN KEY (studio_id) REFERENCES public.studios(id) ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `;

    // scene_folder_performers and scene_folder_tags only make sense
    // when scene_folders exists — post-finalize both these join tables
    // are gone and we skip the reconcile block entirely.
    await client`
      CREATE TABLE IF NOT EXISTS scene_folder_performers (
        scene_folder_id uuid NOT NULL,
        performer_id uuid NOT NULL
      )
    `;
    await client`
      DO $$ BEGIN
        ALTER TABLE scene_folder_performers
        ADD CONSTRAINT scene_folder_performers_scene_folder_id_scene_folders_id_fk
        FOREIGN KEY (scene_folder_id) REFERENCES public.scene_folders(id) ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `;
    await client`
      DO $$ BEGIN
        ALTER TABLE scene_folder_performers
        ADD CONSTRAINT scene_folder_performers_performer_id_performers_id_fk
        FOREIGN KEY (performer_id) REFERENCES public.performers(id) ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `;
    await client`
      CREATE UNIQUE INDEX IF NOT EXISTS scene_folder_performers_pk
      ON scene_folder_performers (scene_folder_id, performer_id)
    `;
    await client`
      CREATE INDEX IF NOT EXISTS scene_folder_performers_performer_idx
      ON scene_folder_performers (performer_id)
    `;
    await client`
      CREATE TABLE IF NOT EXISTS scene_folder_tags (
        scene_folder_id uuid NOT NULL,
        tag_id uuid NOT NULL
      )
    `;
    await client`
      DO $$ BEGIN
        ALTER TABLE scene_folder_tags
        ADD CONSTRAINT scene_folder_tags_scene_folder_id_scene_folders_id_fk
        FOREIGN KEY (scene_folder_id) REFERENCES public.scene_folders(id) ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `;
    await client`
      DO $$ BEGIN
        ALTER TABLE scene_folder_tags
        ADD CONSTRAINT scene_folder_tags_tag_id_tags_id_fk
        FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `;
    await client`
      CREATE UNIQUE INDEX IF NOT EXISTS scene_folder_tags_pk
      ON scene_folder_tags (scene_folder_id, tag_id)
    `;
    await client`
      CREATE INDEX IF NOT EXISTS scene_folder_tags_tag_idx
      ON scene_folder_tags (tag_id)
    `;
  }
}

/**
 * Applies versioned SQL migrations and legacy reconcile deltas. Safe to call
 * on every process start (unified image entrypoint, API boot, worker boot);
 * drizzle tracks applied files and reconcile uses IF NOT EXISTS.
 */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const client = postgres(databaseUrl, { max: 1 });

  try {
    // Does the schema already exist from a previous `drizzle-kit push` install?
    const [{ exists: hasCore }] = await client<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'library_roots'
      ) AS exists
    `;

    const [{ exists: hasMigrationsTable }] = await client<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
      ) AS exists
    `;

    if (hasCore && !hasMigrationsTable) {
      console.log(
        "[obscura migrate] Legacy push-managed install detected — applying bridge deltas",
      );

      // ── Pre-baseline deltas ─────────────────────────────────────────
      // Push-only schema tweaks that were never captured in a migration
      // file. Their purpose is to align the live schema with migration
      // 0000 (the baseline) so the bridge can honestly seed 0000 as
      // applied. Every statement is guarded with IF (NOT) EXISTS so the
      // bridge is safe to re-run — no transaction needed.
      //
      // Rules for adding new entries here:
      //   - Only add deltas whose final state is reflected in migration
      //     0000. Changes that belong to a specific later migration must
      //     live in that migration file — the smart probe below will let
      //     the drizzle migrator run them for installs that need them.
      //   - `scene_folders.custom_name` used to live here by mistake.
      //     It belongs to migration 0005 and is NOT part of the 0000
      //     baseline, so adding it here would crash on installs that
      //     predate 0004 (which creates the table). Don't repeat that.
      await client`
        ALTER TABLE library_settings
        ADD COLUMN IF NOT EXISTS default_playback_mode text NOT NULL DEFAULT 'direct'
      `;
      // scene_markers may no longer exist on installs that have already
      // finalized the videos-to-series migration. Only run these
      // pre-baseline deltas if the table is still present.
      if (await tableExists(client, "scene_markers")) {
        await client`
          ALTER TABLE scene_markers
          DROP CONSTRAINT IF EXISTS scene_markers_primary_tag_id_tags_id_fk
        `;
        await client`
          ALTER TABLE scene_markers
          DROP COLUMN IF EXISTS primary_tag_id
        `;
      }

      // ── Detect how far the install has actually progressed ────────
      // The older bridge seeded every journal entry as applied, which
      // silently broke installs that predated later migrations. Instead,
      // probe each migration's sentinel and seed only the prefix that
      // genuinely reflects the live schema. Anything beyond is left for
      // the drizzle migrator to run in the normal path below.
      const journal = await readJournal();
      const highestApplied = await probeLegacySchemaLevel(client, journal);

      if (highestApplied < 0) {
        console.log(
          "[obscura migrate] Legacy install does not match any known " +
            "migration baseline — falling through to the migrator. If this " +
            "is unexpected, stop and inspect the database before continuing.",
        );
      } else if (highestApplied === journal.entries.length - 1) {
        console.log(
          `[obscura migrate] Legacy install is current through ${journal.entries[highestApplied].tag}; ` +
            "no later migrations to apply.",
        );
      } else {
        const nextTag = journal.entries[highestApplied + 1]?.tag ?? "(none)";
        console.log(
          `[obscura migrate] Legacy install matches schema through ${journal.entries[highestApplied].tag} ` +
            `(idx ${highestApplied}); migrations from ${nextTag} onward will be applied by the migrator.`,
        );
      }

      await client`CREATE SCHEMA IF NOT EXISTS drizzle`;
      await client`
        CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at bigint
        )
      `;

      for (const entry of journal.entries) {
        if (entry.idx > highestApplied) break;
        const hash = await hashMigration(entry.tag);
        await client`
          INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
          VALUES (${hash}, ${entry.when})
        `;
      }

      console.log(
        "[obscura migrate] Bridge complete — schema now tracked by drizzle-orm migrator",
      );
    }

    // ── Run the migrator ───────────────────────────────────────────
    // On fresh installs this applies 0000 (and every subsequent migration).
    // On smart-bridged installs only the prefix detected as already
    // applied was seeded, so the migrator runs whatever comes after —
    // including any migrations the push install never reached.
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log("[obscura migrate] Migrations up to date");

    // ── Self-heal old-bridge drift ─────────────────────────────────
    // Installs bridged under the *previous* bridge had every journal
    // entry marked applied regardless of what they actually ran, so any
    // missing schema never arrives via the migrator. This reconcile
    // step idempotently re-applies those deltas so broken legacy
    // installs self-heal on their next boot. It's a no-op for fresh
    // installs and newly smart-bridged installs because the migrator
    // already created everything. Every statement is guarded with
    // IF (NOT) EXISTS / DO blocks so it stays safe on healthy DBs.
    await reconcileSchema(client);
    console.log("[obscura migrate] Schema reconcile complete");

    // Run any registered staged data migrations. Each registered
    // migration is driven to the `staged` state (or skipped if already
    // staged/complete/failed). Finalize is user-initiated via the
    // /system/migrations/:name/finalize endpoint.
    const report = await runStagedMigrations(client);
    const actionable = report.filter((r) => r.status !== "complete");
    if (actionable.length > 0) {
      console.log("[obscura migrate] Data migration status:", actionable);
    }
  } finally {
    await client.end();
  }
}

// CLI entrypoint — invoked from `pnpm db:migrate` and the Docker entrypoint.
if (import.meta.url === `file://${process.argv[1]}`) {
  const url =
    process.env.DATABASE_URL ??
    "postgres://obscura:obscura@localhost:5432/obscura";
  runMigrations(url)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[obscura migrate] FAILED:", err);
      process.exit(1);
    });
}
