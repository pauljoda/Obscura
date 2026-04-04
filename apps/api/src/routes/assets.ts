import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { db, schema } from "../db";
import { eq } from "drizzle-orm";
import { getSidecarPaths, getGeneratedSceneDir } from "@obscura/media-core";

const { scenes } = schema;

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

function mimeForFile(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".mp4":
      return "video/mp4";
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
        reply.header("Cache-Control", "public, max-age=86400, immutable");
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

    // Try sidecar path first, then fall back to legacy cache dir
    if (existsSync(assetPath)) {
      reply.header("Cache-Control", "public, max-age=86400, immutable");
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
      reply.header("Cache-Control", "public, max-age=86400, immutable");
      reply.header("Content-Type", mimeForFile(legacyNames[resolvedKind]));
      return reply.send(createReadStream(legacyPath));
    }

    reply.code(404);
    return { error: "Asset not found" };
  });
}
