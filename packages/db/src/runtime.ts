export interface DbRuntimeDeps<TQueryClient, TDatabase> {
  createQueryClient: (connectionString: string) => TQueryClient;
  createDatabase: (client: TQueryClient) => TDatabase;
  closeQueryClient?: (client: TQueryClient) => Promise<void>;
}

export interface DbRuntime<TQueryClient, TDatabase> {
  configure(connectionString: string): Promise<void>;
  getDatabase(): TDatabase;
  getClient(): TQueryClient;
  getConnectionString(): string | null;
  close(): Promise<void>;
}

export function createDbRuntime<TQueryClient, TDatabase>(
  deps: DbRuntimeDeps<TQueryClient, TDatabase>,
): DbRuntime<TQueryClient, TDatabase> {
  type State = { connectionString: string; client: TQueryClient; db: TDatabase };
  let state: State | null = null;

  return {
    async configure(connectionString: string) {
      if (state?.connectionString === connectionString) return;
      const previous = state;
      const client = deps.createQueryClient(connectionString);
      const db = deps.createDatabase(client);
      state = { connectionString, client, db };
      if (previous && deps.closeQueryClient) {
        await deps.closeQueryClient(previous.client);
      }
    },
    getDatabase() {
      if (!state) throw new Error("DB runtime not configured");
      return state.db;
    },
    getClient() {
      if (!state) throw new Error("DB runtime not configured");
      return state.client;
    },
    getConnectionString() {
      return state?.connectionString ?? null;
    },
    async close() {
      if (!state) return;
      const previous = state;
      state = null;
      if (deps.closeQueryClient) {
        await deps.closeQueryClient(previous.client);
      }
    },
  };
}
