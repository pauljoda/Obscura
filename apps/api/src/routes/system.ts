import type { FastifyInstance } from "fastify";
import { apiRoutes } from "@obscura/contracts";
import { getDatabaseClient } from "../db";
import {
  finalizeMigration,
  getMigrationStatuses,
} from "../db/data-migrations/run";
import { getLockdownStatus } from "../db/data-migrations/lockdown";

export async function systemRoutes(app: FastifyInstance) {
  app.get(apiRoutes.systemStatus, async () => {
    const client = getDatabaseClient();
    const [migrations, lockdown] = await Promise.all([
      getMigrationStatuses(client),
      getLockdownStatus(client),
    ]);
    return {
      migrations,
      lockdown,
    };
  });

  app.post(apiRoutes.systemMigrationFinalize, async (request, reply) => {
    const { name } = request.params as { name: string };
    const client = getDatabaseClient();
    try {
      await finalizeMigration(client, name);
      return { ok: true, name };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reply.status(400);
      return { ok: false, error: message };
    }
  });
}
