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
    images: schema.images,
  };
});

const extractZipMember = vi.fn();
const getGeneratedImageDir = vi.fn();
const probeImageFile = vi.fn();
const runProcess = vi.fn();

vi.mock("@obscura/media-core", () => ({
  extractZipMember,
  getGeneratedImageDir,
  probeImageFile,
  runProcess,
}));

const markJobActive = vi.fn();

vi.mock("../lib/job-tracking.js", () => ({
  markJobActive,
}));

describe("processImageThumbnail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    select.mockReturnValue({ from: selectFrom });
    selectFrom.mockReturnValue({ where: selectWhere });
    selectWhere.mockReturnValue({ limit: selectLimit });
    update.mockReturnValue({
      set: vi.fn(() => ({ where: vi.fn() })),
    });
  });

  it("drops stale image jobs when the image row was already removed", async () => {
    selectLimit.mockResolvedValueOnce([]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { processImageThumbnail } = await import("./image-thumbnail.js");

    await expect(
      processImageThumbnail({
        id: "job-1",
        data: { imageId: "removed-image-id" },
      }),
    ).resolves.toBeUndefined();

    expect(markJobActive).not.toHaveBeenCalled();
    expect(runProcess).not.toHaveBeenCalled();
    expect(probeImageFile).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "[image-thumbnail] dropped stale job for missing image removed-image-id",
    );

    warn.mockRestore();
  });
});
