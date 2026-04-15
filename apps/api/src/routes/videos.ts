import type { FastifyInstance } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import * as videoSceneService from "../services/video-scene.service";
import * as videoSubtitlesService from "../services/video-subtitles.service";
import * as videoMarkersService from "../services/video-markers.service";

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

  // ─── Subtitles ────────────────────────────────────────────────
  app.get("/videos/:id/subtitles", async (request) => {
    const { id } = request.params as { id: string };
    const tracks = await videoSubtitlesService.listSubtitleTracks(id);
    return { tracks };
  });

  app.post("/videos/:id/subtitles", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parts = request.parts();
    let file: MultipartFile | undefined;
    const fields: videoSubtitlesService.UploadSubtitleFields = {};
    for await (const part of parts) {
      if (part.type === "file") {
        file = part;
        break;
      }
      if (part.fieldname === "language") {
        fields.language = String((part as { value?: unknown }).value ?? "");
      }
      if (part.fieldname === "label") {
        const raw = (part as { value?: unknown }).value;
        fields.label = typeof raw === "string" ? raw : null;
      }
    }
    if (!file) {
      reply.code(400);
      return { error: "file is required" };
    }
    return videoSubtitlesService.uploadSubtitle(id, file, fields);
  });

  app.post("/videos/:id/subtitles/extract", async (request) => {
    const { id } = request.params as { id: string };
    return videoSubtitlesService.enqueueEmbeddedExtraction(id);
  });

  app.get("/videos/:id/subtitles/:trackId", async (request, reply) => {
    const { id, trackId } = request.params as { id: string; trackId: string };
    const vtt = await videoSubtitlesService.readSubtitleVtt(id, trackId);
    reply.header("Content-Type", "text/vtt; charset=utf-8");
    return vtt;
  });

  app.get("/videos/:id/subtitles/:trackId/source", async (request, reply) => {
    const { id, trackId } = request.params as { id: string; trackId: string };
    const { content, format } = await videoSubtitlesService.readSubtitleSource(
      id,
      trackId,
    );
    reply.header(
      "Content-Type",
      format === "ass" || format === "ssa"
        ? "text/x-ssa; charset=utf-8"
        : "text/plain; charset=utf-8",
    );
    return content;
  });

  app.get("/videos/:id/subtitles/:trackId/cues", async (request) => {
    const { id, trackId } = request.params as { id: string; trackId: string };
    const cues = await videoSubtitlesService.getSubtitleCues(id, trackId);
    return { cues };
  });

  app.patch("/videos/:id/subtitles/:trackId", async (request) => {
    const { id, trackId } = request.params as { id: string; trackId: string };
    const body = request.body as videoSubtitlesService.UpdateSubtitleBody;
    return videoSubtitlesService.updateSubtitleTrack(id, trackId, body);
  });

  app.delete("/videos/:id/subtitles/:trackId", async (request) => {
    const { id, trackId } = request.params as { id: string; trackId: string };
    return videoSubtitlesService.deleteSubtitleTrack(id, trackId);
  });

  // ─── Markers ──────────────────────────────────────────────────
  app.get("/videos/:id/markers", async (request) => {
    const { id } = request.params as { id: string };
    const markers = await videoMarkersService.listMarkers(id);
    return { markers };
  });

  app.post("/videos/:id/markers", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as videoMarkersService.CreateMarkerBody;
    return videoMarkersService.createMarker(id, body);
  });

  app.patch("/videos/markers/:markerId", async (request) => {
    const { markerId } = request.params as { markerId: string };
    const body = request.body as videoMarkersService.UpdateMarkerBody;
    return videoMarkersService.updateMarker(markerId, body);
  });

  app.delete("/videos/markers/:markerId", async (request) => {
    const { markerId } = request.params as { markerId: string };
    return videoMarkersService.deleteMarker(markerId);
  });
}
