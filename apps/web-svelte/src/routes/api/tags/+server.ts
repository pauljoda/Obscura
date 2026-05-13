import { json, type RequestHandler } from "@sveltejs/kit";
import { createTagWrite, listTagsRead, type CreateTagBody } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const GET: RequestHandler = async ({ url }) => {
  const db = await getWebDb();
  return json(
    await listTagsRead(db, {
      search: url.searchParams.get("search") ?? undefined,
      sort: url.searchParams.get("sort") ?? undefined,
      order: url.searchParams.get("order") ?? undefined,
      randomSeed: url.searchParams.get("randomSeed") ?? undefined,
      favorite: url.searchParams.get("favorite") ?? undefined,
      hasImage: url.searchParams.get("hasImage") ?? undefined,
      ratingMin: url.searchParams.get("ratingMin") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
      nsfw: url.searchParams.get("nsfw") ?? undefined,
    }),
  );
};

export const POST: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as CreateTagBody;
  try {
    const created = await createTagWrite(db, body);
    return json(created, { status: 201 });
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
