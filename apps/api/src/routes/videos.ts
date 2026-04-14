import type { FastifyInstance } from "fastify";
import * as videoSceneService from "../services/video-scene.service";

export async function videosRoutes(app: FastifyInstance) {
  // ─── GET /videos ──────────────────────────────────────────────
  app.get("/videos", async (request) => {
    const query = request.query as videoSceneService.ListVideosQuery;
    return videoSceneService.listVideoScenes(query);
  });

  // ─── GET /videos/stats ────────────────────────────────────────
  app.get("/videos/stats", async (request) => {
    const query = request.query as { nsfw?: string };
    return videoSceneService.getVideoSceneStats(query.nsfw === "off");
  });

  // ─── GET /videos/:id ──────────────────────────────────────────
  app.get("/videos/:id", async (request) => {
    const { id } = request.params as { id: string };
    return videoSceneService.getVideoSceneDetail(id);
  });

  // ─── PATCH /videos/:id ────────────────────────────────────────
  app.patch("/videos/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as videoSceneService.UpdateVideoBody;
    return videoSceneService.updateVideoScene(id, body);
  });

  // ─── DELETE /videos/:id ───────────────────────────────────────
  app.delete("/videos/:id", async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as { deleteFile?: string };
    return videoSceneService.deleteVideoScene(id, query.deleteFile === "true");
  });

  // ─── POST /videos/:id/reset-metadata ──────────────────────────
  app.post("/videos/:id/reset-metadata", async (request) => {
    const { id } = request.params as { id: string };
    return videoSceneService.resetVideoSceneMetadata(id);
  });

  // ─── POST /videos/:id/play ────────────────────────────────────
  app.post("/videos/:id/play", async (request) => {
    const { id } = request.params as { id: string };
    return videoSceneService.recordVideoPlay(id);
  });

  // ─── POST /videos/:id/orgasm ──────────────────────────────────
  app.post("/videos/:id/orgasm", async (request) => {
    const { id } = request.params as { id: string };
    return videoSceneService.recordVideoOrgasm(id);
  });

  // ─── POST /videos/:id/preview/rebuild ─────────────────────────
  app.post("/videos/:id/preview/rebuild", async (request) => {
    const { id } = request.params as { id: string };
    return videoSceneService.rebuildVideoPreview(id);
  });

  // ─── Thumbnails ───────────────────────────────────────────────
  app.post("/videos/:id/thumbnail", async (request, reply) => {
    const { id } = request.params as { id: string };
    const file = await request.file();
    if (!file) {
      reply.code(400);
      return { error: "No file uploaded" };
    }
    const buffer = await file.toBuffer();
    return videoSceneService.setCustomVideoThumbnail(id, buffer);
  });

  app.delete("/videos/:id/thumbnail", async (request) => {
    const { id } = request.params as { id: string };
    return videoSceneService.resetVideoThumbnail(id);
  });

  app.post("/videos/:id/thumbnail/from-url", async (request) => {
    const { id } = request.params as { id: string };
    const { imageUrl } = request.body as { imageUrl: string };
    return videoSceneService.setCustomVideoThumbnailFromUrl(id, imageUrl);
  });

  app.post("/videos/:id/thumbnail/from-frame", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { seconds?: number };
    return videoSceneService.setCustomVideoThumbnailFromFrame(
      id,
      Number(body?.seconds),
    );
  });

  // ─── POST /videos/upload ──────────────────────────────────────
  // Uploads a new video file and creates a video_movies row at the
  // library root (no series context — a freshly-uploaded file is
  // always a movie).
  app.post("/videos/upload", async (request, reply) => {
    const parts = request.parts();
    let file: import("@fastify/multipart").MultipartFile | null = null;
    let libraryRootId: string | null = null;
    for await (const part of parts) {
      if (part.type === "file") {
        if (file) {
          reply.code(400);
          return { error: "Only one file per upload request is supported" };
        }
        file = part;
        break;
      }
      if (part.type === "field" && part.fieldname === "libraryRootId") {
        libraryRootId = typeof part.value === "string" ? part.value : null;
      }
    }
    if (!file) {
      reply.code(400);
      return { error: "No file uploaded" };
    }
    if (!libraryRootId) {
      const raw = (file.fields as Record<string, unknown> | undefined)?.[
        "libraryRootId"
      ];
      if (raw && typeof raw === "object" && "value" in raw) {
        const value = (raw as { value?: unknown }).value;
        if (typeof value === "string") libraryRootId = value;
      }
    }
    if (!libraryRootId) {
      reply.code(400);
      return { error: "libraryRootId field is required" };
    }
    return videoSceneService.uploadVideoMovie(libraryRootId, file);
  });

  // ─── Subtitles (not yet wired for video entities) ─────────────
  // The `sceneSubtitles` table is keyed to `scene_id` and there's no
  // matching table for video_episodes / video_movies yet. Stub these
  // as 501 so callers get a clear "not implemented" signal.
  // TODO(videos): port subtitle tracks to video entities.
  app.get("/videos/:id/subtitles", async (_request, reply) => {
    reply.code(501);
    return { error: "Subtitles are not yet supported for video entities" };
  });
  app.post("/videos/:id/subtitles", async (_request, reply) => {
    reply.code(501);
    return { error: "Subtitles are not yet supported for video entities" };
  });
  app.post("/videos/:id/subtitles/extract", async (_request, reply) => {
    reply.code(501);
    return { error: "Subtitles are not yet supported for video entities" };
  });
  app.get("/videos/:id/subtitles/:trackId", async (_request, reply) => {
    reply.code(501);
    return { error: "Subtitles are not yet supported for video entities" };
  });
  app.get("/videos/:id/subtitles/:trackId/source", async (_request, reply) => {
    reply.code(501);
    return { error: "Subtitles are not yet supported for video entities" };
  });
  app.get("/videos/:id/subtitles/:trackId/cues", async (_request, reply) => {
    reply.code(501);
    // Return empty cues list to keep the player happy.
    return { cues: [] };
  });
  app.patch("/videos/:id/subtitles/:trackId", async (_request, reply) => {
    reply.code(501);
    return { error: "Subtitles are not yet supported for video entities" };
  });
  app.delete("/videos/:id/subtitles/:trackId", async (_request, reply) => {
    reply.code(501);
    return { error: "Subtitles are not yet supported for video entities" };
  });

  // ─── Markers (not yet wired for video entities) ───────────────
  // `sceneMarkers` is keyed to `scene_id`; video entities don't have
  // a marker table yet. Stub these as 501.
  // TODO(videos): port scene_markers to video entities.
  app.post("/videos/:id/markers", async (_request, reply) => {
    reply.code(501);
    return { error: "Markers are not yet supported for video entities" };
  });
  app.patch("/videos/markers/:markerId", async (_request, reply) => {
    reply.code(501);
    return { error: "Markers are not yet supported for video entities" };
  });
  app.delete("/videos/markers/:markerId", async (_request, reply) => {
    reply.code(501);
    return { error: "Markers are not yet supported for video entities" };
  });
}
