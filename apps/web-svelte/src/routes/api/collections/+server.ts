import { json, type RequestHandler } from "@sveltejs/kit";
import {
  createCollectionWrite,
  listCollectionsRead,
} from "@obscura/app-core";
import type { CollectionListQuery } from "@obscura/contracts";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const GET: RequestHandler = async ({ url }) => {
  const db = await getWebDb();
  const query: CollectionListQuery = {};
  const search = url.searchParams.get("search");
  const sort = url.searchParams.get("sort");
  const order = url.searchParams.get("order");
  const mode = url.searchParams.get("mode");
  const limit = Number(url.searchParams.get("limit"));
  const offset = Number(url.searchParams.get("offset"));

  if (search) query.search = search;
  if (sort) query.sort = sort;
  if (order === "asc" || order === "desc") query.order = order;
  if (mode === "manual" || mode === "dynamic" || mode === "hybrid") query.mode = mode;
  if (Number.isFinite(limit)) query.limit = limit;
  if (Number.isFinite(offset)) query.offset = offset;

  return json(await listCollectionsRead(db, query));
};

export const POST: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  try {
    return json(await createCollectionWrite(db, await request.json()), {
      status: 201,
    });
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
