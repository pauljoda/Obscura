import { json, type RequestHandler } from "@sveltejs/kit";
import {
  createLibraryRootWrite,
  listLibraryRootsRead,
  type CreateLibraryRootBody,
  type ListLibrariesQuery,
} from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";

export const GET: RequestHandler = async ({ url }) => {
  const db = await getWebDb();
  const query: ListLibrariesQuery = {};
  for (const key of ["scanVideos", "scanImages", "scanAudio", "scanBooks", "enabled"] as const) {
    const v = url.searchParams.get(key);
    if (v !== null) query[key] = v;
  }
  return json(await listLibraryRootsRead(db, query));
};

export const POST: RequestHandler = async ({ request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as CreateLibraryRootBody;
  try {
    const created = await createLibraryRootWrite(db, body);
    return json(created, { status: 201 });
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error ? error.message : "Unable to add library root",
      },
      { status: 400 },
    );
  }
};
