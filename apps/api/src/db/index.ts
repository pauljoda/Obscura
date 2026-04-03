import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://obscura:obscura@localhost:5432/obscura";

const queryClient = postgres(connectionString);

export const db = drizzle(queryClient, { schema });

export { schema };
