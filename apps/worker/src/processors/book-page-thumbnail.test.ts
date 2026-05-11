import { beforeEach, describe, expect, it, vi } from "vitest";

const selectLimit = vi.fn();
const selectWhere = vi.fn(() => ({ limit: selectLimit }));
const selectFrom = vi.fn(() => ({ where: selectWhere }));
const select = vi.fn(() => ({ from: selectFrom }));
const update = vi.fn();

vi.mock("../lib/db.js", async () => {
  const { schema } = await vi.importActual<typeof import("@obscura/db")>("@obscura/db");
  return {
    db: { select, update },
    bookPages: schema.bookPages,
  };
});

const extractZipMember = vi.fn();
const getGeneratedBookPageDir = vi.fn();
const probeImageFile = vi.fn();
const runProcess = vi.fn();

vi.mock("@obscura/media-core", () => ({
  extractZipMember,
  getGeneratedBookPageDir,
  probeImageFile,
  runProcess,
}));

const markJobActive = vi.fn();

vi.mock("../lib/job-tracking.js", () => ({
  markJobActive,
}));

describe("processBookPageThumbnail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    select.mockReturnValue({ from: selectFrom });
    selectFrom.mockReturnValue({ where: selectWhere });
    selectWhere.mockReturnValue({ limit: selectLimit });
    update.mockReturnValue({
      set: vi.fn(() => ({ where: vi.fn() })),
    });
  });

  it("drops stale page jobs when the book page row was already removed", async () => {
    selectLimit.mockResolvedValueOnce([]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { processBookPageThumbnail } = await import("./book-page-thumbnail.js");

    await expect(
      processBookPageThumbnail({
        id: "job-1",
        data: { pageId: "removed-page-id" },
      }),
    ).resolves.toBeUndefined();

    expect(markJobActive).not.toHaveBeenCalled();
    expect(runProcess).not.toHaveBeenCalled();
    expect(probeImageFile).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "[book-page-thumbnail] dropped stale job for missing book page removed-page-id",
    );

    warn.mockRestore();
  });
});
