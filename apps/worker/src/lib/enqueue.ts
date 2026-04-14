import { eq, sql } from "drizzle-orm";
import type { QueueName } from "@obscura/contracts";
import {
  db,
  scenes,
  images,
  audioTracks,
  collections,
  videoEpisodes,
  videoMovies,
} from "./db.js";
import { sendJob } from "./queues.js";
import {
  type QueueTarget,
  type QueueTrigger,
  withTriggerMetadata,
  upsertJobRun,
  hasPendingJob,
} from "./job-tracking.js";

export async function enqueueJobIfNeeded(input: {
  queueName: QueueName;
  jobName: string;
  data: Record<string, unknown>;
  target: QueueTarget;
  trigger?: QueueTrigger;
}) {
  if (await hasPendingJob(input.queueName, input.target)) {
    return null;
  }

  const payload = withTriggerMetadata(input.data, input.trigger);
  const jobId = await sendJob(input.queueName, payload);

  await upsertJobRun(
    { id: jobId, data: payload },
    input.queueName,
    {
      status: "waiting",
      targetType: input.target.type ?? null,
      targetId: input.target.id ?? null,
      targetLabel: input.target.label ?? null,
      payload,
    }
  );

  return { id: jobId };
}

export async function enqueuePendingSceneJob(
  queueName: QueueName,
  sceneId: string,
  trigger: QueueTrigger = {}
) {
  if (
    await hasPendingJob(queueName, {
      type: "scene",
      id: sceneId,
    })
  ) {
    return;
  }

  const [scene] = await db
    .select({ id: scenes.id, title: scenes.title })
    .from(scenes)
    .where(eq(scenes.id, sceneId))
    .limit(1);

  if (!scene) {
    return;
  }

  await enqueueJobIfNeeded({
    queueName,
    jobName: `scene-${queueName}`,
    data: { sceneId },
    target: {
      type: "scene",
      id: scene.id,
      label: scene.title,
    },
    trigger,
  });
}

/**
 * Video-entity variant of enqueuePendingSceneJob. Supports the new
 * video_episodes / video_movies tables. The payload carries an
 * `entityKind` discriminator so processors can look the row up in the
 * right table.
 */
export type VideoEntityKind = "video_episode" | "video_movie";

export async function enqueuePendingVideoJob(
  queueName: QueueName,
  entityKind: VideoEntityKind,
  entityId: string,
  trigger: QueueTrigger = {},
) {
  const targetType = entityKind;
  if (
    await hasPendingJob(queueName, {
      type: targetType,
      id: entityId,
    })
  ) {
    return;
  }

  let title: string | null = null;
  if (entityKind === "video_episode") {
    const [row] = await db
      .select({ id: videoEpisodes.id, title: videoEpisodes.title })
      .from(videoEpisodes)
      .where(eq(videoEpisodes.id, entityId))
      .limit(1);
    if (!row) return;
    title = row.title;
  } else {
    const [row] = await db
      .select({ id: videoMovies.id, title: videoMovies.title })
      .from(videoMovies)
      .where(eq(videoMovies.id, entityId))
      .limit(1);
    if (!row) return;
    title = row.title;
  }

  await enqueueJobIfNeeded({
    queueName,
    jobName: `${entityKind}-${queueName}`,
    data: { entityKind, entityId },
    target: {
      type: targetType,
      id: entityId,
      label: title,
    },
    trigger,
  });
}

export async function enqueuePendingImageJob(
  queueName: QueueName,
  imageId: string,
  trigger: QueueTrigger = {}
) {
  if (
    await hasPendingJob(queueName, {
      type: "image",
      id: imageId,
    })
  ) {
    return;
  }

  const [image] = await db
    .select({ id: images.id, title: images.title })
    .from(images)
    .where(eq(images.id, imageId))
    .limit(1);

  if (!image) return;

  await enqueueJobIfNeeded({
    queueName,
    jobName: `image-${queueName}`,
    data: { imageId },
    target: {
      type: "image",
      id: image.id,
      label: image.title,
    },
    trigger,
  });
}

export async function enqueueLibraryRootJob(
  root: { id: string; label: string; path: string; recursive: boolean },
  trigger: QueueTrigger = {}
) {
  await enqueueJobIfNeeded({
    queueName: "library-scan",
    jobName: "library-root-scan",
    data: {
      libraryRootId: root.id,
      path: root.path,
      recursive: root.recursive,
    },
    target: {
      type: "library-root",
      id: root.id,
      label: root.label,
    },
    trigger,
  });
}

export async function enqueueGalleryRootJob(
  root: { id: string; label: string },
  trigger: QueueTrigger = {},
  opts?: { sfwOnly?: boolean }
) {
  await enqueueJobIfNeeded({
    queueName: "gallery-scan",
    jobName: "gallery-root-scan",
    data: {
      libraryRootId: root.id,
      ...(opts?.sfwOnly ? { sfwOnly: true } : {}),
    },
    target: {
      type: "library-root",
      id: root.id,
      label: root.label,
    },
    trigger,
  });
}

export async function enqueuePendingAudioTrackJob(
  queueName: QueueName,
  trackId: string,
  trigger: QueueTrigger = {},
) {
  if (
    await hasPendingJob(queueName, {
      type: "audio-track",
      id: trackId,
    })
  ) {
    return;
  }

  const [track] = await db
    .select({ id: audioTracks.id, title: audioTracks.title })
    .from(audioTracks)
    .where(eq(audioTracks.id, trackId))
    .limit(1);

  if (!track) return;

  await enqueueJobIfNeeded({
    queueName,
    jobName: `audio-${queueName}`,
    data: { trackId },
    target: {
      type: "audio-track",
      id: track.id,
      label: track.title,
    },
    trigger,
  });
}

export async function enqueueAudioRootJob(
  root: { id: string; label: string },
  trigger: QueueTrigger = {},
  opts?: { sfwOnly?: boolean },
) {
  await enqueueJobIfNeeded({
    queueName: "audio-scan",
    jobName: "audio-root-scan",
    data: {
      libraryRootId: root.id,
      ...(opts?.sfwOnly ? { sfwOnly: true } : {}),
    },
    target: {
      type: "library-root",
      id: root.id,
      label: root.label,
    },
    trigger,
  });
}

/**
 * Enqueue refresh jobs for all dynamic/hybrid collections.
 * Called at the end of library scans to keep collections up-to-date.
 */
export async function enqueueCollectionRefreshAll(
  trigger: QueueTrigger = {},
) {
  const dynamicCollections = await db
    .select({ id: collections.id, name: collections.name })
    .from(collections)
    .where(
      sql`${collections.mode} IN ('dynamic', 'hybrid') AND ${collections.ruleTree} IS NOT NULL`,
    );

  for (const coll of dynamicCollections) {
    await enqueueJobIfNeeded({
      queueName: "collection-refresh",
      jobName: `collection-refresh-${coll.id}`,
      data: { collectionId: coll.id },
      target: {
        type: "collection",
        id: coll.id,
        label: coll.name,
      },
      trigger,
    });
  }
}
