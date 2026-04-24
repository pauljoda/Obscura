import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface ResolveChangelogPathOptions {
  cwd?: string;
  explicitPath?: string;
}

export function resolveChangelogPath(options?: ResolveChangelogPathOptions): string {
  const cwd = options?.cwd ?? process.cwd();
  const explicitPath = options?.explicitPath ?? process.env.CHANGELOG_PATH;

  const candidates = [
    explicitPath,
    join(cwd, "..", "..", "CHANGELOG.md"),
    "/app/CHANGELOG.md",
  ].filter(Boolean) as string[];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

export async function readChangelogText(options?: ResolveChangelogPathOptions): Promise<string> {
  return readFile(resolveChangelogPath(options), "utf-8");
}
