import { json } from "@sveltejs/kit";
import {
  PerformerNotFoundError,
  PerformerUpstreamError,
  PerformerValidationError,
} from "@obscura/app-core";

export function mapPerformerErrorToJson(err: unknown): Response {
  if (err instanceof PerformerNotFoundError)
    return json({ error: err.message }, { status: 404 });
  if (err instanceof PerformerValidationError)
    return json({ error: err.message }, { status: 400 });
  if (err instanceof PerformerUpstreamError)
    return json({ error: err.message }, { status: 502 });
  throw err;
}
