import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { apiRoutes } from "@obscura/contracts";

function findChangelog(): string {
  const candidates = [
    // Docker: set explicitly via ENV in unified.Dockerfile
    process.env.CHANGELOG_PATH,
    // Fastify runs from /app/apps/api in Docker; CHANGELOG.md is at repo root
    join(process.cwd(), "..", "..", "CHANGELOG.md"),
    // Local dev: running from apps/api
    join(process.cwd(), "..", "..", "CHANGELOG.md"),
    // Fallback absolute path
    "/app/CHANGELOG.md",
  ].filter(Boolean) as string[];

  return candidates.find((c) => existsSync(c)) ?? candidates[0];
}

export async function changelogRoutes(app: FastifyInstance) {
  app.get(apiRoutes.changelog, async (_request, reply) => {
    try {
      const content = await readFile(findChangelog(), "utf-8");
      return reply
        .header("Content-Type", "text/plain; charset=utf-8")
        .send(content);
    } catch {
      return reply.status(404).send({ error: "Changelog not found" });
    }
  });
}
