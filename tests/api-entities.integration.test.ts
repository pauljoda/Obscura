import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApiTestContext, injectJson } from "./support/api.ts";

describe("API integration — performers / tags / studios", () => {
  let context: Awaited<ReturnType<typeof createApiTestContext>>;

  beforeAll(async () => {
    process.env.OBSCURA_CACHE_DIR ??= "/tmp/obscura-entities-cache";
    process.env.CHANGELOG_PATH = "CHANGELOG.md";
    context = await createApiTestContext();
  });

  afterAll(async () => {
    await context.close();
    delete process.env.CHANGELOG_PATH;
  });

  describe("performers", () => {
    it("creates, lists, updates, and deletes a performer", async () => {
      const create = await injectJson<{ ok: true; id: string }>(context.app, {
        method: "POST",
        url: "/performers",
        payload: {
          name: "Jane Smith",
          gender: "female",
          country: "US",
          aliases: "JS",
          favorite: true,
          rating: 4,
        },
      });
      expect(create.response.statusCode).toBe(201);
      expect(create.json?.id).toBeTruthy();
      const id = create.json!.id;

      const list = await context.app.inject({ method: "GET", url: "/performers" });
      expect(list.statusCode).toBe(200);
      const listBody = list.json() as { performers: Array<{ id: string; name: string }> };
      expect(listBody.performers.some((p) => p.id === id)).toBe(true);

      const filtered = await context.app.inject({
        method: "GET",
        url: "/performers?search=jane",
      });
      expect(filtered.statusCode).toBe(200);
      expect(
        (filtered.json() as { performers: Array<{ id: string }> }).performers.length,
      ).toBeGreaterThanOrEqual(1);

      const detail = await context.app.inject({ method: "GET", url: `/performers/${id}` });
      expect(detail.statusCode).toBe(200);
      const detailBody = detail.json() as {
        id: string;
        name: string;
        favorite: boolean;
        rating: number | null;
        videoCount: number;
      };
      expect(detailBody.name).toBe("Jane Smith");
      expect(detailBody.favorite).toBe(true);
      expect(detailBody.rating).toBe(4);
      expect(detailBody.videoCount).toBe(0);

      const patch = await injectJson<{ ok: true }>(context.app, {
        method: "PATCH",
        url: `/performers/${id}`,
        payload: { gender: "other", ethnicity: "mixed" },
      });
      expect(patch.response.statusCode).toBe(200);

      const favorite = await injectJson<{ ok: true }>(context.app, {
        method: "PATCH",
        url: `/performers/${id}/favorite`,
        payload: { favorite: false },
      });
      expect(favorite.response.statusCode).toBe(200);

      const rating = await injectJson<{ ok: true }>(context.app, {
        method: "PATCH",
        url: `/performers/${id}/rating`,
        payload: { rating: null },
      });
      expect(rating.response.statusCode).toBe(200);

      const afterUpdate = await context.app.inject({
        method: "GET",
        url: `/performers/${id}`,
      });
      const afterBody = afterUpdate.json() as {
        gender: string;
        favorite: boolean;
        rating: number | null;
      };
      expect(afterBody.gender).toBe("other");
      expect(afterBody.favorite).toBe(false);
      expect(afterBody.rating).toBeNull();

      const del = await context.app.inject({
        method: "DELETE",
        url: `/performers/${id}`,
      });
      expect(del.statusCode).toBe(200);

      const missing = await context.app.inject({
        method: "GET",
        url: `/performers/${id}`,
      });
      expect(missing.statusCode).toBe(404);
    });

    it("rejects creation without a name", async () => {
      const create = await injectJson<{ error: string }>(context.app, {
        method: "POST",
        url: "/performers",
        payload: { name: "  " },
      });
      expect(create.response.statusCode).toBe(400);
    });
  });

  describe("tags", () => {
    it("creates, updates, and deletes a tag, handling favorite + rating", async () => {
      const create = await injectJson<{ ok: true; id: string }>(context.app, {
        method: "POST",
        url: "/tags",
        payload: { name: "Outdoor", description: "Outdoor scenes" },
      });
      expect(create.response.statusCode).toBe(201);
      const id = create.json!.id;

      const list = await context.app.inject({ method: "GET", url: "/tags" });
      expect(list.statusCode).toBe(200);
      const listBody = list.json() as { tags: Array<{ id: string; name: string }> };
      expect(listBody.tags.some((t) => t.id === id)).toBe(true);

      const patch = await injectJson<{ id: string; description: string | null }>(
        context.app,
        {
          method: "PATCH",
          url: `/tags/${id}`,
          payload: { description: "Updated" },
        },
      );
      expect(patch.response.statusCode).toBe(200);
      expect(patch.json?.description).toBe("Updated");

      const fav = await injectJson<{ ok: true }>(context.app, {
        method: "PATCH",
        url: `/tags/${id}/favorite`,
        payload: { favorite: true },
      });
      expect(fav.response.statusCode).toBe(200);

      const detail = await context.app.inject({ method: "GET", url: `/tags/${id}` });
      const detailBody = detail.json() as {
        favorite: boolean;
        videoCount: number;
      };
      expect(detailBody.favorite).toBe(true);
      expect(detailBody.videoCount).toBe(0);

      const del = await context.app.inject({ method: "DELETE", url: `/tags/${id}` });
      expect(del.statusCode).toBe(200);

      const missing = await context.app.inject({ method: "GET", url: `/tags/${id}` });
      expect(missing.statusCode).toBe(404);
    });

    it("returns 400 when creating a tag without a name", async () => {
      const create = await injectJson<{ error: string }>(context.app, {
        method: "POST",
        url: "/tags",
        payload: { name: "" },
      });
      expect(create.response.statusCode).toBe(400);
    });
  });

  describe("studios", () => {
    it("creates, updates, and deletes a studio", async () => {
      const create = await injectJson<{ ok: true; id: string }>(context.app, {
        method: "POST",
        url: "/studios",
        payload: { name: "Acme Studios", description: "Test studio", url: "https://acme.test" },
      });
      expect(create.response.statusCode).toBe(201);
      const id = create.json!.id;

      const detail = await context.app.inject({ method: "GET", url: `/studios/${id}` });
      expect(detail.statusCode).toBe(200);
      const detailBody = detail.json() as { id: string; name: string; url: string | null };
      expect(detailBody.name).toBe("Acme Studios");
      expect(detailBody.url).toBe("https://acme.test");

      const patch = await injectJson<{ id: string; description: string | null }>(
        context.app,
        {
          method: "PATCH",
          url: `/studios/${id}`,
          payload: { description: "Updated description" },
        },
      );
      expect(patch.response.statusCode).toBe(200);
      expect(patch.json?.description).toBe("Updated description");

      const rating = await injectJson<{ ok: true }>(context.app, {
        method: "PATCH",
        url: `/studios/${id}/rating`,
        payload: { rating: 5 },
      });
      expect(rating.response.statusCode).toBe(200);

      const del = await context.app.inject({ method: "DELETE", url: `/studios/${id}` });
      expect(del.statusCode).toBe(200);
    });

    it("find-or-create is idempotent by name", async () => {
      const first = await injectJson<{ id: string }>(context.app, {
        method: "POST",
        url: "/studios/find-or-create",
        payload: { name: "Idempotent Studio" },
      });
      expect(first.response.statusCode).toBe(200);
      const firstId = first.json!.id;

      const second = await injectJson<{ id: string }>(context.app, {
        method: "POST",
        url: "/studios/find-or-create",
        payload: { name: "Idempotent Studio", url: "https://example.test" },
      });
      expect(second.response.statusCode).toBe(200);
      expect(second.json?.id).toBe(firstId);
    });
  });
});
