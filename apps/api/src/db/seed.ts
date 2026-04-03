import { db, schema } from "./index";
import path from "node:path";

// Resolve media directory relative to repo root
const MEDIA_DIR = path.resolve(import.meta.dirname, "../../../../apps/web/public/media/scenes");

const {
  studios,
  performers,
  tags,
  scenes,
  scenePerformers,
  sceneTags,
  sceneMarkers,
} = schema;

async function seed() {
  console.log("Seeding database...");

  // ─── Clear existing data ────────────────────────────────────────
  await db.delete(sceneMarkers);
  await db.delete(sceneTags);
  await db.delete(scenePerformers);
  await db.delete(scenes);
  await db.delete(performers);
  await db.delete(tags);
  await db.delete(studios);

  // ─── Studios ────────────────────────────────────────────────────
  const studioData = [
    { name: "Meridian Films", url: "https://meridianfilms.example" },
    { name: "Apex Studios", url: "https://apexstudios.example" },
    { name: "Velvet Productions", url: "https://velvetprod.example" },
    { name: "Obsidian Media", url: "https://obsidianmedia.example" },
    { name: "Solaris Creative", url: "https://solariscreative.example" },
    { name: "Noir Collective", url: "https://noircollective.example" },
  ];

  const insertedStudios = await db
    .insert(studios)
    .values(studioData)
    .returning();

  const studioMap = Object.fromEntries(
    insertedStudios.map((s) => [s.name, s.id])
  );

  // ─── Performers ─────────────────────────────────────────────────
  const performerData = [
    {
      name: "Ava Hart",
      gender: "female",
      country: "US",
      eyeColor: "green",
      hairColor: "brunette",
      height: 168,
      birthdate: "1995-03-15",
      favorite: true,
    },
    {
      name: "Leo Cruz",
      gender: "male",
      country: "BR",
      eyeColor: "brown",
      hairColor: "black",
      height: 183,
      birthdate: "1992-07-22",
    },
    {
      name: "Mia Chen",
      gender: "female",
      country: "US",
      eyeColor: "brown",
      hairColor: "black",
      height: 163,
      birthdate: "1997-11-08",
      favorite: true,
    },
    {
      name: "Dani Roze",
      gender: "female",
      country: "CA",
      eyeColor: "blue",
      hairColor: "blonde",
      height: 170,
      birthdate: "1994-06-30",
    },
    {
      name: "Kai Voss",
      gender: "male",
      country: "DE",
      eyeColor: "grey",
      hairColor: "brown",
      height: 188,
      birthdate: "1990-01-18",
    },
    {
      name: "Nina Soleil",
      gender: "female",
      country: "FR",
      eyeColor: "hazel",
      hairColor: "red",
      height: 175,
      birthdate: "1996-09-05",
      favorite: true,
    },
    {
      name: "Marcus Bell",
      gender: "male",
      country: "US",
      eyeColor: "brown",
      hairColor: "black",
      height: 180,
      birthdate: "1991-04-12",
    },
    {
      name: "Yuki Tanaka",
      gender: "female",
      country: "JP",
      eyeColor: "brown",
      hairColor: "black",
      height: 160,
      birthdate: "1998-12-20",
    },
    {
      name: "River Kane",
      gender: "non-binary",
      country: "US",
      eyeColor: "green",
      hairColor: "blonde",
      height: 172,
      birthdate: "1999-02-14",
    },
    {
      name: "Sofia Reyes",
      gender: "female",
      country: "MX",
      eyeColor: "brown",
      hairColor: "brunette",
      height: 165,
      birthdate: "1993-08-27",
    },
  ];

  const insertedPerformers = await db
    .insert(performers)
    .values(performerData)
    .returning();

  const perfMap = Object.fromEntries(
    insertedPerformers.map((p) => [p.name, p.id])
  );

  // ─── Tags ───────────────────────────────────────────────────────
  const tagData = [
    { name: "Outdoor", description: "Filmed in outdoor locations" },
    { name: "Indoor", description: "Filmed in indoor settings" },
    { name: "Cinematic", description: "High production value, cinematic look" },
    { name: "POV", description: "Point of view filming" },
    { name: "Interview", description: "Interview or conversation format" },
    { name: "BTS", description: "Behind the scenes footage" },
    { name: "Solo", description: "Single performer" },
    { name: "Group", description: "Multiple performers" },
    { name: "Natural Light", description: "Shot with available/natural light" },
    { name: "Studio Lit", description: "Professional studio lighting" },
    { name: "Ambient", description: "Atmospheric or mood-driven" },
    { name: "Documentary", description: "Documentary style" },
    { name: "Slow Motion", description: "Contains slow motion footage" },
    { name: "Drone", description: "Aerial drone footage" },
    { name: "Steadicam", description: "Stabilized camera movement" },
    { name: "Handheld", description: "Handheld camera work" },
    { name: "Time Lapse", description: "Time lapse sequences" },
    { name: "Anal", description: "Anal content" },
    { name: "Oral", description: "Oral content" },
    { name: "Bondage", description: "Bondage/BDSM content" },
    { name: "Toys", description: "Includes toy usage" },
    { name: "Massage", description: "Massage themed" },
    { name: "Cosplay", description: "Costume play" },
    { name: "Vintage", description: "Retro or vintage style" },
  ];

  const insertedTags = await db.insert(tags).values(tagData).returning();
  const tagMap = Object.fromEntries(insertedTags.map((t) => [t.name, t.id]));

  // ─── Scenes ─────────────────────────────────────────────────────
  const sceneData = [
    {
      title: "Golden Hour on the Coast",
      details: "A cinematic shoot captured during the golden hour along the Pacific coastline. Features stunning natural lighting and aerial drone transitions. (Demo: Big Buck Bunny, CC-BY Blender Foundation)",
      date: "2024-11-15",
      rating: 90,
      filePath: path.join(MEDIA_DIR, "big_buck_bunny.mp4"),
      fileSize: 64657027,
      duration: 596.5,
      width: 320,
      height: 180,
      frameRate: 24,
      bitRate: 867212,
      codec: "h264",
      container: "mp4",
      playCount: 142,
      playDuration: 98500,
      studioId: studioMap["Meridian Films"],
      organized: true,
      performers: ["Ava Hart", "Leo Cruz"],
      tags: ["Outdoor", "Cinematic", "Natural Light", "Drone"],
    },
    {
      title: "Studio Session Vol. 12",
      details: "Professional studio shoot with dramatic lighting setups. Mia delivers an exceptional solo performance with multiple outfit changes.",
      date: "2024-12-01",
      rating: 85,
      filePath: "/media/scenes/studio_session_12.mp4",
      fileSize: 3.1 * 1024 * 1024 * 1024,
      duration: 1125,
      width: 3840,
      height: 2160,
      frameRate: 29.97,
      bitRate: 20000000,
      codec: "h264",
      container: "mp4",
      playCount: 87,
      playDuration: 45200,
      studioId: studioMap["Apex Studios"],
      organized: true,
      performers: ["Mia Chen"],
      tags: ["Studio Lit", "Solo", "Indoor"],
    },
    {
      title: "Behind the Scenes — Neon",
      details: "Raw behind-the-scenes footage from the Neon series production. Unscripted moments between takes with the full cast. (Demo: Sintel Trailer, CC-BY Blender Foundation)",
      date: "2024-10-20",
      rating: 78,
      filePath: path.join(MEDIA_DIR, "sintel_trailer.mp4"),
      fileSize: 11062154,
      duration: 33,
      width: 853,
      height: 480,
      frameRate: 25,
      bitRate: 2681517,
      codec: "h264",
      container: "mp4",
      playCount: 205,
      playDuration: 156000,
      organized: false,
      performers: ["Ava Hart", "Dani Roze", "Kai Voss"],
      tags: ["BTS", "Group", "Ambient", "Handheld"],
    },
    {
      title: "The Emerald Room",
      details: "An intimate scene set in a richly decorated emerald-themed suite. Shot in ProRes for maximum color depth and detail.",
      date: "2024-09-05",
      rating: 95,
      filePath: "/media/scenes/emerald_room.mov",
      fileSize: 8.4 * 1024 * 1024 * 1024,
      duration: 775,
      width: 3840,
      height: 2160,
      frameRate: 23.976,
      bitRate: 85000000,
      codec: "prores",
      container: "mov",
      playCount: 63,
      playDuration: 32000,
      studioId: studioMap["Velvet Productions"],
      organized: true,
      performers: ["Nina Soleil", "Marcus Bell"],
      tags: ["Cinematic", "Studio Lit", "Indoor"],
    },
    {
      title: "Coastal Drift — Extended",
      details: "Extended cut of the Coastal Drift series. Features slow motion sequences and drone footage across multiple beach locations over two days of shooting.",
      date: "2024-08-18",
      rating: 88,
      filePath: "/media/scenes/coastal_drift_ext.mp4",
      fileSize: 7.1 * 1024 * 1024 * 1024,
      duration: 2720,
      width: 3840,
      height: 2160,
      frameRate: 23.976,
      bitRate: 22000000,
      codec: "hevc",
      container: "mp4",
      playCount: 318,
      playDuration: 480000,
      studioId: studioMap["Meridian Films"],
      organized: true,
      performers: ["Leo Cruz", "Nina Soleil"],
      tags: ["Outdoor", "Drone", "Slow Motion", "Cinematic"],
    },
    {
      title: "Midnight Monologue",
      details: "Intimate POV-style scene shot late at night with minimal ambient lighting. Kai delivers a powerful solo performance.",
      date: "2024-11-28",
      rating: 72,
      filePath: "/media/scenes/midnight_monologue.mp4",
      fileSize: 1.9 * 1024 * 1024 * 1024,
      duration: 1275,
      width: 1920,
      height: 1080,
      frameRate: 29.97,
      bitRate: 12000000,
      codec: "h264",
      container: "mp4",
      playCount: 156,
      playDuration: 78000,
      organized: false,
      performers: ["Kai Voss"],
      tags: ["Solo", "POV", "Ambient"],
    },
    {
      title: "Glass Ceiling",
      details: "Documentary-style interview intercut with performance footage. Explores the intersection of art and intimacy in modern media production. (Demo: Tears of Steel, CC-BY Blender Foundation)",
      date: "2024-07-12",
      rating: 82,
      filePath: path.join(MEDIA_DIR, "tears_of_steel.mp4"),
      fileSize: 27025470,
      duration: 180,
      width: 1280,
      height: 720,
      frameRate: 24,
      bitRate: 1201132,
      codec: "h264",
      container: "mp4",
      playCount: 94,
      playDuration: 68000,
      studioId: studioMap["Obsidian Media"],
      organized: true,
      performers: ["Dani Roze", "Mia Chen"],
      tags: ["Interview", "Documentary", "Indoor"],
    },
    {
      title: "Sunset Terrace Session",
      details: "Captured on the rooftop terrace during sunset. Natural warm light creates an ethereal atmosphere as the city lights appear below.",
      date: "2024-12-10",
      rating: 86,
      filePath: "/media/scenes/sunset_terrace.mp4",
      fileSize: 2.7 * 1024 * 1024 * 1024,
      duration: 990,
      width: 3840,
      height: 2160,
      frameRate: 29.97,
      bitRate: 20000000,
      codec: "h264",
      container: "mp4",
      playCount: 271,
      playDuration: 145000,
      studioId: studioMap["Apex Studios"],
      organized: true,
      performers: ["Mia Chen", "Leo Cruz"],
      tags: ["Outdoor", "Natural Light"],
    },
    {
      title: "Velvet Underground",
      details: "A moody, atmospheric solo performance in Velvet's signature style. Rich textures and careful pacing create an immersive experience.",
      date: "2024-06-22",
      rating: 91,
      filePath: "/media/scenes/velvet_underground.mp4",
      fileSize: 3.4 * 1024 * 1024 * 1024,
      duration: 2112,
      width: 1920,
      height: 1080,
      frameRate: 23.976,
      bitRate: 15000000,
      codec: "hevc",
      container: "mp4",
      playCount: 189,
      playDuration: 210000,
      studioId: studioMap["Velvet Productions"],
      organized: true,
      performers: ["Nina Soleil"],
      tags: ["Solo", "Cinematic", "Ambient", "Indoor"],
    },
    {
      title: "Signal & Noise",
      details: "Experimental documentary-style piece shot entirely handheld in ProRes. Raw and unfiltered approach to performance capture.",
      date: "2024-05-30",
      rating: 76,
      filePath: "/media/scenes/signal_noise.mov",
      fileSize: 11.2 * 1024 * 1024 * 1024,
      duration: 1188,
      width: 3840,
      height: 2160,
      frameRate: 23.976,
      bitRate: 85000000,
      codec: "prores",
      container: "mov",
      playCount: 77,
      playDuration: 42000,
      organized: false,
      performers: ["Ava Hart", "Kai Voss"],
      tags: ["Documentary", "Handheld"],
    },
    {
      title: "The Long Take — Part III",
      details: "Third installment of the acclaimed Long Take series. A single continuous steadicam shot following three performers through an elaborate set.",
      date: "2024-04-15",
      rating: 96,
      filePath: "/media/scenes/long_take_3.mp4",
      fileSize: 9.8 * 1024 * 1024 * 1024,
      duration: 3150,
      width: 3840,
      height: 2160,
      frameRate: 23.976,
      bitRate: 25000000,
      codec: "hevc",
      container: "mp4",
      playCount: 412,
      playDuration: 890000,
      studioId: studioMap["Meridian Films"],
      organized: true,
      performers: ["Leo Cruz", "Dani Roze", "Nina Soleil"],
      tags: ["Steadicam", "Group", "Cinematic", "Indoor"],
    },
    {
      title: "Morning Routine",
      details: "An intimate peek into a casual morning scene. Natural light floods through large windows as the scene unfolds organically.",
      date: "2024-12-05",
      rating: 80,
      filePath: "/media/scenes/morning_routine.mp4",
      fileSize: 1.2 * 1024 * 1024 * 1024,
      duration: 862,
      width: 1920,
      height: 1080,
      frameRate: 29.97,
      bitRate: 12000000,
      codec: "h264",
      container: "mp4",
      playCount: 234,
      playDuration: 120000,
      studioId: studioMap["Obsidian Media"],
      organized: true,
      performers: ["Mia Chen"],
      tags: ["Solo", "Natural Light", "POV", "Indoor"],
    },
    {
      title: "Hyperlapse City",
      details: "A visual experiment combining time lapse and drone footage across multiple urban locations. No performers — pure visual art.",
      date: "2024-03-20",
      rating: 70,
      filePath: "/media/scenes/hyperlapse_city.mp4",
      fileSize: 1.8 * 1024 * 1024 * 1024,
      duration: 525,
      width: 3840,
      height: 2160,
      frameRate: 29.97,
      bitRate: 28000000,
      codec: "hevc",
      container: "mp4",
      playCount: 567,
      playDuration: 180000,
      organized: true,
      performers: [],
      tags: ["Time Lapse", "Drone", "Cinematic", "Outdoor"],
    },
    {
      title: "Two-Camera Interview",
      details: "Classic two-camera interview setup exploring personal histories and motivations. Professionally lit studio environment.",
      date: "2024-11-02",
      rating: 74,
      filePath: "/media/scenes/two_camera_interview.mp4",
      fileSize: 3.6 * 1024 * 1024 * 1024,
      duration: 2475,
      width: 1920,
      height: 1080,
      frameRate: 29.97,
      bitRate: 12000000,
      codec: "h264",
      container: "mp4",
      playCount: 108,
      playDuration: 98000,
      studioId: studioMap["Apex Studios"],
      organized: true,
      performers: ["Ava Hart", "Kai Voss"],
      tags: ["Interview", "Studio Lit", "Indoor"],
    },
    {
      title: "Desert Bloom",
      details: "Shot over two days in the Mojave desert. Stunning slow motion captures against dramatic desert landscapes at sunrise and sunset.",
      date: "2024-02-14",
      rating: 93,
      filePath: "/media/scenes/desert_bloom.mp4",
      fileSize: 5.0 * 1024 * 1024 * 1024,
      duration: 1653,
      width: 3840,
      height: 2160,
      frameRate: 23.976,
      bitRate: 25000000,
      codec: "hevc",
      container: "mp4",
      playCount: 345,
      playDuration: 310000,
      studioId: studioMap["Meridian Films"],
      organized: true,
      performers: ["Nina Soleil", "Leo Cruz"],
      tags: ["Outdoor", "Slow Motion", "Cinematic"],
    },
    {
      title: "Archive Reel 09",
      details: "Compilation of unused behind-the-scenes footage from various shoots throughout the year. Raw, unedited material.",
      date: "2024-01-10",
      rating: 55,
      filePath: "/media/scenes/archive_reel_09.mp4",
      fileSize: 0.68 * 1024 * 1024 * 1024,
      duration: 668,
      width: 1280,
      height: 720,
      frameRate: 29.97,
      bitRate: 8000000,
      codec: "h264",
      container: "mp4",
      playCount: 42,
      playDuration: 12000,
      organized: false,
      performers: [],
      tags: ["BTS", "Handheld", "Documentary"],
    },
    {
      title: "Noir Sessions — Ava",
      details: "Noir Collective's signature high-contrast black and white aesthetic. Ava delivers a masterclass in expressive performance.",
      date: "2024-12-18",
      rating: 92,
      filePath: "/media/scenes/noir_sessions_ava.mp4",
      fileSize: 4.5 * 1024 * 1024 * 1024,
      duration: 1845,
      width: 3840,
      height: 2160,
      frameRate: 23.976,
      bitRate: 20000000,
      codec: "hevc",
      container: "mp4",
      playCount: 198,
      playDuration: 210000,
      studioId: studioMap["Noir Collective"],
      organized: true,
      performers: ["Ava Hart"],
      tags: ["Solo", "Cinematic", "Studio Lit", "Indoor"],
    },
    {
      title: "Summer House",
      details: "Bright, sunny shoot at a luxury beach house. Multiple locations including pool, bedroom, and open-air shower.",
      date: "2024-07-28",
      rating: 84,
      filePath: "/media/scenes/summer_house.mp4",
      fileSize: 3.8 * 1024 * 1024 * 1024,
      duration: 1560,
      width: 3840,
      height: 2160,
      frameRate: 29.97,
      bitRate: 20000000,
      codec: "h264",
      container: "mp4",
      playCount: 267,
      playDuration: 234000,
      studioId: studioMap["Solaris Creative"],
      organized: true,
      performers: ["Sofia Reyes", "Marcus Bell"],
      tags: ["Outdoor", "Natural Light", "Group"],
    },
    {
      title: "Quiet Hours",
      details: "A gentle, slow-paced scene exploring intimacy through long takes and minimal dialogue. Yuki's debut with Velvet Productions.",
      date: "2024-10-05",
      rating: 87,
      filePath: "/media/scenes/quiet_hours.mp4",
      fileSize: 2.9 * 1024 * 1024 * 1024,
      duration: 1380,
      width: 1920,
      height: 1080,
      frameRate: 23.976,
      bitRate: 18000000,
      codec: "hevc",
      container: "mp4",
      playCount: 156,
      playDuration: 145000,
      studioId: studioMap["Velvet Productions"],
      organized: true,
      performers: ["Yuki Tanaka", "River Kane"],
      tags: ["Ambient", "Indoor", "Cinematic"],
    },
    {
      title: "Electric Touch",
      details: "High-energy scene with vibrant neon lighting and driving electronic soundtrack. Fast cuts and dynamic camera movement.",
      date: "2024-09-22",
      rating: 81,
      filePath: "/media/scenes/electric_touch.mp4",
      fileSize: 4.1 * 1024 * 1024 * 1024,
      duration: 1245,
      width: 3840,
      height: 2160,
      frameRate: 29.97,
      bitRate: 28000000,
      codec: "hevc",
      container: "mp4",
      playCount: 312,
      playDuration: 280000,
      studioId: studioMap["Apex Studios"],
      organized: true,
      performers: ["Dani Roze", "Marcus Bell", "Sofia Reyes"],
      tags: ["Group", "Studio Lit", "Indoor"],
    },
  ];

  // Insert scenes and create relationships
  for (const sceneInput of sceneData) {
    const { performers: perfNames, tags: tagNames, ...sceneFields } = sceneInput;

    const [scene] = await db
      .insert(scenes)
      .values(sceneFields)
      .returning();

    // Scene-performer links
    if (perfNames.length > 0) {
      await db.insert(scenePerformers).values(
        perfNames
          .filter((name) => perfMap[name])
          .map((name) => ({
            sceneId: scene.id,
            performerId: perfMap[name],
          }))
      );
    }

    // Scene-tag links
    if (tagNames.length > 0) {
      await db.insert(sceneTags).values(
        tagNames
          .filter((name) => tagMap[name])
          .map((name) => ({
            sceneId: scene.id,
            tagId: tagMap[name],
          }))
      );
    }
  }

  // ─── Scene Markers (for a few scenes) ──────────────────────────
  const allScenes = await db.select().from(scenes);
  const sceneByTitle = Object.fromEntries(allScenes.map((s) => [s.title, s.id]));

  const markerData = [
    { sceneId: sceneByTitle["Golden Hour on the Coast"], title: "Drone flyover", seconds: 0, endSeconds: 45, primaryTagId: tagMap["Drone"] },
    { sceneId: sceneByTitle["Golden Hour on the Coast"], title: "Beach walk", seconds: 120, endSeconds: 340, primaryTagId: tagMap["Outdoor"] },
    { sceneId: sceneByTitle["Golden Hour on the Coast"], title: "Sunset climax", seconds: 980, endSeconds: 1200, primaryTagId: tagMap["Cinematic"] },
    { sceneId: sceneByTitle["The Long Take — Part III"], title: "Hallway intro", seconds: 0, endSeconds: 180, primaryTagId: tagMap["Steadicam"] },
    { sceneId: sceneByTitle["The Long Take — Part III"], title: "Bedroom sequence", seconds: 600, endSeconds: 1400, primaryTagId: tagMap["Group"] },
    { sceneId: sceneByTitle["The Long Take — Part III"], title: "Rooftop finale", seconds: 2400, endSeconds: 3100, primaryTagId: tagMap["Cinematic"] },
    { sceneId: sceneByTitle["Velvet Underground"], title: "Opening tease", seconds: 0, endSeconds: 180, primaryTagId: tagMap["Ambient"] },
    { sceneId: sceneByTitle["Velvet Underground"], title: "Main performance", seconds: 480, endSeconds: 1600, primaryTagId: tagMap["Solo"] },
    { sceneId: sceneByTitle["Desert Bloom"], title: "Sunrise establishing", seconds: 0, endSeconds: 90, primaryTagId: tagMap["Drone"] },
    { sceneId: sceneByTitle["Desert Bloom"], title: "Desert performance", seconds: 300, endSeconds: 1100, primaryTagId: tagMap["Outdoor"] },
    { sceneId: sceneByTitle["Desert Bloom"], title: "Sunset sequence", seconds: 1300, endSeconds: 1600, primaryTagId: tagMap["Slow Motion"] },
  ];

  await db.insert(sceneMarkers).values(
    markerData.filter((m) => m.sceneId)
  );

  // ─── Update scene counts on performers and tags ─────────────────
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

  console.log(`Seeded:`);
  console.log(`  ${insertedStudios.length} studios`);
  console.log(`  ${insertedPerformers.length} performers`);
  console.log(`  ${insertedTags.length} tags`);
  console.log(`  ${sceneData.length} scenes`);
  console.log(`  ${markerData.length} scene markers`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
