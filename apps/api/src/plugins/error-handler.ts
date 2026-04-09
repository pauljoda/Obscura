import type { FastifyInstance, FastifyError } from "fastify";
import fp from "fastify-plugin";
import type { ErrorResponse } from "@obscura/contracts";

// ─── AppError ──────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// ─── Plugin ────────────────────────────────────────────────────

async function errorHandlerPlugin(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError | AppError, _request, reply) => {
    // Known application errors
    if (err instanceof AppError) {
      const body: ErrorResponse = { error: err.message };
      if (err.code) body.code = err.code;
      return reply.code(err.statusCode).send(body);
    }

    // Fastify validation errors (ajv)
    if (err.validation) {
      const body: ErrorResponse = {
        error: err.message,
        code: "VALIDATION_ERROR",
      };
      return reply.code(400).send(body);
    }

    // Unknown / unexpected errors
    app.log.error(err);
    const body: ErrorResponse = { error: "Internal Server Error" };
    return reply.code(500).send(body);
  });
}

export default fp(errorHandlerPlugin, {
  name: "error-handler",
});
