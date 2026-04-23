import type { FastifyInstance } from "fastify";
import type { MultipartFile } from "@fastify/multipart";
import {
  ConflictError,
  InternalError,
  NotFoundError,
  UpstreamError,
  ValidationError,
  deleteVideoWrite,
  getVideoDetailRead,
  getVideoStatsRead,
  listVideosRead,
  recordVideoOrgasmWrite,
  recordVideoPlayWrite,
  rebuildVideoPreviewWrite,
  resetVideoMetadataWrite,
  resetVideoThumbnailWrite,
  setCustomVideoThumbnailFromFrameWrite,
  setCustomVideoThumbnailFromUrlWrite,
  setCustomVideoThumbnailWrite,
  updateVideoWrite,
  uploadVideoEpisodeWrite,
  uploadVideoMovieWrite,
  type ListVideosQuery,
  type UpdateVideoBody,
} from "@obscura/app-core";
import * as videoSubtitlesService from "../services/video-subtitles.service";
import * as videoMarkersService from "../services/video-markers.service";
import { db } from "../db";
import { enqueueQueueJob } from "../lib/job-enqueue";
import { streamToFile } from "../lib/upload";
import { AppError } from "../plugins/error-handler";

const videoWriteDeps = { enqueueJob: enqueueQueueJob };

function rethrowAppCoreError(error: unknown): never {
  if (error instanceof NotFoundError) throw new AppError(404, error.message);
  if (error instanceof ValidationError) throw new AppError(400, error.message);
  if (error instanceof UpstreamError) throw new AppError(502, error.message);
  if (error instanceof ConflictError) throw new AppError(409, error.message);
  if (error instanceof InternalError) throw new AppError(500, error.message);
  throw error;
}

export async function videosRoutes(app: FastifyInstance) {
  // ─── GET /videos ──────────────────────────────────────────────
  app.get("/videos", async (request) => {
    try {
      return await listVideosRead(db, request.query as ListVideosQuery);
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  // ─── GET /videos/stats ────────────────────────────────────────
  app.get("/videos/stats", async (request) => {
    try {
      const query = request.query as { nsfw?: string };
      return await getVideoStatsRead(db, query.nsfw === "off");
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  // ─── GET /videos/:id ──────────────────────────────────────────
  app.get("/videos/:id", async (request) => {
    try {
      const { id } = request.params as { id: string };
      return await getVideoDetailRead(db, id);
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  // ─── PATCH /videos/:id ────────────────────────────────────────
  app.patch("/videos/:id", async (request) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as UpdateVideoBody;
      return await updateVideoWrite(db, id, body);
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  // ─── DELETE /videos/:id ───────────────────────────────────────
  app.delete("/videos/:id", async (request) => {
    try {
      const { id } = request.params as { id: string };
      const query = request.query as { deleteFile?: string };
      return await deleteVideoWrite(db, id, query.deleteFile === "true");
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  // ─── POST /videos/:id/reset-metadata ──────────────────────────
  app.post("/videos/:id/reset-metadata", async (request) => {
    try {
      const { id } = request.params as { id: string };
      return await resetVideoMetadataWrite(db, id);
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  // ─── POST /videos/:id/play ────────────────────────────────────
  app.post("/videos/:id/play", async (request) => {
    try {
      const { id } = request.params as { id: string };
      return await recordVideoPlayWrite(db, id);
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  // ─── POST /videos/:id/orgasm ──────────────────────────────────
  app.post("/videos/:id/orgasm", async (request) => {
    try {
      const { id } = request.params as { id: string };
      return await recordVideoOrgasmWrite(db, id);
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  // ─── POST /videos/:id/preview/rebuild ─────────────────────────
  app.post("/videos/:id/preview/rebuild", async (request) => {
    try {
      const { id } = request.params as { id: string };
      return await rebuildVideoPreviewWrite(db, id, videoWriteDeps);
    } catch (error) {
      rethrowAppCoreError(error);
    }
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
    try {
      return await setCustomVideoThumbnailWrite(db, id, buffer);
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  app.delete("/videos/:id/thumbnail", async (request) => {
    try {
      const { id } = request.params as { id: string };
      return await resetVideoThumbnailWrite(db, id);
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  app.post("/videos/:id/thumbnail/from-url", async (request) => {
    try {
      const { id } = request.params as { id: string };
      const { imageUrl } = request.body as { imageUrl: string };
      return await setCustomVideoThumbnailFromUrlWrite(db, id, imageUrl);
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  app.post("/videos/:id/thumbnail/from-frame", async (request) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { seconds?: number };
      return await setCustomVideoThumbnailFromFrameWrite(
        db,
        id,
        Number(body?.seconds),
      );
    } catch (error) {
      rethrowAppCoreError(error);
    }
  });

  // ─── POST /videos/upload ──────────────────────────────────────
  // Uploads a new video file. Two modes:
  //   - `seriesId` field → file lands inside the series' folder and a
  //     video_episodes row is created pointing at it.
  //   - `libraryRootId` field → file lands at the root and a
  //     video_movies row is created.
  // Exactly one of the two must be supplied.
  app.post("/videos/upload", async (request, reply) => {
    const parts = request.parts();
    let file: import("@fastify/multipart").MultipartFile | null = null;
    let libraryRootId: string | null = null;
    let seriesId: string | null = null;
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
      if (part.type === "field" && part.fieldname === "seriesId") {
        seriesId = typeof part.value === "string" ? part.value : null;
      }
    }
    if (!file) {
      reply.code(400);
      return { error: "No file uploaded" };
    }
    // Fall back to picking up field metadata from the file part (some
    // multipart clients put non-file fields on the busboy file event).
    const fileFields = (file.fields as Record<string, unknown> | undefined) ?? {};
    if (!libraryRootId) {
      const raw = fileFields["libraryRootId"];
      if (raw && typeof raw === "object" && "value" in raw) {
        const value = (raw as { value?: unknown }).value;
        if (typeof value === "string") libraryRootId = value;
      }
    }
    if (!seriesId) {
      const raw = fileFields["seriesId"];
      if (raw && typeof raw === "object" && "value" in raw) {
        const value = (raw as { value?: unknown }).value;
        if (typeof value === "string") seriesId = value;
      }
    }

    try {
      const upload = {
        filename: file.filename,
        mimetype: file.mimetype,
        persist: (dest: string) => streamToFile(file, dest),
      };
      if (seriesId) {
        return await uploadVideoEpisodeWrite(db, seriesId, upload, videoWriteDeps);
      }
      if (!libraryRootId) {
        reply.code(400);
        return { error: "libraryRootId or seriesId field is required" };
      }
      return await uploadVideoMovieWrite(db, libraryRootId, upload, videoWriteDeps);
    } catch (error) {
      rethrowAppCoreError(error);
    }
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
