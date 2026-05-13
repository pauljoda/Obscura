import { json, type RequestHandler } from "@sveltejs/kit";
import { acceptMovieScrapeWrite, type AcceptMovieScrapeInput } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as Omit<AcceptMovieScrapeInput, "movieId">;
  try {
    return json(
      await acceptMovieScrapeWrite(db, {
        movieId: params.id!,
        ...body,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
