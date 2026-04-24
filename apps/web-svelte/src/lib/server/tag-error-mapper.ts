import { json } from "@sveltejs/kit";
import {
  TagNotFoundError,
  TagUpstreamError,
  TagValidationError,
} from "@obscura/app-core";

export function mapTagErrorToJson(err: unknown): Response {
  if (err instanceof TagNotFoundError) {
    return json({ error: err.message }, { status: 404 });
  }
  if (err instanceof TagValidationError) {
    return json({ error: err.message }, { status: 400 });
  }
  if (err instanceof TagUpstreamError) {
    return json({ error: err.message }, { status: 502 });
  }
  throw err;
}
