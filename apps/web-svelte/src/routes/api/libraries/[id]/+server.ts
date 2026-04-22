import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deleteLibraryRootWrite,
  LibraryRootNotFoundError,
  updateLibraryRootWrite,
  type UpdateLibraryRootBody,
} from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as UpdateLibraryRootBody;
  try {
    return json(await updateLibraryRootWrite(db, params.id!, body));
  } catch (error) {
    if (error instanceof LibraryRootNotFoundError) {
      return json({ error: error.message }, { status: 404 });
    }
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update library root",
      },
      { status: 400 },
    );
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await deleteLibraryRootWrite(db, params.id!));
  } catch (error) {
    if (error instanceof LibraryRootNotFoundError) {
      return json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
};
