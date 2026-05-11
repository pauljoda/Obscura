import { checkForReleaseUpdate } from "@obscura/app-core";
import { APP_VERSION } from "$lib/version";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  const status = await checkForReleaseUpdate({
    localVersion: APP_VERSION,
    force: url.searchParams.get("force") === "1",
  });

  return Response.json(status);
};
