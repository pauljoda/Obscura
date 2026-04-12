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
 * `drizzle-kit push`, so existing deployments have every table but no
 * `__drizzle_migrations` row. Running the migrator against that state would
 * re-run `CREATE TABLE ...` and fail on duplicates. We detect the "legacy
 * push install" by checking for `library_roots` without
 * `__drizzle_migrations`, and for those installs we:
 *   1. Apply this release's pre-baseline deltas (the column add/drop that was
 *      previously expected to flow through `push`). Idempotent via
 *      ADD/DROP COLUMN IF (NOT) EXISTS so re-running is safe.
 *   2. Create `__drizzle_migrations` and pre-seed every entry in the drizzle
 *      journal as "already applied" so the migrator treats the existing
 *      schema as the baseline and only applies *new* migrations added after
 *      this release.
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

/**
 * Idempotently re-apply schema deltas that legacy-bridged installs may be
 * missing. The bridge pre-seeds every journal entry as applied, so the
 * drizzle migrator will never run these on an install that was bridged
 * before the delta existed — they only ever arrive via this reconcile step.
 *
 * Rules for anything added here:
 *   - Must be idempotent. Guard columns/tables/indexes with IF (NOT) EXISTS;
 *     wrap constraints that lack IF NOT EXISTS in a DO block that swallows
 *     `duplicate_object`.
 *   - Must mirror what a corresponding `drizzle/NNNN_*.sql` file creates
 *     for fresh installs. This function is the legacy-install twin of the
 *     migrator, not a place to introduce new schema.
 */
async function reconcileSchema(client: SqlClient): Promise<void> {
  // 0001_wandering_blue_shield: scene_subtitles source metadata.
  await client`
    ALTER TABLE scene_subtitles
    ADD COLUMN IF NOT EXISTS source_format text NOT NULL DEFAULT 'vtt'
  `;
  await client`
    ALTER TABLE scene_subtitles
    ADD COLUMN IF NOT EXISTS source_path text
  `;

  // 0002_bored_piledriver: pHash generation toggle on library settings.
  await client`
    ALTER TABLE library_settings
    ADD COLUMN IF NOT EXISTS generate_phash boolean NOT NULL DEFAULT false
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
  await client`
    DO $$ BEGIN
      ALTER TABLE fingerprint_submissions
      ADD CONSTRAINT fingerprint_submissions_scene_id_scenes_id_fk
      FOREIGN KEY (scene_id) REFERENCES public.scenes(id) ON DELETE CASCADE;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `;
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

      // ── Pre-baseline deltas for this release ────────────────────────
      // Additive column + drop of an unused column/FK. Every statement is
      // guarded with IF (NOT) EXISTS so the bridge is safe to re-run — no
      // transaction needed.
      await client`
        ALTER TABLE library_settings
        ADD COLUMN IF NOT EXISTS default_playback_mode text NOT NULL DEFAULT 'direct'
      `;
      await client`
        ALTER TABLE scene_markers
        DROP CONSTRAINT IF EXISTS scene_markers_primary_tag_id_tags_id_fk
      `;
      await client`
        ALTER TABLE scene_markers
        DROP COLUMN IF EXISTS primary_tag_id
      `;
      await client`
        ALTER TABLE scene_folders
        ADD COLUMN IF NOT EXISTS custom_name text
      `;

      // ── Seed __drizzle_migrations with every journal entry so the
      // migrator treats the existing schema as the baseline.
      await client`CREATE SCHEMA IF NOT EXISTS drizzle`;
      await client`
        CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at bigint
        )
      `;

      const journal = await readJournal();
      for (const entry of journal.entries) {
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
    // On bridged installs the journal entries are already marked applied,
    // so only NEW migrations beyond the bridge run.
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log("[obscura migrate] Migrations up to date");

    // ── Self-heal known legacy-bridge drift ────────────────────────
    // The bridge above seeds every journal entry as "already applied",
    // which means any schema a legacy push install was missing at the
    // time of bridging never actually gets created — the migrator skips
    // it because the hash is marked applied. We re-apply those deltas
    // here idempotently on every boot so broken legacy installs
    // self-heal the next time they redeploy. Every statement is guarded
    // with IF (NOT) EXISTS / DO block so it's a no-op on healthy DBs.
    await reconcileSchema(client);
    console.log("[obscura migrate] Schema reconcile complete");
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
