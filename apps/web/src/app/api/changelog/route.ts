import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { NextResponse } from "next/server";

function findChangelog(): string {
  // In standalone Docker builds, CHANGELOG.md is copied next to the app
  const local = join(process.cwd(), "CHANGELOG.md");
  if (existsSync(local)) return local;

  // In dev (monorepo), process.cwd() is apps/web — walk up to repo root
  const repoRoot = join(process.cwd(), "..", "..", "CHANGELOG.md");
  if (existsSync(repoRoot)) return repoRoot;

  return local;
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
