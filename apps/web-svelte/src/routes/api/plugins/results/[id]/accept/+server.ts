import { json, type RequestHandler } from "@sveltejs/kit";
import { acceptPluginResultWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/v1/server/db-v1";
import { mapAppCoreErrorToJson } from "$lib/v1/server/error-mapper-v1";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as {
    fields?: string[];
    selectedImages?: Record<string, string | null | undefined>;
  };

  try {
    return json(
      await acceptPluginResultWrite(db, {
        scrapeResultId: params.id!,
        fields: body.fields,
        selectedImages: body.selectedImages,
      }),
    );
  } catch (error) {
    return mapAppCoreErrorToJson(error);
  }
};
