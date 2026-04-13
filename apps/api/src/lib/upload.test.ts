import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppError } from "../plugins/error-handler.js";
import {
  maxUploadBytes,
  resolveCollisionSafePath,
  sanitizeUploadFilename,
  validateUpload,
} from "./upload.js";

describe("maxUploadBytes", () => {
  afterEach(() => {
    delete process.env.OBSCURA_MAX_VIDEO_UPLOAD;
  });

  it("uses the category default when no override is configured", () => {
    expect(maxUploadBytes("video")).toBe(20 * 1024 * 1024 * 1024);
  });

  it("uses the env override when present", () => {
    process.env.OBSCURA_MAX_VIDEO_UPLOAD = "4096";
    expect(maxUploadBytes("video")).toBe(4096);
  });
});

describe("sanitizeUploadFilename", () => {
  it("strips path components and trims whitespace", () => {
    expect(sanitizeUploadFilename(" ../clips/demo.mp4 ")).toBe("demo.mp4");
  });

  it("rejects empty or invalid names", () => {
    expect(() => sanitizeUploadFilename("")).toThrow(AppError);
    expect(() => sanitizeUploadFilename("..")).toThrow("Upload filename is invalid");
  });
});

describe("validateUpload", () => {
  it("accepts allow-listed video uploads", () => {
    expect(
      validateUpload(
        {
          filename: "clip.mkv",
          mimetype: "application/octet-stream",
        },
        { category: "video" },
      ),
    ).toEqual({
      safeName: "clip.mkv",
      ext: ".mkv",
    });
  });

  it("rejects unsupported extensions", () => {
    expect(() =>
      validateUpload(
        {
          filename: "clip.exe",
          mimetype: "video/mp4",
        },
        { category: "video" },
      ),
    ).toThrow('Unsupported video extension ".exe"');
  });

  it("rejects incompatible mime types", () => {
    expect(() =>
      validateUpload(
        {
          filename: "clip.mp4",
          mimetype: "text/plain",
        },
        { category: "video" },
      ),
    ).toThrow('Unsupported video mime type "text/plain"');
  });
});

describe("resolveCollisionSafePath", () => {
  it("adds numeric suffixes when the destination exists", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "obscura-upload-test-"));
    await writeFile(path.join(dir, "clip.mp4"), "existing");

    await expect(resolveCollisionSafePath(dir, "clip.mp4")).resolves.toBe(
      path.join(dir, "clip (1).mp4"),
    );
  });
});
