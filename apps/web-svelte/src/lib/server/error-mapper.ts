import { json } from "@sveltejs/kit";
import {
  ConflictError,
  InternalError,
  NotFoundError,
  UnprocessableError,
  UpstreamError,
  ValidationError,
} from "@obscura/app-core";

/**
 * Translate a generic app-core sentinel error into a SvelteKit JSON
 * response that matches the Fastify `{ error }` shape. Any error that
 * isn't a recognized sentinel is re-thrown so SvelteKit's generic 500
 * handler takes over.
 */
export function mapAppCoreErrorToJson(err: unknown): Response {
  if (err instanceof NotFoundError)
    return json({ error: err.message }, { status: 404 });
  if (err instanceof ValidationError)
    return json({ error: err.message }, { status: 400 });
  if (err instanceof UpstreamError)
    return json({ error: err.message }, { status: 502 });
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
