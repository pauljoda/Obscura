import { readChangelogText } from "@obscura/app-core";

export async function GET() {
  try {
    const content = await readChangelogText();
    return new Response(content, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    });
  } catch {
    return Response.json({ error: "Changelog not found" }, { status: 404 });
  }
}
