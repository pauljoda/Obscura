import path from "node:path";
import { existsSync } from "node:fs";
import { db, schema } from "./index";
import { MEDIA_SCENES_DIR, probeVideoFile } from "../lib/media";

const {
  studios,
  performers,
  tags,
  scenes,
  scenePerformers,
  sceneTags,
  sceneMarkers,
} = schema;

interface SceneDescriptor {
  fileName: string;
  title: string;
  details: string;
  date: string;
  studioName: string;
  performers: string[];
  tags: string[];
  markers: Array<{
    title: string;
    seconds: number;
    endSeconds?: number;
  }>;
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

const sceneDescriptors: SceneDescriptor[] = [
  {
    fileName: "big_buck_bunny.mp4",
    title: "Big Buck Bunny",
    details:
      "Blender Studio open movie about a giant rabbit who turns the tables on three tormenting rodents. This is the long-form local reference asset for player and layout testing.",
    date: "2008",
    studioName: "Blender Studio",
    performers: ["Bunny", "Frank", "Rinky", "Gamera"],
    tags: ["Open Movie", "Animation", "Comedy", "Short Film", "Test Asset"],
    markers: [
      { title: "Forest calm", seconds: 8, endSeconds: 70 },
      { title: "Rodent ambush", seconds: 132, endSeconds: 210 },
      { title: "Bunny retaliation", seconds: 382, endSeconds: 520 },
    ],
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
    markers: [
      { title: "Title reveal", seconds: 0, endSeconds: 4 },
      { title: "Dragon glimpse", seconds: 8, endSeconds: 15 },
      { title: "Action montage", seconds: 18, endSeconds: 31 },
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
    markers: [
      { title: "Rooftop setup", seconds: 0, endSeconds: 48 },
      { title: "Robot escalation", seconds: 72, endSeconds: 122 },
      { title: "Canal finale", seconds: 138, endSeconds: 176 },
    ],
  },
];

async function seed() {
  console.log("Seeding database from real scene files...");

  await db.delete(sceneMarkers);
  await db.delete(sceneTags);
  await db.delete(scenePerformers);
  await db.delete(scenes);
  await db.delete(performers);
  await db.delete(tags);
  await db.delete(studios);

  const insertedStudios = await db.insert(studios).values(studioData).returning();
  const studioMap = Object.fromEntries(insertedStudios.map((studio) => [studio.name, studio.id]));

  const insertedPerformers = await db
    .insert(performers)
    .values(performerData)
    .returning();
  const performerMap = Object.fromEntries(insertedPerformers.map((performer) => [performer.name, performer.id]));

  const insertedTags = await db.insert(tags).values(tagData).returning();
  const tagMap = Object.fromEntries(insertedTags.map((tag) => [tag.name, tag.id]));

  let markerCount = 0;

  for (const descriptor of sceneDescriptors) {
    const filePath = path.join(MEDIA_SCENES_DIR, descriptor.fileName);
    if (!existsSync(filePath)) {
      throw new Error(`Missing expected media file: ${filePath}`);
    }

    const metadata = await probeVideoFile(filePath);
    const [scene] = await db
      .insert(scenes)
      .values({
        title: descriptor.title,
        details: descriptor.details,
        date: descriptor.date,
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
      await db.insert(scenePerformers).values(
        descriptor.performers.map((name) => ({
          sceneId: scene.id,
          performerId: performerMap[name],
        }))
      );
    }

    if (descriptor.tags.length > 0) {
      await db.insert(sceneTags).values(
        descriptor.tags.map((name) => ({
          sceneId: scene.id,
          tagId: tagMap[name],
        }))
      );
    }

    if (descriptor.markers.length > 0) {
      await db.insert(sceneMarkers).values(
        descriptor.markers.map((marker) => ({
          sceneId: scene.id,
          title: marker.title,
          seconds: marker.seconds,
          endSeconds: marker.endSeconds,
        }))
      );
      markerCount += descriptor.markers.length;
    }
  }

  await db.execute(
    `UPDATE performers SET scene_count = (
      SELECT COUNT(*) FROM scene_performers WHERE scene_performers.performer_id = performers.id
    )`
  );

  await db.execute(
    `UPDATE tags SET scene_count = (
      SELECT COUNT(*) FROM scene_tags WHERE scene_tags.tag_id = tags.id
    )`
  );

  console.log("Seeded:");
  console.log(`  ${insertedStudios.length} studios`);
  console.log(`  ${insertedPerformers.length} performers`);
  console.log(`  ${insertedTags.length} tags`);
  console.log(`  ${sceneDescriptors.length} scenes`);
  console.log(`  ${markerCount} scene markers`);

  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
