import type { FastifyInstance } from "fastify";
import * as sceneService from "../services/scene.service";

export async function scenesRoutes(app: FastifyInstance) {
  // ─── GET /scenes ──────────────────────────────────────────────
  app.get("/scenes", async (request) => {
    const query = request.query as sceneService.ListScenesQuery;
    return sceneService.listScenes(query);
  });

  // ─── GET /scenes/stats ────────────────────────────────────────
  app.get("/scenes/stats", async (request) => {
    const query = request.query as { nsfw?: string };
    return sceneService.getSceneStats(query.nsfw === "off");
  });

  // ─── GET /scenes/:id ──────────────────────────────────────────
  app.get("/scenes/:id", async (request) => {
    const { id } = request.params as { id: string };
    return sceneService.getSceneById(id);
  });

  // ─── PATCH /scenes/:id ────────────────────────────────────────
  app.patch("/scenes/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as sceneService.UpdateSceneBody;
    return sceneService.updateScene(id, body);
  });

  // ─── DELETE /scenes/:id ───────────────────────────────────────
  app.delete("/scenes/:id", async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as { deleteFile?: string };
    return sceneService.deleteScene(id, query.deleteFile === "true");
  });

  // ─── POST /scenes/:id/reset-metadata ──────────────────────────
  app.post("/scenes/:id/reset-metadata", async (request) => {
    const { id } = request.params as { id: string };
    return sceneService.resetSceneMetadata(id);
  });

  // ─── POST /scenes/:id/markers ──────────────────────────────────
  app.post("/scenes/:id/markers", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as sceneService.CreateMarkerBody;
    return sceneService.createMarker(id, body);
  });

  // ─── PATCH /scenes/markers/:markerId ─────────────────────────
  app.patch("/scenes/markers/:markerId", async (request) => {
    const { markerId } = request.params as { markerId: string };
    const body = request.body as sceneService.UpdateMarkerBody;
    return sceneService.updateMarker(markerId, body);
  });

  // ─── DELETE /scenes/markers/:markerId ─────────────────────────
  app.delete("/scenes/markers/:markerId", async (request) => {
    const { markerId } = request.params as { markerId: string };
    return sceneService.deleteMarker(markerId);
  });

  // ─── POST /scenes/:id/play ─────────────────────────────────────
  app.post("/scenes/:id/play", async (request) => {
    const { id } = request.params as { id: string };
    return sceneService.recordPlay(id);
  });

  // ─── POST /scenes/:id/orgasm ──────────────────────────────────
  app.post("/scenes/:id/orgasm", async (request) => {
    const { id } = request.params as { id: string };
    return sceneService.recordOrgasm(id);
  });

  // ─── POST /scenes/upload (multipart upload) ───────────────────
  // Imports a new video file into a library root. The libraryRootId
  // field must be sent as a multipart text field alongside the file;
  // the web client resolves it via GET /libraries?scanVideos=true.
  app.post("/scenes/upload", async (request, reply) => {
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
        // Break so the stream is consumed by uploadScene — once a file
        // part is read, later iteration would discard its bytes.
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
    // Late-binding: libraryRootId may arrive as a multipart field after
    // the file header (browsers order form data by user intent, not spec),
    // so read it off file.fields when the pre-file loop didn't find it.
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
    return sceneService.uploadScene(libraryRootId, file);
  });

  // ─── POST /scenes/:id/thumbnail (multipart upload) ────────────
  app.post("/scenes/:id/thumbnail", async (request, reply) => {
    const { id } = request.params as { id: string };
    const file = await request.file();
    if (!file) {
      reply.code(400);
      return { error: "No file uploaded" };
    }
    const buffer = await file.toBuffer();
    return sceneService.setCustomThumbnail(id, buffer);
  });

  // ─── POST /scenes/:id/thumbnail/from-url ──────────────────────
  app.post("/scenes/:id/thumbnail/from-url", async (request) => {
    const { id } = request.params as { id: string };
    const { imageUrl } = request.body as { imageUrl: string };
    return sceneService.setCustomThumbnailFromUrl(id, imageUrl);
  });

  // ─── POST /scenes/:id/thumbnail/from-frame ────────────────────
  app.post("/scenes/:id/thumbnail/from-frame", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { seconds?: number };
    return sceneService.setCustomThumbnailFromFrame(id, Number(body?.seconds));
  });

  // ─── DELETE /scenes/:id/thumbnail ────────────────────────────
  app.delete("/scenes/:id/thumbnail", async (request) => {
    const { id } = request.params as { id: string };
    return sceneService.resetThumbnail(id);
  });
}
