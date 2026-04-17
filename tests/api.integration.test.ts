import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "../packages/db/src/schema.ts";
import { createApiTestContext, injectJson } from "./support/api.ts";
import {
  cleanupTempDir,
  createSampleSubtitleFile,
  createSampleVideoFile,
  createTempDir,
} from "./support/files.ts";
import { createMultipartBody } from "./support/multipart.ts";

const {
  libraryRoots,
  scenes,
  sceneMarkers,
  sceneSubtitles,
  jobRuns,
} = schema;

describe("API integration", () => {
  let context: Awaited<ReturnType<typeof createApiTestContext>>;
  let mediaDir: string;

  beforeAll(async () => {
    mediaDir = await createTempDir("obscura-api-media-");
    process.env.OBSCURA_CACHE_DIR = await createTempDir("obscura-api-cache-");
    process.env.CHANGELOG_PATH = "CHANGELOG.md";
    context = await createApiTestContext();
  });

  afterAll(async () => {
    await context.close();
    await cleanupTempDir(mediaDir);
    await cleanupTempDir(process.env.OBSCURA_CACHE_DIR!);
    delete process.env.OBSCURA_CACHE_DIR;
    delete process.env.CHANGELOG_PATH;
  });

  it("returns health and initializes library settings", async () => {
    const { response, json } = await injectJson<{ status: string; service: string }>(
      context.app,
      { method: "GET", url: "/health" },
    );
    expect(response.statusCode).toBe(200);
    expect(json).toMatchObject({ status: "ok", service: "api" });

    const settingsResponse = await context.app.inject({ method: "GET", url: "/settings/library" });
    expect(settingsResponse.statusCode).toBe(200);
    const payload = settingsResponse.json() as {
      settings: { id: string; autoScanEnabled: boolean };
      roots: unknown[];
    };
    expect(payload.settings.autoScanEnabled).toBe(false);
    expect(payload.roots).toEqual([]);
  });

  it("creates, filters, and updates library settings and roots", async () => {
    const createRoot = await injectJson<{ id: string; path: string }>(context.app, {
      method: "POST",
      url: "/libraries",
      payload: {
        path: mediaDir,
        label: "Fixtures",
        scanVideos: true,
      },
    });

    expect(createRoot.response.statusCode).toBe(201);
    expect(createRoot.json?.path).toBe(mediaDir);

    const filtered = await context.app.inject({
      method: "GET",
      url: "/libraries?scanVideos=true&enabled=true",
    });
    expect(filtered.statusCode).toBe(200);
    expect((filtered.json() as { roots: Array<{ id: string }> }).roots).toHaveLength(1);

    const settings = await injectJson<{ id: string; subtitleFontScale: number }>(context.app, {
      method: "PUT",
      url: "/settings/library",
      payload: {
        subtitleFontScale: 9,
        subtitleOpacity: 0,
        defaultPlaybackMode: "unsupported",
      },
    });
    expect(settings.response.statusCode).toBe(200);
    expect(settings.json?.subtitleFontScale).toBe(3);
    expect(settings.json?.subtitleOpacity).toBe(0.2);
    expect(settings.json?.defaultPlaybackMode).toBe("direct");
  });

  it("uploads a scene, lists it, updates it, and deletes it", async () => {
    const [root] = await context.db.select().from(libraryRoots).limit(1);
    expect(root).toBeTruthy();

    const upload = createMultipartBody({
      fields: { libraryRootId: root!.id },
      file: {
        fieldName: "file",
        filename: "upload.mp4",
        contentType: "video/mp4",
        content: "fixture-video",
      },
    });

    const uploadResponse = await context.app.inject({
      method: "POST",
      url: "/scenes/upload",
      headers: {
        "content-type": `multipart/form-data; boundary=${upload.boundary}`,
      },
      payload: upload.body,
    });
    expect(uploadResponse.statusCode).toBe(200);
    const uploaded = uploadResponse.json() as { id: string; filePath: string };
    expect(existsSync(uploaded.filePath)).toBe(true);
    expect(context.queue.jobs.map((job) => job.queueName)).toEqual([
      "media-probe",
      "fingerprint",
      "preview",
    ]);

    const listed = await context.app.inject({ method: "GET", url: "/scenes" });
    expect(listed.statusCode).toBe(200);
    expect((listed.json() as { scenes: Array<{ id: string }> }).scenes).toHaveLength(1);

    const patch = await injectJson<{ ok: true; id: string }>(context.app, {
      method: "PATCH",
      url: `/scenes/${uploaded.id}`,
      payload: { title: "Renamed fixture", details: "Updated details", rating: 4 },
    });
    expect(patch.response.statusCode).toBe(200);
    expect(patch.json).toEqual({ ok: true, id: uploaded.id });

    const detail = await context.app.inject({
      method: "GET",
      url: `/scenes/${uploaded.id}`,
    });
    expect(detail.statusCode).toBe(200);
    expect((detail.json() as { title: string }).title).toBe("Renamed fixture");

    const markerCreate = await injectJson<{ id: string; title: string }>(context.app, {
      method: "POST",
      url: `/scenes/${uploaded.id}/markers`,
      payload: { title: "Beat", seconds: 15 },
    });
    expect(markerCreate.response.statusCode).toBe(200);
    expect(markerCreate.json?.title).toBe("Beat");

    const markerPatch = await injectJson<{ ok: true }>(context.app, {
      method: "PATCH",
      url: `/scenes/markers/${markerCreate.json!.id}`,
      payload: { title: "Climax" },
    });
    expect(markerPatch.response.statusCode).toBe(200);

    const markerDelete = await context.app.inject({
      method: "DELETE",
      url: `/scenes/markers/${markerCreate.json!.id}`,
    });
    expect(markerDelete.statusCode).toBe(200);
    expect(
      await context.db
        .select()
        .from(sceneMarkers)
        .where(eq(sceneMarkers.sceneId, uploaded.id)),
    ).toHaveLength(0);

    const deleteResponse = await context.app.inject({
      method: "DELETE",
      url: `/scenes/${uploaded.id}`,
    });
    expect(deleteResponse.statusCode).toBe(200);
    expect(await context.db.select().from(scenes)).toHaveLength(0);
  });

  it("rejects scene uploads without a target root", async () => {
    const upload = createMultipartBody({
      file: {
        fieldName: "file",
        filename: "missing-root.mp4",
        contentType: "video/mp4",
        content: "fixture-video",
      },
    });

    const response = await context.app.inject({
      method: "POST",
      url: "/scenes/upload",
      headers: {
        "content-type": `multipart/form-data; boundary=${upload.boundary}`,
      },
      payload: upload.body,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "libraryRootId or videoSeriesId field is required",
    });
  });

  it("uploads, reads, parses, and deletes subtitle tracks", async () => {
    const sceneFilePath = await createSampleVideoFile(mediaDir, "subtitle-scene.mp4");
    const [scene] = await context.db
      .insert(scenes)
      .values({
        title: "Subtitle Scene",
        filePath: sceneFilePath,
      })
      .returning({ id: scenes.id });

    const subtitlePath = await createSampleSubtitleFile(mediaDir, "track.ass");
    const upload = createMultipartBody({
      fields: { language: "en", label: "English" },
      file: {
        fieldName: "file",
        filename: "track.ass",
        contentType: "text/plain",
        content: await readFile(subtitlePath),
      },
    });

    const response = await context.app.inject({
      method: "POST",
      url: `/scenes/${scene.id}/subtitles`,
      headers: {
        "content-type": `multipart/form-data; boundary=${upload.boundary}`,
      },
      payload: upload.body,
    });
    expect(response.statusCode).toBe(200);
    const track = (response.json() as { track: { id: string; sourceUrl: string | null } }).track;
    expect(track.sourceUrl).not.toBeNull();

    const source = await context.app.inject({
      method: "GET",
      url: `/scenes/${scene.id}/subtitles/${track.id}/source`,
    });
    expect(source.statusCode).toBe(200);
    expect(source.body).toContain("Dialogue:");

    const cues = await context.app.inject({
      method: "GET",
      url: `/scenes/${scene.id}/subtitles/${track.id}/cues`,
    });
    expect(cues.statusCode).toBe(200);
    expect((cues.json() as { cues: Array<{ text: string }> }).cues[0]?.text).toContain(
      "Hello world",
    );

    const deleted = await context.app.inject({
      method: "DELETE",
      url: `/scenes/${scene.id}/subtitles/${track.id}`,
    });
    expect(deleted.statusCode).toBe(200);
    expect(
      await context.db
        .select()
        .from(sceneSubtitles)
        .where(eq(sceneSubtitles.sceneId, scene.id)),
    ).toHaveLength(0);
  });

  it("enqueues preview jobs through the operations route", async () => {
    const videoPath = await createSampleVideoFile(mediaDir, "job-scene.mp4");
    const [scene] = await context.db
      .insert(scenes)
      .values({
        title: "Jobs Scene",
        filePath: videoPath,
      })
      .returning({ id: scenes.id });

    const response = await context.app.inject({
      method: "POST",
      url: "/jobs/queues/preview/run",
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      ok: true;
      queueName: string;
      enqueued: number;
      jobIds: string[];
    };
    expect(body.queueName).toBe("preview");
    expect(body.enqueued).toBeGreaterThanOrEqual(1);

    const queued = await context.db
      .select()
      .from(jobRuns)
      .where(eq(jobRuns.targetId, scene.id));
    expect(queued).toHaveLength(1);
    expect(queued[0]?.status).toBe("waiting");
  });
});
