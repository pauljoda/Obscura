import { json } from "@sveltejs/kit";
import {
  ConflictError,
  InternalError,
  NotFoundError,
  PerformerNotFoundError,
  PerformerUpstreamError,
  PerformerValidationError,
  StudioNotFoundError,
  StudioUpstreamError,
  StudioValidationError,
  TagNotFoundError,
  TagUpstreamError,
  TagValidationError,
  UnprocessableError,
  UpstreamError,
  ValidationError,
} from "@obscura/app-core";

/**
 * Translate an app-core sentinel error into the standard `{ error }` JSON
 * response used by the first-party API routes. Handles both the generic
 * sentinels (NotFoundError, ValidationError, UpstreamError, ConflictError,
 * UnprocessableError, InternalError) and the per-entity sentinels thrown
 * by performer/studio/tag writes. Unrecognized errors are re-thrown so
 * SvelteKit's generic 500 handler takes over.
 */
export function mapAppCoreErrorToJson(err: unknown): Response {
  if (
    err instanceof NotFoundError ||
    err instanceof PerformerNotFoundError ||
    err instanceof StudioNotFoundError ||
    err instanceof TagNotFoundError
  )
    return json({ error: (err as Error).message }, { status: 404 });
  if (
    err instanceof ValidationError ||
    err instanceof PerformerValidationError ||
    err instanceof StudioValidationError ||
    err instanceof TagValidationError
  )
    return json({ error: (err as Error).message }, { status: 400 });
  if (
    err instanceof UpstreamError ||
    err instanceof PerformerUpstreamError ||
    err instanceof StudioUpstreamError ||
    err instanceof TagUpstreamError
  )
    return json({ error: (err as Error).message }, { status: 502 });
  if (err instanceof ConflictError)
    return json({ error: err.message }, { status: 409 });
  if (err instanceof UnprocessableError)
    return json(
      err.detail ? { error: err.message, detail: err.detail } : { error: err.message },
      { status: 422 },
    );
  if (err instanceof InternalError)
    return json({ error: err.message }, { status: 500 });
  throw err;
}
