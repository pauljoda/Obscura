import { json, type RequestHandler } from "@sveltejs/kit";
import {
  deleteStashBoxEndpointWrite,
  updateStashBoxEndpointWrite,
} from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const PATCH: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as {
    name?: string;
    endpoint?: string;
    apiKey?: string;
    enabled?: boolean;
  };

  try {
    return json(
      await updateStashBoxEndpointWrite(db, {
        id: params.id!,
        ...body,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    return json(await deleteStashBoxEndpointWrite(db, { id: params.id! }));
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
