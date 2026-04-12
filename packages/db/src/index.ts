/**
 * @obscura/db — Shared database schema and pure-DB utility functions.
 *
 * Both the API and worker import the schema from here so neither
 * reaches into the other's internals.  Each app creates its own
 * `drizzle(...)` connection; functions in lib/ accept the connection
 * as a parameter.
 */
export * as schema from "./schema";
export type { AppDb } from "./types";
