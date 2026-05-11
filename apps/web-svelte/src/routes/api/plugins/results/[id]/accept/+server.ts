import { json, type RequestHandler } from "@sveltejs/kit";
import { acceptPluginResultWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

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
