import type { FastifyInstance } from "fastify";
import { apiRoutes } from "@obscura/contracts";
import { writeGateMarker } from "../db/breaking-gate";

export async function systemRoutes(app: FastifyInstance) {
  app.get(apiRoutes.systemStatus, async () => ({
    awaitingBreakingConsent: false,
  }));
}

/**
 * Minimal fastify route set mounted when the breaking-upgrade gate is
 * active at boot. The normal `buildApiApp` has not run, so only these
 * routes exist — everything else 404s until the user accepts and the
 * container restarts.
 */
export async function breakingGateRoutes(app: FastifyInstance) {
  app.get(apiRoutes.systemStatus, async () => ({
    awaitingBreakingConsent: true,
  }));

  app.post(apiRoutes.systemBreakingGateAccept, async (_req, reply) => {
    await writeGateMarker();
    reply.code(200).send({ ok: true });
    // Give the response a beat to flush, then exit so the container
    // (or `pnpm dev` watcher) restarts into a normal boot with the
    // marker present and migrations able to run.
    setTimeout(() => process.exit(0), 250);
  });
}
