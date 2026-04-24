import { json } from "@sveltejs/kit";
import {
  StudioNotFoundError,
  StudioUpstreamError,
  StudioValidationError,
} from "@obscura/app-core";

export function mapStudioErrorToJson(err: unknown): Response {
  if (err instanceof StudioNotFoundError)
    return json({ error: err.message }, { status: 404 });
  if (err instanceof StudioValidationError)
    return json({ error: err.message }, { status: 400 });
  if (err instanceof StudioUpstreamError)
    return json({ error: err.message }, { status: 502 });
  throw err;
}
