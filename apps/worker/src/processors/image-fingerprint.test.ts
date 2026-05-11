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

const computeMd5AndOsHash = vi.fn();
const extractZipMember = vi.fn();

vi.mock("@obscura/media-core", () => ({
  computeMd5AndOsHash,
  extractZipMember,
}));

const markJobActive = vi.fn();
const markJobProgress = vi.fn();

vi.mock("../lib/job-tracking.js", () => ({
  markJobActive,
  markJobProgress,
}));

describe("processImageFingerprint", () => {
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

    const { processImageFingerprint } = await import("./image-fingerprint.js");

    await expect(
      processImageFingerprint({
        id: "job-1",
        data: { imageId: "removed-image-id" },
      }),
    ).resolves.toBeUndefined();

    expect(markJobActive).not.toHaveBeenCalled();
    expect(markJobProgress).not.toHaveBeenCalled();
    expect(computeMd5AndOsHash).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "[image-fingerprint] dropped stale job for missing image removed-image-id",
    );

    warn.mockRestore();
  });
});
