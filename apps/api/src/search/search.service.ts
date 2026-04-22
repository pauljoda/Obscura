/**
 * Shim — `executeSearch` lives in `@obscura/app-core`. Here we bind it to
 * the Fastify-side search provider registry.
 */
import {
  executeSearch as executeSearchCore,
  type ExecuteSearchParams,
} from "@obscura/app-core";
import { searchProviders } from "./registry";

export async function executeSearch(params: ExecuteSearchParams) {
  return executeSearchCore(searchProviders, params);
}
