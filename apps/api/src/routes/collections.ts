import type { FastifyInstance } from "fastify";
import * as collectionService from "../services/collection.service";
import type {
  CollectionListQuery,
  CollectionItemListQuery,
  CollectionCreateDto,
  CollectionPatchDto,
  CollectionAddItemsDto,
  CollectionRemoveItemsDto,
  CollectionReorderDto,
  CollectionRuleGroup,
} from "@obscura/contracts";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

export async function collectionsRoutes(app: FastifyInstance) {
  // ─── GET /collections ───────────────────────────────────────────
  app.get("/collections", async (request) => {
    const query = request.query as {
      search?: string;
      sort?: string;
      order?: string;
      limit?: string;
      offset?: string;
      mode?: string;
    };
    return collectionService.listCollections(query as CollectionListQuery);
  });

  // ─── POST /collections ──────────────────────────────────────────
  app.post("/collections", async (request, reply) => {
    const body = request.body as CollectionCreateDto;
    const result = await collectionService.createCollection(body);
    reply.code(201);
    return result;
  });

  // ─── GET /collections/:id ───────────────────────────────────────
  app.get("/collections/:id", async (request) => {
    const { id } = request.params as { id: string };
    return collectionService.getCollectionById(id);
  });

  // ─── PATCH /collections/:id ─────────────────────────────────────
  app.patch("/collections/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as CollectionPatchDto;
    return collectionService.updateCollection(id, body);
  });

  // ─── DELETE /collections/:id ────────────────────────────────────
  app.delete("/collections/:id", async (request) => {
    const { id } = request.params as { id: string };
    return collectionService.deleteCollection(id);
  });

  // ─── GET /collections/:id/items ─────────────────────────────────
  app.get("/collections/:id/items", async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as {
      limit?: string;
      offset?: string;
      entityType?: string;
    };
    return collectionService.getCollectionItems(
      id,
      query as CollectionItemListQuery,
    );
  });

  // ─── POST /collections/:id/items ────────────────────────────────
  app.post("/collections/:id/items", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as CollectionAddItemsDto;
    const result = await collectionService.addItems(id, body);
    reply.code(201);
    return result;
  });

  // ─── DELETE /collections/:id/items ──────────────────────────────
  app.delete("/collections/:id/items", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as CollectionRemoveItemsDto;
    return collectionService.removeItems(id, body);
  });

  // ─── PATCH /collections/:id/items/reorder ───────────────────────
  app.patch("/collections/:id/items/reorder", async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as CollectionReorderDto;
    return collectionService.reorderItems(id, body);
  });

  // ─── POST /collections/:id/refresh ──────────────────────────────
  app.post("/collections/:id/refresh", async (request) => {
    const { id } = request.params as { id: string };
    return collectionService.refreshCollectionRules(id);
  });

  // ─── POST /collections/preview-rules ────────────────────────────
  app.post("/collections/preview-rules", async (request) => {
    const body = request.body as { ruleTree: CollectionRuleGroup };
    return collectionService.previewRules(body.ruleTree);
  });

  // ─── GET /assets/collections/:id/cover ──────────────────────────
  app.get("/assets/collections/:id/cover", async (request, reply) => {
    const { id } = request.params as { id: string };
    const collection = await collectionService.getCollectionById(id);

    if (!collection.coverImagePath) {
      reply.code(404);
      return { error: "No cover image" };
    }

    // The coverImagePath stored in the DB is the asset URL;
    // resolve it to a disk path in the cache directory
    const cacheDir = process.env.OBSCURA_CACHE_DIR ?? "/data/cache";
    const diskPath = `${cacheDir}/collections/${id}/cover.webp`;

    if (!existsSync(diskPath)) {
      reply.code(404);
      return { error: "Cover file not found" };
    }

    const buffer = await readFile(diskPath);
    reply.type("image/webp").send(buffer);
  });
}
