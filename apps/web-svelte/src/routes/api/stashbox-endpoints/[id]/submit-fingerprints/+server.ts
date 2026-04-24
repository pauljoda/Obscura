import { json, type RequestHandler } from "@sveltejs/kit";
import { submitFingerprintsToEndpointWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as {
    videoId?: string;
    algorithms?: Array<"MD5" | "OSHASH" | "PHASH">;
  };

  try {
    return json(
      await submitFingerprintsToEndpointWrite(db, {
        endpointId: params.id!,
        videoId: body.videoId,
        algorithms: body.algorithms,
      }),
    );
  } catch (err) {
    return mapAppCoreErrorToJson(err);
  }
};
