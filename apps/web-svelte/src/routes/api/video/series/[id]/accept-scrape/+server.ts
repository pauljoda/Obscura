import { json, type RequestHandler } from "@sveltejs/kit";
import {
  acceptSeriesScrapeWrite,
  type AcceptSeriesScrapeInput,
} from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as Omit<AcceptSeriesScrapeInput, "seriesId">;
  try {
    return json(
      await acceptSeriesScrapeWrite(db, {
        seriesId: params.id!,
        ...body,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
