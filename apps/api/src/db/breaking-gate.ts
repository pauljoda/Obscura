import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import postgres from "postgres";

/**
 * One-time break-gate for the scenes → videos model flip.
 *
 * The videos_to_series staging/finalize framework has been removed. Any
 * install that still has a populated `scenes` table would silently lose
 * that data when migration 0018 drops the scene_* tables. To keep the
 * data loss from being silent, this gate runs before the migrator:
 *
 *   1. If a marker file exists on disk → skip the gate entirely.
 *   2. Otherwise, look at the live DB.
 *      - `scenes` table absent → post-finalize install or fresh DB.
 *        Write the marker and proceed.
 *      - `scenes` table present but empty → fresh install that ran the
 *        old migrations through 0017 without ever scanning. Write the
 *        marker and proceed (no data to lose).
 *      - `scenes` table present with rows → gate blocks boot. The API
 *        server serves only `/health`, `/system/status`, and
 *        `POST /system/breaking-gate/accept` until the user consents.
 *
 * The marker lives on disk rather than in the database because we want
 * it to survive the migrator dropping the `data_migrations` table in
 * 0018 and, more importantly, because the whole point of the gate is
 * "don't mutate state until the user consents" — writing a DB row
 * before consent contradicts that.
 *
 * This is a single-purpose gate for v0.20 only. Future breaking
 * changes belong in the CHANGELOG, not here.
 */

const GATE_ID = "scenes-to-videos-v0.20";

export function resolveDataDir(): string {
  const override = process.env.OBSCURA_DATA_DIR;
  if (override) return override;
  if (existsSync("/data")) return "/data";
  return path.join(os.homedir(), ".obscura");
}

export function getGateMarkerPath(): string {
  return path.join(resolveDataDir(), ".breaking-gate", `${GATE_ID}.accepted`);
}

export interface GateStatus {
  awaitingConsent: boolean;
  reason: string;
}

type SqlClient = ReturnType<typeof postgres>;

async function tableExists(
  client: SqlClient,
  name: string,
): Promise<boolean> {
  const [{ exists }] = await client<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${name}
    ) AS exists
  `;
  return exists;
}

export async function checkBreakingGate(
  databaseUrl: string,
): Promise<GateStatus> {
  if (existsSync(getGateMarkerPath())) {
    return { awaitingConsent: false, reason: "marker present" };
  }

  const client = postgres(databaseUrl, { max: 1 });
  try {
    if (!(await tableExists(client, "scenes"))) {
      await writeGateMarker();
      return { awaitingConsent: false, reason: "scenes table absent" };
    }

    const [{ count }] = await client<{ count: string }[]>`
      SELECT count(*)::text AS count FROM scenes
    `;
    if (Number(count) === 0) {
      await writeGateMarker();
      return { awaitingConsent: false, reason: "scenes table empty" };
    }

    return {
      awaitingConsent: true,
      reason: `scenes table has ${count} rows — consent required before drop`,
    };
  } finally {
    await client.end();
  }
}

export async function writeGateMarker(): Promise<void> {
  const marker = getGateMarkerPath();
  mkdirSync(path.dirname(marker), { recursive: true });
  await writeFile(
    marker,
    `${new Date().toISOString()}\ngate=${GATE_ID}\n`,
    "utf8",
  );
}

export class BreakingGateAwaitingConsentError extends Error {
  readonly code = "BREAKING_GATE_AWAITING_CONSENT";
  constructor(reason: string) {
    super(`Breaking upgrade gate awaiting user consent: ${reason}`);
    this.name = "BreakingGateAwaitingConsentError";
  }
}
