import path from "node:path";
import { like } from "drizzle-orm";
import { schema, type AppDb } from "@obscura/db";

const { mediaFileIgnores } = schema;

export type IgnoredMediaEntityType = "video" | "image" | "audio" | "book";

export async function ignoreMediaFilePath(
  db: AppDb,
  input: { path: string | null | undefined; entityType: IgnoredMediaEntityType },
) {
  if (!input.path || input.path.includes("::")) return;
  try {
    await db
      .insert(mediaFileIgnores)
      .values({
        path: path.resolve(input.path),
        entityType: input.entityType,
      })
      .onConflictDoNothing();
  } catch (error) {
    if (!isMissingIgnoreTableError(error)) throw error;
  }
}

export async function listIgnoredMediaPathsUnderRoot(
  db: AppDb,
  rootPath: string,
): Promise<Set<string>> {
  const resolved = path.resolve(rootPath);
  try {
    const rows = await db
      .select({ path: mediaFileIgnores.path })
      .from(mediaFileIgnores)
      .where(like(mediaFileIgnores.path, `${resolved}%`));
    return new Set(rows.map((row) => row.path));
  } catch (error) {
    if (!isMissingIgnoreTableError(error)) throw error;
    return new Set();
  }
}

function isMissingIgnoreTableError(error: unknown): boolean {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  if (code === "42P01") return true;
  const cause =
    typeof error === "object" && error !== null && "cause" in error
      ? (error as { cause?: unknown }).cause
      : undefined;
  if (cause != null && isMissingIgnoreTableError(cause)) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("media_file_ignores") && message.includes("does not exist");
}
