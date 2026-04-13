import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { schema } from "@obscura/db";

const DEFAULT_DATABASE_URL =
  "postgres://obscura:obscura@localhost:5432/obscura";

export type WorkerQueryClient = ReturnType<typeof postgres>;
export type WorkerDatabase = ReturnType<typeof drizzle<typeof schema>>;

type DatabaseState = {
  connectionString: string;
  queryClient: WorkerQueryClient;
  db: WorkerDatabase;
};

function resolveDatabaseUrl() {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

function createDatabaseState(connectionString: string): DatabaseState {
  const queryClient = postgres(connectionString);
  return {
    connectionString,
    queryClient,
    db: drizzle(queryClient, { schema }),
  };
}

let state = createDatabaseState(resolveDatabaseUrl());

export let queryClient = state.queryClient;
export let db = state.db;

export async function configureDatabase(options?: {
  connectionString?: string;
}): Promise<void> {
  const nextConnectionString = options?.connectionString ?? resolveDatabaseUrl();
  if (nextConnectionString === state.connectionString) {
    return;
  }

  const previous = state;
  state = createDatabaseState(nextConnectionString);
  queryClient = state.queryClient;
  db = state.db;
  await previous.queryClient.end({ timeout: 5 });
}

export async function closeDatabase(): Promise<void> {
  await state.queryClient.end({ timeout: 5 });
}

export function getDatabaseUrl() {
  return state.connectionString;
}

export { schema };

export const {
  scenes,
  sceneFolders,
  sceneSubtitles,
  libraryRoots,
  librarySettings,
  jobRuns,
  galleries,
  images,
  galleryChapters,
  galleryPerformers,
  galleryTags,
  imagePerformers,
  imageTags,
  performers,
  tags,
  studios,
  scenePerformers,
  sceneTags,
  audioLibraries,
  audioTracks,
  audioTrackMarkers,
  audioLibraryPerformers,
  audioLibraryTags,
  audioTrackPerformers,
  audioTrackTags,
  collections,
  collectionItems,
} = schema;
