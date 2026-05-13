import { type RequestHandler } from "@sveltejs/kit";
import { readSubtitleSource } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const GET: RequestHandler = async ({ params }) => {
  const db = await getWebDb();
  try {
    const { content, format } = await readSubtitleSource(
      db,
      params.id!,
      params.trackId!,
    );
    return new Response(content, {
      headers: {
        "Content-Type":
          format === "ass" || format === "ssa"
            ? "text/x-ssa; charset=utf-8"
            : "text/plain; charset=utf-8",
      },
    });
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
