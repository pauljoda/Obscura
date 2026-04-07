import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { NextResponse } from "next/server";

function findChangelog(): string {
  const candidates = [
    // Standalone Docker runtime starts from /app.
    join(process.cwd(), "CHANGELOG.md"),
    // Next standalone server can also carry the traced file inside apps/web.
    join(process.cwd(), "apps", "web", "CHANGELOG.md"),
    // Local development runs from apps/web.
    join(process.cwd(), "..", "..", "CHANGELOG.md"),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

export async function GET() {
  try {
    const content = await readFile(findChangelog(), "utf-8");
    return new NextResponse(content, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    return NextResponse.json(
      { error: "Changelog not found" },
      { status: 404 },
    );
  }
}
