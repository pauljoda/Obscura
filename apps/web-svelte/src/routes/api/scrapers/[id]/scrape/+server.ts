import { json, type RequestHandler } from "@sveltejs/kit";
import { scrapeVideoWrite } from "@obscura/app-core/scraper-runtime";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as {
    videoId: string;
    action?: string;
    url?: string;
    query?: string;
  };

  try {
    return json(
      await scrapeVideoWrite(db, {
        scraperId: params.id!,
        videoId: body.videoId,
        action: body.action,
        url: body.url,
        query: body.query,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
