import { json, type RequestHandler } from "@sveltejs/kit";
import { executePluginWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as {
    folderId: string;
    externalSeriesId: string;
    seasonNumber?: number;
  };

  try {
    return json(
      await executePluginWrite(db, {
        pluginDbId: params.id!,
        action: "folderCascade",
        entityId: body.folderId,
        input: {
          folderId: body.folderId,
          externalId: body.externalSeriesId,
          externalSeriesId: body.externalSeriesId,
          seasonNumber: body.seasonNumber,
        },
        saveResult: true,
      }),
    );
  } catch (error) {
    return mapAppCoreErrorToJson(error);
  }
};
