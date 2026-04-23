import { json, type RequestHandler } from "@sveltejs/kit";
import {
  acceptEpisodeScrapeWrite,
  type AcceptEpisodeScrapeInput,
} from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as Omit<AcceptEpisodeScrapeInput, "episodeId">;
  try {
    return json(
      await acceptEpisodeScrapeWrite(db, {
        episodeId: params.id!,
        ...body,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
