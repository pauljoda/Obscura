import { mkdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import type { JobLike as Job } from "../lib/job-tracking.js";
import {
  getVideoSubtitlesDir,
  runProcess,
} from "@obscura/media-core";
import {
  db,
  videoEpisodes,
  videoMovies,
  videoSubtitles,
} from "../lib/db.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";
import { resolveRequiredMediaPath } from "../lib/media-paths.js";

type VideoEntityKind = "video_episode" | "video_movie";

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
  const entityKind =
    (job.data.entityKind as VideoEntityKind | undefined) ?? null;

  if (entityKind !== "video_episode" && entityKind !== "video_movie") {
    throw new Error(
      `extract-subtitles processor received unsupported payload ${JSON.stringify(job.data)} — expected entityKind video_episode or video_movie`,
    );
  }

  const entityId = String(job.data.entityId);
  const table = entityKind === "video_episode" ? videoEpisodes : videoMovies;
  const [row] = await db
    .select({ id: table.id, title: table.title, filePath: table.filePath })
    .from(table)
    .where(eq(table.id, entityId))
    .limit(1);

  if (!row?.filePath) {
    throw new Error("Video file not found");
  }

  await markJobActive(job, "extract-subtitles", {
    type: entityKind,
    id: row.id,
    label: row.title ?? undefined,
  });

  const filePath = resolveRequiredMediaPath(row.filePath);

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
    filePath,
  ]);

  let parsed: FfprobeResult = {};
  try {
    parsed = JSON.parse(stdout) as FfprobeResult;
  } catch {
    parsed = {};
  }

  const streams = (parsed.streams ?? []).filter(
    (s) => s.codec_type === "subtitle",
  );

  if (streams.length === 0) {
    await markJobProgress(job, "extract-subtitles", 100);
    return;
  }

  const outDir = getVideoSubtitlesDir(row.id);
  await mkdir(outDir, { recursive: true });

  // Build the plan: one entry per text-based subtitle stream we want to extract.
  // Image-based codecs (PGS, VobSub) are skipped up front because ffmpeg's text
  // codec pipeline can't convert them.
  type Plan = {
    streamIndex: number;
    codec: string;
    language: string;
    label: string | null;
    isAss: boolean;
    outPath: string;
    sourceOutPath: string | null;
    sourceFormat: "vtt" | "ass" | "ssa";
  };

  const plan: Plan[] = [];
  for (const [idx, stream] of streams.entries()) {
    const codec = (stream.codec_name ?? "").toLowerCase();
    if (IMAGE_SUBTITLE_CODECS.has(codec)) {
      console.warn(
        `[extract-subtitles] skipping image-based subtitle stream ${stream.index} (${codec}) on ${entityKind} ${row.id}`,
      );
      continue;
    }

    const language = (stream.tags?.language ?? "und").toLowerCase();
    const label = stream.tags?.title ?? null;
    const streamIndex = stream.index ?? idx;
    const isAss = codec === "ass" || codec === "ssa";

    plan.push({
      streamIndex,
      codec,
      language,
      label,
      isAss,
      outPath: path.join(outDir, `embedded-${language}-${streamIndex}.vtt`),
      sourceOutPath: isAss
        ? path.join(outDir, `embedded-${language}-${streamIndex}.ass`)
        : null,
      sourceFormat: isAss ? (codec as "ass" | "ssa") : "vtt",
    });
  }

  if (plan.length === 0) {
    await markJobProgress(job, "extract-subtitles", 100);
    return;
  }

  await markJobProgress(job, "extract-subtitles", 10);

  // Single-pass extract: one ffmpeg invocation that demuxes the source once
  // and writes every requested subtitle stream into its own output file in
  // the same pass. Each output is an independent (-map / -c:s / path) triple.
  // This is dramatically faster than running one ffmpeg per stream — on a
  // 4.8 GB MKV with 37 SRT tracks: 19.4 s → 0.7 s (29x).
  async function singlePassExtract(plans: Plan[]) {
    const args: string[] = ["-y", "-v", "error", "-i", filePath];
    for (const p of plans) {
      args.push(
        "-map", `0:${p.streamIndex}`,
        "-c:s", "webvtt",
        p.outPath,
      );
      if (p.sourceOutPath) {
        // ASS/SSA streams also get a raw sidecar copy in the same pass.
        args.push(
          "-map", `0:${p.streamIndex}`,
          "-c:s", "copy",
          p.sourceOutPath,
        );
      }
    }
    await runProcess("ffmpeg", args);
  }

  // Per-stream fallback: used when the single-pass call fails (e.g. one
  // malformed stream taking down the whole batch). Preserves the original
  // resilient behaviour of skipping individual bad streams and continuing.
  async function perStreamExtract(p: Plan) {
    await runProcess("ffmpeg", [
      "-y", "-v", "error", "-i", filePath,
      "-map", `0:${p.streamIndex}`,
      "-c:s", "webvtt", p.outPath,
    ]);
    if (p.sourceOutPath) {
      try {
        await runProcess("ffmpeg", [
          "-y", "-v", "error", "-i", filePath,
          "-map", `0:${p.streamIndex}`,
          "-c:s", "copy", p.sourceOutPath,
        ]);
      } catch (err) {
        console.warn(
          `[extract-subtitles] raw ASS extract failed on stream ${p.streamIndex} of ${entityKind} ${row.id}: ${(err as Error).message}`,
        );
        await unlink(p.sourceOutPath).catch(() => undefined);
      }
    }
  }

  try {
    await singlePassExtract(plan);
  } catch (err) {
    console.warn(
      `[extract-subtitles] single-pass extract failed on ${entityKind} ${row.id}, falling back to per-stream: ${(err as Error).message}`,
    );
    for (const p of plan) {
      try {
        await perStreamExtract(p);
      } catch (innerErr) {
        console.warn(
          `[extract-subtitles] ffmpeg failed on stream ${p.streamIndex} (${p.codec}) of ${entityKind} ${row.id}: ${(innerErr as Error).message}`,
        );
      }
    }
  }

  await markJobProgress(job, "extract-subtitles", 75);

  // Verify each output file and upsert metadata. Per-stream errors here
  // (missing file, empty file, DB conflict) only skip that one row.
  for (const [idx, p] of plan.entries()) {
    try {
      const info = await stat(p.outPath);
      if (info.size === 0) {
        await unlink(p.outPath).catch(() => undefined);
        continue;
      }
    } catch {
      continue;
    }

    // Upsert into video_subtitles: one row per
    // (entityType, entityId, language, source="embedded").
    const existing = await db
      .select({
        id: videoSubtitles.id,
        storagePath: videoSubtitles.storagePath,
        sourcePath: videoSubtitles.sourcePath,
      })
      .from(videoSubtitles)
      .where(
        and(
          eq(videoSubtitles.entityType, entityKind),
          eq(videoSubtitles.entityId, row.id),
          eq(videoSubtitles.language, p.language),
          eq(videoSubtitles.source, "embedded"),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const prev = existing[0]!;
      if (prev.storagePath && prev.storagePath !== p.outPath) {
        await unlink(prev.storagePath).catch(() => undefined);
      }
      if (prev.sourcePath && prev.sourcePath !== p.sourceOutPath) {
        await unlink(prev.sourcePath).catch(() => undefined);
      }
      await db
        .update(videoSubtitles)
        .set({
          storagePath: p.outPath,
          label: p.label,
          format: "vtt",
          sourceFormat: p.sourceFormat,
          sourcePath: p.sourceOutPath,
        })
        .where(eq(videoSubtitles.id, prev.id));
    } else {
      await db.insert(videoSubtitles).values({
        entityType: entityKind,
        entityId: row.id,
        language: p.language,
        label: p.label,
        format: "vtt",
        source: "embedded",
        storagePath: p.outPath,
        sourceFormat: p.sourceFormat,
        sourcePath: p.sourceOutPath,
        isDefault: false,
      });
    }

    if (idx === plan.length - 1 || idx % 8 === 0) {
      await markJobProgress(
        job,
        "extract-subtitles",
        75 + Math.round(((idx + 1) / plan.length) * 25),
      );
    }
  }

  await markJobProgress(job, "extract-subtitles", 100);
}
