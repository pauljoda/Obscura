import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "./schema";

/** The typed Drizzle database instance used by both API and worker. */
export type AppDb = PostgresJsDatabase<typeof schema>;
