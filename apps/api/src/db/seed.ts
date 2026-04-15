import path from "node:path";
import { existsSync } from "node:fs";
import { db, schema } from "./index";
import { MEDIA_SCENES_DIR, probeVideoFile } from "../lib/media";

const {
  libraryRoots,
  studios,
  performers,
  tags,
  videoMovies,
  videoMoviePerformers,
  videoMovieTags,
} = schema;

interface MovieDescriptor {
  fileName: string;
  title: string;
  details: string;
  date: string;
  studioName: string;
  performers: string[];
  tags: string[];
}

const studioData = [
  {
    name: "Blender Studio",
    url: "https://studio.blender.org/films/",
  },
];

const performerData = [
  { name: "Bunny" },
  { name: "Frank" },
  { name: "Rinky" },
  { name: "Gamera" },
  { name: "Sintel" },
  { name: "Scales" },
  { name: "Thom" },
  { name: "Celia" },
];

const tagData = [
  { name: "Open Movie", description: "Blender Studio open movie project" },
  { name: "Animation", description: "Fully animated production" },
  { name: "Comedy", description: "Light comedic tone" },
  { name: "Short Film", description: "Short-form narrative film" },
  { name: "Trailer", description: "Trailer or teaser cut" },
  { name: "Fantasy", description: "Fantasy world-building and creature work" },
  { name: "Action", description: "Fast-cut action beats" },
  { name: "Surround Audio", description: "Multi-channel audio mix" },
  { name: "Live Action", description: "Live action photography" },
  { name: "Sci-Fi", description: "Science fiction setting or themes" },
  { name: "Test Asset", description: "Local reference media for player testing" },
];

const movieDescriptors: MovieDescriptor[] = [
  {
    fileName: "big_buck_bunny.mp4",
    title: "Big Buck Bunny",
    details:
      "Blender Studio open movie about a giant rabbit who turns the tables on three tormenting rodents. This is the long-form local reference asset for player and layout testing.",
    date: "2008",
    studioName: "Blender Studio",
    performers: ["Bunny", "Frank", "Rinky", "Gamera"],
    tags: ["Open Movie", "Animation", "Comedy", "Short Film", "Test Asset"],
  },
  {
    fileName: "sintel_trailer.mp4",
    title: "Sintel Trailer",
    details:
      "Official trailer for Blender Studio's Sintel open movie. Fast-cut fantasy footage and a compact runtime make it a useful short-form adaptive streaming test clip.",
    date: "2010",
    studioName: "Blender Studio",
    performers: ["Sintel", "Scales"],
    tags: [
      "Open Movie",
      "Animation",
      "Fantasy",
      "Trailer",
      "Action",
      "Surround Audio",
      "Test Asset",
    ],
  },
  {
    fileName: "tears_of_steel.mp4",
    title: "Tears of Steel",
    details:
      "Blender Studio open movie blending live-action footage and CG robots in a near-future Amsterdam showdown. It is the highest-resolution local sample and the best stress test for adaptive quality switching.",
    date: "2012",
    studioName: "Blender Studio",
    performers: ["Thom", "Celia"],
    tags: ["Open Movie", "Live Action", "Sci-Fi", "Short Film", "Test Asset"],
  },
];

async function seed() {
  console.log("Seeding database from real movie files...");

  await db.delete(videoMovieTags);
  await db.delete(videoMoviePerformers);
  await db.delete(videoMovies);
  await db.delete(performers);
  await db.delete(tags);
  await db.delete(studios);

  // Ensure at least one library root to own the seeded movies.
  let [root] = await db
    .select({ id: libraryRoots.id })
    .from(libraryRoots)
    .limit(1);
  if (!root) {
    [root] = await db
      .insert(libraryRoots)
      .values({
        path: MEDIA_SCENES_DIR,
        label: "Seed fixture",
        enabled: true,
        recursive: true,
      })
      .returning({ id: libraryRoots.id });
  }

  const insertedStudios = await db.insert(studios).values(studioData).returning();
  const studioMap = Object.fromEntries(insertedStudios.map((studio) => [studio.name, studio.id]));

  const insertedPerformers = await db
    .insert(performers)
    .values(performerData)
    .returning();
  const performerMap = Object.fromEntries(insertedPerformers.map((performer) => [performer.name, performer.id]));

  const insertedTags = await db.insert(tags).values(tagData).returning();
  const tagMap = Object.fromEntries(insertedTags.map((tag) => [tag.name, tag.id]));

  for (const descriptor of movieDescriptors) {
    const filePath = path.join(MEDIA_SCENES_DIR, descriptor.fileName);
    if (!existsSync(filePath)) {
      throw new Error(`Missing expected media file: ${filePath}`);
    }

    const metadata = await probeVideoFile(filePath);
    const [movie] = await db
      .insert(videoMovies)
      .values({
        libraryRootId: root.id,
        title: descriptor.title,
        overview: descriptor.details,
        releaseDate: descriptor.date,
        organized: true,
        filePath,
        fileSize: metadata.fileSize,
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
        frameRate: metadata.frameRate,
        bitRate: metadata.bitRate,
        codec: metadata.codec,
        container: metadata.container,
        studioId: studioMap[descriptor.studioName],
      })
      .returning();

    if (descriptor.performers.length > 0) {
      await db.insert(videoMoviePerformers).values(
        descriptor.performers.map((name) => ({
          movieId: movie.id,
          performerId: performerMap[name],
        })),
      );
    }

    if (descriptor.tags.length > 0) {
      await db.insert(videoMovieTags).values(
        descriptor.tags.map((name) => ({
          movieId: movie.id,
          tagId: tagMap[name],
        })),
      );
    }
  }

  console.log("Seeded:");
  console.log(`  ${insertedStudios.length} studios`);
  console.log(`  ${insertedPerformers.length} performers`);
  console.log(`  ${insertedTags.length} tags`);
  console.log(`  ${movieDescriptors.length} movies`);

  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
