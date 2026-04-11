import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import {
  getSceneSubtitlesDir,
  runProcess,
} from "@obscura/media-core";
import { db, scenes, sceneSubtitles } from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";

interface FfprobeSubtitleStream {
  index?: number;
  codec_name?: string;
  codec_type?: string;
  tags?: {
    language?: string;
    title?: string;
  };
}

interface FfprobeResult {
  streams?: FfprobeSubtitleStream[];
}

/**
 * Image-based subtitle codecs (PGS, VobSub, DVB) that can't be converted
 * directly to WebVTT via ffmpeg's text-codec pipeline.
 */
const IMAGE_SUBTITLE_CODECS = new Set([
  "hdmv_pgs_subtitle",
  "pgs",
  "dvb_subtitle",
  "dvd_subtitle",
  "vobsub",
  "xsub",
]);

export async function processExtractSubtitles(job: Job) {
  const sceneId = String(job.data.sceneId);
  const [scene] = await db
    .select({ id: scenes.id, title: scenes.title, filePath: scenes.filePath })
    .from(scenes)
    .where(eq(scenes.id, sceneId))
    .limit(1);

  if (!scene?.filePath) {
    throw new Error("Video file not found");
  }

  await markJobActive(job, "extract-subtitles", {
    type: "scene",
    id: scene.id,
    label: scene.title,
  });

  // List subtitle streams with ffprobe.
  const { stdout } = await runProcess("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "s",
    "-show_entries",
    "stream=index,codec_name,codec_type:stream_tags=language,title",
    "-of",
    "json",
    scene.filePath,
  ]);

  let parsed: FfprobeResult = {};
  try {
    parsed = JSON.parse(stdout) as FfprobeResult;
  } catch {
    parsed = {};
  }

  const streams = (parsed.streams ?? []).filter(
    (s) => s.codec_type === "subtitle"
  );

  if (streams.length === 0) {
    await markJobProgress(job, "extract-subtitles", 100);
    return;
  }

  const outDir = getSceneSubtitlesDir(scene.id);
  await mkdir(outDir, { recursive: true });

  for (const [idx, stream] of streams.entries()) {
    const codec = (stream.codec_name ?? "").toLowerCase();
    if (IMAGE_SUBTITLE_CODECS.has(codec)) {
      console.warn(
        `[extract-subtitles] skipping image-based subtitle stream ${stream.index} (${codec}) on scene ${scene.id}`
      );
      continue;
    }

    const language = (stream.tags?.language ?? "und").toLowerCase();
    const label = stream.tags?.title ?? null;
    const streamIndex = stream.index ?? idx;
    const outPath = path.join(
      outDir,
      `embedded-${language}-${streamIndex}.vtt`
    );

    // For ass/ssa streams, also copy the raw codec bytes out so the player
    // can render them with full libass fidelity through JASSUB.
    const isAss = codec === "ass" || codec === "ssa";
    const sourceOutPath = isAss
      ? path.join(outDir, `embedded-${language}-${streamIndex}.ass`)
      : null;
    const sourceFormat: "vtt" | "ass" | "ssa" = isAss
      ? (codec as "ass" | "ssa")
      : "vtt";

    try {
      await runProcess("ffmpeg", [
        "-y",
        "-v",
        "error",
        "-i",
        scene.filePath,
        "-map",
        `0:${streamIndex}`,
        "-c:s",
        "webvtt",
        outPath,
      ]);
    } catch (err) {
      console.warn(
        `[extract-subtitles] ffmpeg failed on stream ${streamIndex} (${codec}) of scene ${scene.id}: ${(err as Error).message}`
      );
      continue;
    }

    if (sourceOutPath) {
      try {
        await runProcess("ffmpeg", [
          "-y",
          "-v",
          "error",
          "-i",
          scene.filePath,
          "-map",
          `0:${streamIndex}`,
          "-c:s",
          "copy",
          sourceOutPath,
        ]);
      } catch (err) {
        console.warn(
          `[extract-subtitles] raw ASS extract failed on stream ${streamIndex} of scene ${scene.id}: ${(err as Error).message}`
        );
        // Non-fatal — we still have the VTT fallback.
        await unlink(sourceOutPath).catch(() => undefined);
      }
    }

    // Verify the output file has content.
    try {
      const info = await stat(outPath);
      if (info.size === 0) {
        await unlink(outPath).catch(() => undefined);
        continue;
      }
    } catch {
      continue;
    }

    // Upsert the row (delete any existing embedded row for this language to
    // keep (sceneId, language, source) unique). We keep just one per language
    // per source — the latest extraction wins.
    const existing = await db
      .select({
        id: sceneSubtitles.id,
        storagePath: sceneSubtitles.storagePath,
        sourcePath: sceneSubtitles.sourcePath,
      })
      .from(sceneSubtitles)
      .where(
        and(
          eq(sceneSubtitles.sceneId, scene.id),
          eq(sceneSubtitles.language, language),
          eq(sceneSubtitles.source, "embedded")
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0]!;
      if (row.storagePath && row.storagePath !== outPath) {
        await unlink(row.storagePath).catch(() => undefined);
      }
      if (row.sourcePath && row.sourcePath !== sourceOutPath) {
        await unlink(row.sourcePath).catch(() => undefined);
      }
      await db
        .update(sceneSubtitles)
        .set({
          storagePath: outPath,
          label,
          format: "vtt",
          sourceFormat,
          sourcePath: sourceOutPath,
        })
        .where(eq(sceneSubtitles.id, row.id));
    } else {
      await db.insert(sceneSubtitles).values({
        sceneId: scene.id,
        language,
        label,
        format: "vtt",
        source: "embedded",
        storagePath: outPath,
        sourceFormat,
        sourcePath: sourceOutPath,
        isDefault: false,
      });
    }

    await markJobProgress(
      job,
      "extract-subtitles",
      Math.round(((idx + 1) / streams.length) * 100)
    );
  }

  await markJobProgress(job, "extract-subtitles", 100);
}
