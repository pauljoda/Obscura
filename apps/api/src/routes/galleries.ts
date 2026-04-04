import type { FastifyInstance } from "fastify";
import type { GalleryListItemDto } from "@obscura/contracts";

/**
 * Galleries are not persisted yet; the route exists so the UI and contracts stay stable
 * when folder-based gallery discovery is implemented.
 */
export async function galleriesRoutes(app: FastifyInstance) {
  app.get("/galleries", async () => {
    const galleries: GalleryListItemDto[] = [];
    return { galleries, total: 0 };
  });
}
