import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db";
import { eq, asc } from "drizzle-orm";
import {
  getGeneratedSceneDir,
  getGeneratedPerformerDir,
  getGeneratedStudioDir,
  getGeneratedTagDir,
  getGeneratedImageDir,
  getGeneratedAudioTrackDir,
  getGeneratedAudioLibraryDir,
  getGeneratedSceneFolderDir,
  getCacheRootDir,
  extractZipMember,
  getSceneVideoGeneratedDiskPaths,
} from "@obscura/media-core";
import { ensureLibrarySettingsRow } from "../lib/library";

const { galleries, images, videoEpisodes, videoMovies } = schema;

/**
 * Resolve a video id to its file_path by probing video_episodes then
 * video_movies. The id could be either an episode or a movie; we try
 * both in that order.
 */
async function resolveVideoFilePath(id: string): Promise<string | null> {
  const [ep] = await db
    .select({ filePath: videoEpisodes.filePath })
    .from(videoEpisodes)
    .where(eq(videoEpisodes.id, id))
    .limit(1);
  if (ep?.filePath) return ep.filePath;
  const [mv] = await db
    .select({ filePath: videoMovies.filePath })
    .from(videoMovies)
    .where(eq(videoMovies.id, id))
    .limit(1);
  return mv?.filePath ?? null;
}

const IMAGE_EXTENSIONS = ["jpg", "png", "svg", "webp"] as const;
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

/** Serve an entity image from a directory, detecting format automatically. */
async function serveEntityImage(dir: string, entityLabel: string, reply: import("fastify").FastifyReply) {
  for (const ext of IMAGE_EXTENSIONS) {
    const filePath = path.join(dir, `image.${ext}`);
    if (existsSync(filePath)) {
      reply.header("Cache-Control", "public, max-age=86400, immutable");
      reply.header("Content-Type", CONTENT_TYPES[ext] ?? "application/octet-stream");
      return reply.send(createReadStream(filePath));
    }
  }
  reply.code(404);
  return { error: `${entityLabel} image not found` };
}

const SIDECAR_MIME: Record<string, string> = {
  thumb: "image/jpeg",
  card: "image/jpeg",
  sprite: "image/jpeg",
  preview: "video/mp4",
  trickplay: "text/vtt",
};

type SidecarKind = "thumb" | "card" | "sprite" | "preview" | "trickplay";

function isSidecarKind(value: string): value is SidecarKind {
  return value in SIDECAR_MIME;
}

const KIND_TO_DISK_KEY: Record<
  SidecarKind,
  "thumb" | "card" | "sprite" | "preview" | "trickplay"
> = {
  thumb: "thumb",
  card: "card",
  sprite: "sprite",
  preview: "preview",
  trickplay: "trickplay",
};

/** Map legacy filenames (from old cache-based paths) to sidecar kinds */
const LEGACY_NAME_MAP: Record<string, SidecarKind> = {
  "thumbnail.jpg": "thumb",
  "sprite.jpg": "sprite",
  "preview.mp4": "preview",
  "trickplay.vtt": "trickplay",
};

function mimeForFile(extOrFileName: string) {
  const ext = extOrFileName.startsWith(".") ? extOrFileName : path.extname(extOrFileName).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".avif":
      return "image/avif";
    case ".heic":
      return "image/heic";
    case ".bmp":
      return "image/bmp";
    case ".tiff":
    case ".tif":
      return "image/tiff";
    case ".mp4":
    case ".m4v":
      return "video/mp4";
    case ".webm":
      return "video/webm";
    case ".mkv":
      return "video/x-matroska";
    case ".mov":
      return "video/quicktime";
    case ".avi":
      return "video/x-msvideo";
    case ".wmv":
      return "video/x-ms-wmv";
    case ".flv":
      return "video/x-flv";
    case ".vtt":
      return "text/vtt";
    default:
      return "application/octet-stream";
  }
}

