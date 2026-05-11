import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, describe, expect, it } from "vitest";
import { runMigrations } from "../packages/db/src/migrate.ts";

const migrationsFolder = path.resolve("packages/db/drizzle");

async function createMigrationsThrough(targetIdx: number) {
  const folder = await mkdtemp(path.join(tmpdir(), "obscura-migrations-"));
  const metaFolder = path.join(folder, "meta");
  await mkdir(metaFolder, { recursive: true });

  const journal = JSON.parse(
    await readFile(path.join(migrationsFolder, "meta/_journal.json"), "utf8"),
  ) as {
    entries: Array<{ idx: number; tag: string }>;
  };
  const entries = journal.entries.filter((entry) => entry.idx <= targetIdx);

  await writeFile(
    path.join(metaFolder, "_journal.json"),
    JSON.stringify({ ...journal, entries }, null, 2),
  );

  for (const entry of entries) {
    await cp(
      path.join(migrationsFolder, `${entry.tag}.sql`),
      path.join(folder, `${entry.tag}.sql`),
    );
  }

  return folder;
}

describe("book gallery migration", () => {
  const tempFolders: string[] = [];

  afterAll(async () => {
    await Promise.all(
      tempFolders.map((folder) => rm(folder, { recursive: true, force: true })),
    );
  });

  it("migrates duplicate legacy archive galleries that share the same zip path", async () => {
    const container = await new PostgreSqlContainer("postgres:16-alpine").start();
    const connectionString = container.getConnectionUri();
    const queryClient = postgres(connectionString, { max: 1 });

    try {
      const folder = await createMigrationsThrough(28);
      tempFolders.push(folder);
      await migrate(drizzle(queryClient), { migrationsFolder: folder });

      await queryClient`
        INSERT INTO library_roots (path, label)
        VALUES ('/media/books', 'Books')
      `;
      await queryClient`
        INSERT INTO galleries (title, gallery_type, zip_file_path, image_count)
        VALUES
          ('Duplicate One', 'zip', '/media/books/series/chapter.cbz', 1),
          ('Duplicate Two', 'zip', '/media/books/series/chapter.cbz', 1)
      `;

      await queryClient.end({ timeout: 5 });
      await expect(runMigrations(connectionString)).resolves.toBeUndefined();

      const verifyClient = postgres(connectionString, { max: 1 });
      try {
        const books = await verifyClient`SELECT title, relative_path FROM books`;
        const chapters = await verifyClient`SELECT archive_path FROM book_chapters`;
        const maps = await verifyClient`SELECT gallery_id FROM book_legacy_gallery_map`;

        expect(books).toHaveLength(1);
        expect(books[0]?.relative_path).toBe("/media/books/series/chapter.cbz");
        expect(chapters).toHaveLength(1);
        expect(chapters[0]?.archive_path).toBe("/media/books/series/chapter.cbz");
        expect(maps).toHaveLength(2);
      } finally {
        await verifyClient.end({ timeout: 5 });
      }
    } finally {
      await queryClient.end({ timeout: 5 }).catch(() => undefined);
      await container.stop();
    }
  });
});
