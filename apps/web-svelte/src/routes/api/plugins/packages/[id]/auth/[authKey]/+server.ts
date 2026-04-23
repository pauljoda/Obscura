import { json, type RequestHandler } from "@sveltejs/kit";
import { setPluginAuthValueWrite } from "@obscura/app-core";
import { getWebDb } from "$lib/server/db";
import { mapAppCoreErrorToJson } from "$lib/server/error-mapper";

export const PUT: RequestHandler = async ({ params, request }) => {
  const db = await getWebDb();
  const body = (await request.json()) as { value: string };

  try {
    return json(
      await setPluginAuthValueWrite(db, {
        pluginDbId: params.id!,
        authKey: params.authKey!,
        value: body.value,
      }),
    );
  } catch (error) {
    return mapAppCoreErrorToJson(error);
  }
};
