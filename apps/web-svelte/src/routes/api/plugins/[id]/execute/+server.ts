import { json, type RequestHandler } from "@sveltejs/kit";
import { executePluginWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const POST: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as {
    action: string;
    entityId?: string;
    input?: Record<string, unknown>;
    saveResult?: boolean;
  };

  try {
    return json(
      await executePluginWrite(db, {
        pluginDbId: params.id!,
        action: body.action,
        entityId: body.entityId,
        input: body.input,
        saveResult: body.saveResult,
      }),
    );
  } catch (error) {
    return mapAppCoreErrorToJson(error);
  }
};
