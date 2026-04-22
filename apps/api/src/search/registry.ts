/**
 * Shim — the canonical search registry lives in `@obscura/app-core`. This
 * module binds the registry to the Fastify-side DB instance so the rest
 * of the API keeps importing `searchProviders` from the same path.
 */
import { createSearchProviders } from "@obscura/app-core";
import { db } from "../db";

export const searchProviders = createSearchProviders(db);
