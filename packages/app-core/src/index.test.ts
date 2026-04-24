import { describe, expect, test, vi } from "vitest";

vi.mock("@obscura/stash-import", () => {
  throw new Error("app-core barrel imported stash-import");
});

describe("@obscura/app-core barrel", () => {
  test("does not eagerly import scraper-only dependencies", async () => {
    await expect(import("./index")).resolves.toHaveProperty("listVideosRead");
  });
});
