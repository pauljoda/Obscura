import path from "node:path";
import { like } from "drizzle-orm";
import { schema, type AppDb } from "@obscura/db";

const { mediaFileIgnores } = schema;

export type IgnoredMediaEntityType = "video" | "image" | "audio";

export async function ignoreMediaFilePath(
  db: AppDb,
  input: { path: string | null | undefined; entityType: IgnoredMediaEntityType },
) {
  if (!input.path || input.path.includes("::")) return;
  await db
    .insert(mediaFileIgnores)
    .values({
      path: path.resolve(input.path),
      entityType: input.entityType,
    })
    .onConflictDoNothing();
}

export async function listIgnoredMediaPathsUnderRoot(
  db: AppDb,
  rootPath: string,
): Promise<Set<string>> {
  const resolved = path.resolve(rootPath);
  const rows = await db
    .select({ path: mediaFileIgnores.path })
    .from(mediaFileIgnores)
    .where(like(mediaFileIgnores.path, `${resolved}%`));
  return new Set(rows.map((row) => row.path));
}
