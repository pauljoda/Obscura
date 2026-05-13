import { dev } from "$app/environment";
import { env as publicEnv } from "$env/dynamic/public";
import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import {
  backupDirectory,
  clearV2Data,
  createLocalBackup,
  findRepoRoot,
  listBackupFiles,
  restoreBackupAndClearV2,
} from "$lib/server/dev-migration";
import {
  promptV2UpgradeGate,
  readV2UpgradeGate,
  resolveV2ApiBase,
  type V2UpgradeGateShellStatus,
} from "$lib/server/v2-system-gate";

function requireDevPage() {
  if (!dev) {
    throw error(404, "Not found");
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const load: PageServerLoad = async ({ fetch }) => {
  requireDevPage();

  const repoRoot = findRepoRoot();
  let gate: V2UpgradeGateShellStatus | null = null;

  try {
    gate = await readV2UpgradeGate(fetch, resolveV2ApiBase(publicEnv, dev));
  } catch {
    gate = null;
  }

  return {
    backupDir: backupDirectory(repoRoot),
    backups: await listBackupFiles(repoRoot),
    gate,
    gateMarkerPath: "v2-global-entities marker owned by the .NET backend",
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

  promptGate: async ({ fetch }) => {
    requireDevPage();

    let result: Awaited<ReturnType<typeof promptV2UpgradeGate>>;
    try {
      result = await promptV2UpgradeGate(fetch, resolveV2ApiBase(publicEnv, dev));
    } catch (err) {
      return fail(500, {
        intent: "promptGate",
        ok: false,
        message: errorMessage(err),
      });
    }

    if (result.awaitingBreakingConsent) {
      throw redirect(303, "/");
    }

    return {
      intent: "promptGate",
      ok: false,
      message: "The v2 gate did not prompt after re-arming.",
      details: result.gateId,
    };
  },
};
