import { dev } from "$app/environment";
import { env } from "$env/dynamic/private";
import { checkBreakingGate, getGateMarkerPath } from "@obscura/app-core";
import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import {
  backupDirectory,
  clearV2Data,
  createLocalBackup,
  findRepoRoot,
  listBackupFiles,
  promptBreakingUpgradeGate,
  restoreBackupAndClearV2,
} from "$lib/server/dev-migration";

const DEFAULT_DATABASE_URL = "postgres://obscura:obscura@localhost:5432/obscura";

function requireDevPage() {
  if (!dev) {
    throw error(404, "Not found");
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const load: PageServerLoad = async () => {
  requireDevPage();

  const repoRoot = findRepoRoot();
  let gate: { awaitingConsent: boolean; reason: string } | null = null;

  try {
    gate = await checkBreakingGate(env.DATABASE_URL ?? DEFAULT_DATABASE_URL);
  } catch {
    gate = null;
  }

  return {
    backupDir: backupDirectory(repoRoot),
    backups: await listBackupFiles(repoRoot),
    gate,
    gateMarkerPath: getGateMarkerPath(),
  };
};

export const actions: Actions = {
  createBackup: async () => {
    requireDevPage();
    const repoRoot = findRepoRoot();
    try {
      const result = await createLocalBackup(repoRoot);
      return {
        intent: "createBackup",
        ok: true,
        message: "Created a local database backup.",
        details: result.stdout.trim(),
      };
    } catch (err) {
      return fail(500, {
        intent: "createBackup",
        ok: false,
        message: errorMessage(err),
      });
    }
  },

  clearV2: async () => {
    requireDevPage();
    const repoRoot = findRepoRoot();
    try {
      const result = await clearV2Data(repoRoot);
      return {
        intent: "clearV2",
        ok: true,
        message: "Cleared v2 data and re-preserved legacy library config.",
        details: result.stdout.trim(),
      };
    } catch (err) {
      return fail(500, {
        intent: "clearV2",
        ok: false,
        message: errorMessage(err),
      });
    }
  },

  restoreAndClear: async ({ request }) => {
    requireDevPage();
    const repoRoot = findRepoRoot();
    const form = await request.formData();
    const backup = String(form.get("backup") ?? "");

    try {
      const results = await restoreBackupAndClearV2(repoRoot, backup);
      return {
        intent: "restoreAndClear",
        ok: true,
        message: "Restored the selected backup and cleared v2 data.",
        details: results.map((result) => result.stdout.trim()).filter(Boolean).join("\n"),
      };
    } catch (err) {
      return fail(500, {
        intent: "restoreAndClear",
        ok: false,
        message: errorMessage(err),
      });
    }
  },

  promptGate: async () => {
    requireDevPage();

    let result: Awaited<ReturnType<typeof promptBreakingUpgradeGate>>;
    try {
      result = await promptBreakingUpgradeGate(env.DATABASE_URL ?? DEFAULT_DATABASE_URL);
    } catch (err) {
      return fail(500, {
        intent: "promptGate",
        ok: false,
        message: errorMessage(err),
      });
    }

    if (result.awaitingConsent) {
      throw redirect(303, "/");
    }

    return {
      intent: "promptGate",
      ok: false,
      message: `The gate did not prompt: ${result.reason}.`,
      details: result.markerPath,
    };
  },
};
