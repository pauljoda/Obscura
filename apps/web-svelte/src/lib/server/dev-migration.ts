import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEV_BACKUP_DIR = ".obscura-dev/backups";

export interface DevBackupFile {
  name: string;
  path: string;
  bytes: number;
  createdAt: string;
}

export interface DevCommandResult {
  command: string;
  stdout: string;
  stderr: string;
}

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

export function findRepoRoot(start = process.cwd()): string {
  let current = resolve(start);

  while (true) {
    if (existsSync(join(current, "pnpm-workspace.yaml")) && existsSync(join(current, "apps"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      return resolve(MODULE_DIR, "../../../../..");
    }
    current = parent;
  }
}

export function backupDirectory(repoRoot: string): string {
  return resolve(repoRoot, DEV_BACKUP_DIR);
}

export function resolveBackupSelection(repoRoot: string, selected: string): string {
  if (!selected.trim()) {
    throw new Error("Choose a backup before restoring.");
  }

  const backups = backupDirectory(repoRoot);
  const candidate = isAbsolute(selected)
    ? resolve(selected)
    : resolve(backups, selected);
  const rel = relative(backups, candidate);

  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("Backup selection is outside the dev backup directory.");
  }

  return candidate;
}

export async function listBackupFiles(repoRoot: string): Promise<DevBackupFile[]> {
  const backups = backupDirectory(repoRoot);

  let entries: string[];
  try {
    entries = await readdir(backups);
  } catch {
    return [];
  }

  const files = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".dump"))
      .map(async (entry) => {
        const path = join(backups, entry);
        const info = await stat(path);
        return {
          name: entry,
          path,
          bytes: info.size,
          createdAt: info.mtime.toISOString(),
        };
      }),
  );

  return files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function runDevScript(
  repoRoot: string,
  script: string,
  args: string[] = [],
): Promise<DevCommandResult> {
  const scriptPath = join(repoRoot, script);
  const command = [process.execPath, scriptPath, ...args]
    .map((part) => (part.includes(" ") ? JSON.stringify(part) : part))
    .join(" ");

  return await new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("exit", (code) => {
      const result = { command, stdout, stderr };
      if (code === 0) {
        resolvePromise(result);
      } else {
        reject(new Error(`${command} exited with code ${code}\n${stderr || stdout}`));
      }
    });
  });
}

export async function createLocalBackup(repoRoot: string): Promise<DevCommandResult> {
  return runDevScript(repoRoot, "scripts/dev/db-backup.mjs");
}

export async function clearV2Data(repoRoot: string): Promise<DevCommandResult> {
  return runDevScript(repoRoot, "scripts/dev/db-clear-v2.mjs", ["--yes"]);
}

export async function restoreBackupAndClearV2(
  repoRoot: string,
  selected: string,
): Promise<DevCommandResult[]> {
  const backupPath = resolveBackupSelection(repoRoot, selected);
  const restore = await runDevScript(repoRoot, "scripts/dev/db-restore.mjs", [
    "--yes",
    `--file=${backupPath}`,
  ]);
  const clear = await clearV2Data(repoRoot);
  return [restore, clear];
}
