import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../../../api/src/db/schema";

export const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://obscura:obscura@localhost:5432/obscura";

export const queryClient = postgres(databaseUrl);
export const db = drizzle(queryClient, { schema });

export { schema };

export const {
  scenes,
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
} = schema;
