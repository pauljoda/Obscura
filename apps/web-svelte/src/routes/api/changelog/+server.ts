import { json, type RequestHandler } from "@sveltejs/kit";
import { readChangelogText } from "@obscura/app-core";

export const GET: RequestHandler = async () => {
  try {
    const content = await readChangelogText();
    return new Response(content, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  } catch {
    return json({ error: "Changelog not found" }, { status: 404 });
  }
};
