import type { FastifyInstance } from "fastify";
import { readChangelogText } from "@obscura/app-core";
import { apiRoutes } from "@obscura/contracts";

export async function changelogRoutes(app: FastifyInstance) {
  app.get(apiRoutes.changelog, async (_request, reply) => {
    try {
      const content = await readChangelogText();
      return reply
        .header("Content-Type", "text/plain; charset=utf-8")
        .send(content);
    } catch {
      return reply.status(404).send({ error: "Changelog not found" });
    }
  });
}
