import type { FastifyInstance } from "fastify";
import { apiRoutes } from "@obscura/contracts";
import { getDatabaseClient } from "../db";
import {
  finalizeMigration,
  getMigrationStatuses,
} from "../db/data-migrations/run";
import { getLockdownStatus } from "../db/data-migrations/lockdown";
import { dataMigrationsRegistry } from "../db/data-migrations/registry";

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

    const migration = dataMigrationsRegistry.find((m) => m.name === name);
    if (!migration) {
      return reply
        .code(404)
        .send({ ok: false, error: `Unknown migration: ${name}` });
    }

    const client = getDatabaseClient();
    try {
      await finalizeMigration(client, name);
      return { ok: true, name };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // "cannot finalize in status X" is a conflict; anything else
      // propagates to the global error handler as 500.
      if (message.startsWith(`Migration ${name} is in status`)) {
        return reply.code(409).send({ ok: false, error: message });
      }
      throw err;
    }
  });
}
