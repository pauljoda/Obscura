import { json, type RequestHandler } from "@sveltejs/kit";
import { browseDirectories } from "@obscura/app-core";

export const GET: RequestHandler = async ({ url }) => {
  const path = url.searchParams.get("path") ?? undefined;
  try {
    return json(await browseDirectories(path));
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error ? error.message : "Unable to browse directory",
      },
      { status: 400 },
    );
  }
};
