import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { getGeneratedSceneDir } from "@obscura/media-core";

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

function resolveAssetPath(sceneId: string, fileName: string) {
  const sceneDir = getGeneratedSceneDir(sceneId);
  const resolved = path.resolve(sceneDir, fileName);
  const normalizedRoot = sceneDir.endsWith(path.sep) ? sceneDir : `${sceneDir}${path.sep}`;

  if (resolved !== sceneDir && !resolved.startsWith(normalizedRoot)) {
    return null;
  }

  return resolved;
}

export async function assetsRoutes(app: FastifyInstance) {
  app.get("/assets/scenes/:id/*", async (request, reply) => {
    const { id } = request.params as { id: string; "*": string };
    const assetName = (request.params as { "*": string })["*"];
    const assetPath = resolveAssetPath(id, assetName);

    if (!assetPath || !existsSync(assetPath)) {
      reply.code(404);
      return { error: "Asset not found" };
    }

    reply.header("Cache-Control", "public, max-age=300");
    reply.header("Content-Type", mimeForFile(assetName));
    return reply.send(createReadStream(assetPath));
  });
}