export async function assetsRoutes(app: FastifyInstance) {
  // New sidecar pattern: /assets/scenes/:id/:kind
  app.get("/assets/scenes/:id/:kind", async (request, reply) => {
    const { id, kind } = request.params as { id: string; kind: string };

    // Custom thumbnail lives in generated dir, not sidecar
    if (kind === "thumb-custom") {
      const customPath = path.join(getGeneratedSceneDir(id), "thumbnail-custom.jpg");
      if (existsSync(customPath)) {
        reply.header("Cache-Control", "no-cache");
        reply.header("Content-Type", "image/jpeg");
        return reply.send(createReadStream(customPath));
      }
      reply.code(404);
      return { error: "Custom thumbnail not found" };
    }

    // Map legacy filenames to sidecar kinds
    const resolvedKind = LEGACY_NAME_MAP[kind] ?? kind;

    if (!isSidecarKind(resolvedKind)) {
      reply.code(404);
      return { error: "Unknown asset kind" };
    }

    const filePath = await resolveVideoFilePath(id);

    if (!filePath) {
      reply.code(404);
      return { error: "Video not found" };
    }

    const libraryRow = await ensureLibrarySettingsRow();
    const dedicatedPrimary = libraryRow.metadataStorageDedicated ?? true;

    const pathsDedicated = getSceneVideoGeneratedDiskPaths(id, filePath, "dedicated");
    const pathsSidecar = getSceneVideoGeneratedDiskPaths(id, filePath, "sidecar");
    const primary = dedicatedPrimary ? pathsDedicated : pathsSidecar;
    const secondary = dedicatedPrimary ? pathsSidecar : pathsDedicated;

    const diskKey = KIND_TO_DISK_KEY[resolvedKind];
    const primaryPath = primary[diskKey];
    const secondaryPath = secondary[diskKey];

    // Generated scene assets are versioned on the client with `?v=<updatedAt>`,
    // so they can be cached aggressively without serving stale rebuilds.
    const cacheHeader = "public, max-age=31536000, immutable";

    if (existsSync(primaryPath)) {
      reply.header("Cache-Control", cacheHeader);
      reply.header("Content-Type", SIDECAR_MIME[resolvedKind]);
      return reply.send(createReadStream(primaryPath));
    }

    if (existsSync(secondaryPath)) {
      reply.header("Cache-Control", cacheHeader);
      reply.header("Content-Type", SIDECAR_MIME[resolvedKind]);
      return reply.send(createReadStream(secondaryPath));
    }

    reply.code(404);
    return { error: "Asset not found" };
  });

  // ─── Performer assets: /assets/performers/:id/:kind ─────────────
  app.get("/assets/performers/:id/:kind", async (request, reply) => {
    const { id, kind } = request.params as { id: string; kind: string };
    if (kind !== "image") { reply.code(404); return { error: "Unknown asset kind" }; }
    return serveEntityImage(getGeneratedPerformerDir(id), "Actor", reply);
  });

  // ─── Studio assets: /assets/studios/:id/:kind ───────────────────
  app.get("/assets/studios/:id/:kind", async (request, reply) => {
    const { id, kind } = request.params as { id: string; kind: string };
    if (kind !== "image") { reply.code(404); return { error: "Unknown asset kind" }; }
    return serveEntityImage(getGeneratedStudioDir(id), "Studio", reply);
  });

  // ─── Tag assets: /assets/tags/:id/:kind ────────────────────────
  app.get("/assets/tags/:id/:kind", async (request, reply) => {
    const { id, kind } = request.params as { id: string; kind: string };
    if (kind !== "image") { reply.code(404); return { error: "Unknown asset kind" }; }
    return serveEntityImage(getGeneratedTagDir(id), "Tag", reply);
  });

  // ─── Gallery cover: /assets/galleries/:id/cover ──────────────────
  app.get("/assets/galleries/:id/cover", async (request, reply) => {
    const { id } = request.params as { id: string };

    const gallery = await db.query.galleries.findFirst({
      where: eq(galleries.id, id),
      columns: { coverImageId: true },
    });

    if (!gallery) {
      reply.code(404);
      return { error: "Gallery not found" };
    }

    // Resolve cover image: explicit coverImageId, or first image by sort order
    let coverImageId = gallery.coverImageId;
    if (!coverImageId) {
      const [firstImage] = await db
        .select({ id: images.id })
        .from(images)
        .where(eq(images.galleryId, id))
        .orderBy(asc(images.sortOrder))
        .limit(1);
      coverImageId = firstImage?.id ?? null;
    }

    if (!coverImageId) {
      reply.code(404);
      return { error: "No cover image available" };
    }

    // Serve the cover image's thumbnail
    const thumbPath = path.join(getGeneratedImageDir(coverImageId), "thumb.jpg");
    if (existsSync(thumbPath)) {
      reply.header("Cache-Control", "no-cache");
      reply.header("Content-Type", "image/jpeg");
      return reply.send(createReadStream(thumbPath));
    }

    reply.code(404);
    return { error: "Cover thumbnail not yet generated" };
  });

  // ─── Image thumbnail: /assets/images/:id/thumb ───────────────────
  app.get("/assets/images/:id/thumb", async (request, reply) => {
    const { id } = request.params as { id: string };

    const thumbPath = path.join(getGeneratedImageDir(id), "thumb.jpg");
    if (existsSync(thumbPath)) {
      reply.header("Cache-Control", "no-cache");
      reply.header("Content-Type", "image/jpeg");
      return reply.send(createReadStream(thumbPath));
    }

    reply.code(404);
    return { error: "Image thumbnail not found" };
  });

  // ─── Image animated preview: /assets/images/:id/preview ──────────
  app.get("/assets/images/:id/preview", async (request, reply) => {
    const { id } = request.params as { id: string };

    const previewPath = path.join(getGeneratedImageDir(id), "preview.mp4");
    if (existsSync(previewPath)) {
      reply.header("Cache-Control", "public, max-age=86400, immutable");
      reply.header("Content-Type", "video/mp4");
      return reply.send(createReadStream(previewPath));
    }

    reply.code(404);
    return { error: "Image preview not found" };
  });

  // ─── Image full-size: /assets/images/:id/full ────────────────────
  app.get("/assets/images/:id/full", async (request, reply) => {
    const { id } = request.params as { id: string };

    const image = await db.query.images.findFirst({
      where: eq(images.id, id),
      columns: { filePath: true, format: true },
    });

    if (!image) {
      reply.code(404);
      return { error: "Image not found" };
    }

    const isZipMember = image.filePath.includes("::");

    if (isZipMember) {
      const [zipPath, memberPath] = image.filePath.split("::");
      const data = extractZipMember(zipPath, memberPath);
      if (!data) {
        reply.code(404);
        return { error: "Image not available" };
      }

      const ext = path.extname(memberPath).toLowerCase();
      reply.header("Cache-Control", "public, max-age=3600");
      reply.header("Content-Type", mimeForFile(ext));
      return reply.send(data);
    }

    // Regular file
    if (!existsSync(image.filePath)) {
      reply.code(404);
      return { error: "Image file not found" };
    }

    const ext = path.extname(image.filePath).toLowerCase();
    reply.header("Cache-Control", "public, max-age=3600");
    reply.header("Content-Type", mimeForFile(ext));
    return reply.send(createReadStream(image.filePath));
  });

  // ─── Audio library cover: /assets/audio-libraries/:id/cover ─────
  app.get("/assets/audio-libraries/:id/cover", async (request, reply) => {
    const { id } = request.params as { id: string };
    const coverPath = path.join(getGeneratedAudioLibraryDir(id), "cover-custom.jpg");
    if (existsSync(coverPath)) {
      reply.header("Cache-Control", "no-cache");
      reply.header("Content-Type", "image/jpeg");
      return reply.send(createReadStream(coverPath));
    }
    reply.code(404);
    return { error: "Cover not found" };
  });

  // ─── Scene folder cover: /assets/scene-folders/:id/cover ───────
  // Legacy alias — new content flows through /assets/video-folders/:id/*
  // but scene-folder URLs are preserved for any stashed references.
  app.get("/assets/scene-folders/:id/cover", async (request, reply) => {
    const { id } = request.params as { id: string };
    const coverPath = path.join(getGeneratedSceneFolderDir(id), "cover-custom.jpg");
    if (existsSync(coverPath)) {
      reply.header("Cache-Control", "no-cache");
      reply.header("Content-Type", "image/jpeg");
      return reply.send(createReadStream(coverPath));
    }
    reply.code(404);
    return { error: "Cover not found" };
  });

  // ─── Scene folder backdrop: /assets/scene-folders/:id/backdrop ─
  app.get("/assets/scene-folders/:id/backdrop", async (request, reply) => {
    const { id } = request.params as { id: string };
    const backdropPath = path.join(getGeneratedSceneFolderDir(id), "backdrop-custom.jpg");
    if (existsSync(backdropPath)) {
      reply.header("Cache-Control", "no-cache");
      reply.header("Content-Type", "image/jpeg");
      return reply.send(createReadStream(backdropPath));
    }
    reply.code(404);
    return { error: "Backdrop not found" };
  });

  // ─── Video folder cover: /assets/video-folders/:id/cover ───────
  // Same underlying cache dir as scene-folders (keyed by series id) so
  // the two URL shapes are interchangeable.
  app.get("/assets/video-folders/:id/cover", async (request, reply) => {
    const { id } = request.params as { id: string };
    const dir = getGeneratedSceneFolderDir(id);
    // Check both the manual-upload filename ("cover-custom.jpg") and the
    // scrape-accept download names ("poster.*") so both flows resolve.
    for (const name of ["cover-custom.jpg", "poster.jpg", "poster.png", "poster.webp"]) {
      const p = path.join(dir, name);
      if (existsSync(p)) {
        reply.header("Cache-Control", "no-cache");
        reply.header("Content-Type", name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : "image/jpeg");
        return reply.send(createReadStream(p));
      }
    }
    reply.code(404);
    return { error: "Cover not found" };
  });

  // ─── Video folder backdrop: /assets/video-folders/:id/backdrop ─
  app.get("/assets/video-folders/:id/backdrop", async (request, reply) => {
    const { id } = request.params as { id: string };
    const dir = getGeneratedSceneFolderDir(id);
    for (const name of ["backdrop-custom.jpg", "backdrop.jpg", "backdrop.png", "backdrop.webp"]) {
      const p = path.join(dir, name);
      if (existsSync(p)) {
        reply.header("Cache-Control", "no-cache");
        reply.header("Content-Type", name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : "image/jpeg");
        return reply.send(createReadStream(p));
      }
    }
    reply.code(404);
    return { error: "Backdrop not found" };
  });

  // ─── Season poster: /assets/seasons/:id/poster ─────────────────
  app.get("/assets/seasons/:id/poster", async (request, reply) => {
    const { id } = request.params as { id: string };
    const dir = path.join(getCacheRootDir(), "seasons", id);
    // Try common extensions — the download helper picks the original
    // extension from the URL, so we check all of them.
    for (const ext of ["jpg", "jpeg", "png", "webp"]) {
      const p = path.join(dir, `poster.${ext}`);
      if (existsSync(p)) {
        reply.header("Cache-Control", "no-cache");
        reply.header(
          "Content-Type",
          ext === "png"
            ? "image/png"
            : ext === "webp"
              ? "image/webp"
              : "image/jpeg",
        );
        return reply.send(createReadStream(p));
      }
    }
    reply.code(404);
    return { error: "Season poster not found" };
  });

  // ─── Audio track waveform: /assets/audio-tracks/:id/waveform.json ─
  app.get("/assets/audio-tracks/:id/waveform.json", async (request, reply) => {
    const { id } = request.params as { id: string };

    const waveformPath = path.join(getGeneratedAudioTrackDir(id), "waveform.json");
    if (existsSync(waveformPath)) {
      reply.header("Cache-Control", "public, max-age=86400, immutable");
      reply.header("Content-Type", "application/json");
      return reply.send(createReadStream(waveformPath));
    }

    reply.code(404);
    return { error: "Waveform not found" };
  });
}
