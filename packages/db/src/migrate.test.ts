import { describe, expect, test } from "vitest";
import { resolveMigrationsFolder } from "./migrate";

describe("resolveMigrationsFolder", () => {
  test("finds the workspace migrations when called from the bundled web server", () => {
    const journalPath = "/app/packages/db/drizzle/meta/_journal.json";

    const folder = resolveMigrationsFolder({
      cwd: "/app/apps/web-svelte",
      env: {},
      exists: (candidate) => candidate === journalPath,
      moduleDir: "/app/apps/web-svelte/build/server/chunks",
    });

    expect(folder).toBe("/app/packages/db/drizzle");
  });
});
