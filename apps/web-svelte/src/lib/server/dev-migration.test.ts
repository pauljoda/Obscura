import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  backupDirectory,
  listBackupFiles,
  resolveBackupSelection,
} from "./dev-migration";

describe("dev migration helpers", () => {
  it("lists local dump backups newest first", async () => {
    const root = await mkdtemp(join(tmpdir(), "obscura-dev-migration-"));
    const backups = backupDirectory(root);
    await mkdir(backups, { recursive: true });
    await writeFile(join(backups, "older.dump"), "old");
    await new Promise((resolve) => setTimeout(resolve, 5));
    await writeFile(join(backups, "newer.dump"), "new");
    await writeFile(join(backups, "ignore.txt"), "nope");

    const files = await listBackupFiles(root);

    expect(files.map((file) => file.name)).toEqual(["newer.dump", "older.dump"]);
    expect(files[0]?.bytes).toBe(3);
  });

  it("resolves selected backups only inside the dev backup directory", () => {
    const root = "/repo";

    expect(resolveBackupSelection(root, "snapshot.dump")).toBe(
      "/repo/.obscura-dev/backups/snapshot.dump",
    );
    expect(() => resolveBackupSelection(root, "../outside.dump")).toThrow(
      /outside the dev backup directory/,
    );
    expect(() => resolveBackupSelection(root, "/tmp/outside.dump")).toThrow(
      /outside the dev backup directory/,
    );
  });
});
