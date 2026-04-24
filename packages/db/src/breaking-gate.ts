import { existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import postgres from "postgres";

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
