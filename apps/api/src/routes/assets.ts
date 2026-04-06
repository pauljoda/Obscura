import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db";
import { eq, asc } from "drizzle-orm";
import {
  getSidecarPaths,
  getGeneratedSceneDir,
  getGeneratedPerformerDir,
  getGeneratedStudioDir,
  getGeneratedTagDir,
  getGeneratedImageDir,
  extractZipMember,
} from "@obscura/media-core";

const { scenes, galleries, images } = schema;

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

    const scene = await db.query.scenes.findFirst({
      where: eq(scenes.id, id),
      columns: { filePath: true },
    });

    if (!scene?.filePath) {
      reply.code(404);
      return { error: "Scene not found" };
    }

    const sidecar = getSidecarPaths(scene.filePath);
    const kindToPath: Record<string, string> = {
      thumb: sidecar.thumbnail,
      card: sidecar.cardThumbnail,
      sprite: sidecar.sprite,
      preview: sidecar.preview,
      trickplay: sidecar.trickplayVtt,
    };

    const assetPath = kindToPath[resolvedKind];

    // All generated assets use no-cache so regenerated files are picked up
    // immediately after a rebuild. The browser will revalidate with the server
    // but still uses its cached copy when the file hasn't changed.
    const cacheHeader = "no-cache";

    // Try sidecar path first, then fall back to legacy cache dir
    if (existsSync(assetPath)) {
      reply.header("Cache-Control", cacheHeader);
      reply.header("Content-Type", SIDECAR_MIME[resolvedKind]);
      return reply.send(createReadStream(assetPath));
    }

    // Legacy fallback: check old cache directory
    const legacyDir = getGeneratedSceneDir(id);
    const legacyNames: Record<SidecarKind, string> = {
      thumb: "thumbnail.jpg",
      card: "card.jpg",
      sprite: "sprite.jpg",
      preview: "preview.mp4",
      trickplay: "trickplay.vtt",
    };

    const legacyPath = path.join(legacyDir, legacyNames[resolvedKind]);
    if (existsSync(legacyPath)) {
      reply.header("Cache-Control", cacheHeader);
      reply.header("Content-Type", mimeForFile(legacyNames[resolvedKind]));
      return reply.send(createReadStream(legacyPath));
    }

    reply.code(404);
    return { error: "Asset not found" };
  });

  // ─── Performer assets: /assets/performers/:id/:kind ─────────────
  app.get("/assets/performers/:id/:kind", async (request, reply) => {
    const { id, kind } = request.params as { id: string; kind: string };
    if (kind !== "image") { reply.code(404); return { error: "Unknown asset kind" }; }
    return serveEntityImage(getGeneratedPerformerDir(id), "Performer", reply);
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
}
