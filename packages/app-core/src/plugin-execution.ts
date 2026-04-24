import { eq } from "drizzle-orm";
import { schema, type AppDb } from "@obscura/db";
import {
  loadTypeScriptPlugin,
  PluginExecutionError,
  readManifest,
  resolvePluginAuth,
  runNativePythonPlugin,
  type OscuraPluginManifest,
  type PluginInput,
} from "@obscura/plugins";
import { updateAudioLibraryWrite, updateAudioTrackWrite, updateGalleryWrite, updateImageWrite } from "./media";
import { setVideoSeriesCoverFromUrlWrite, updateVideoSeriesWrite } from "./video-series";
import { InternalError, NotFoundError, ValidationError, ConflictError } from "./errors";
import { deriveProposedResultFromPluginOutput } from "./plugin-proposed-result";

const { pluginAuth, pluginPackages, scrapeResults, videoEpisodes, videoMovies, videoSeries } =
  schema;

export interface ExecutePluginInput {
  pluginDbId: string;
  action: string;
  entityId?: string;
  input?: Record<string, unknown>;
  saveResult?: boolean;
}

export interface AcceptPluginResultInput {
  scrapeResultId: string;
  fields?: string[];
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function resolveInstalledPlugin(db: AppDb, pluginDbId: string) {
  const [plugin] = await db
    .select()
    .from(pluginPackages)
    .where(eq(pluginPackages.id, pluginDbId))
    .limit(1);

  if (!plugin) {
    throw new NotFoundError("Plugin not found");
  }

  return plugin;
}

async function loadInstalledPluginManifest(
  pluginId: string,
  installPath: string,
): Promise<OscuraPluginManifest> {
  try {
    return await readManifest(installPath);
  } catch (error) {
    throw new InternalError(`Failed to read plugin manifest: ${toErrorMessage(error)}`);
  }
}

async function resolveInstalledPluginAuth(db: AppDb, pluginId: string) {
  const authRows = await db
    .select({
      authKey: pluginAuth.authKey,
      encryptedValue: pluginAuth.encryptedValue,
    })
    .from(pluginAuth)
    .where(eq(pluginAuth.pluginId, pluginId));

  return resolvePluginAuth(pluginId, authRows);
}

async function runPluginAction(args: {
  manifest: OscuraPluginManifest;
  installPath: string;
  action: string;
  input: Record<string, unknown> | undefined;
  auth: Record<string, string>;
}) {
  if (args.manifest.runtime === "typescript") {
    const plugin = await loadTypeScriptPlugin(args.manifest, args.installPath);
    return plugin.execute(
      args.action,
      (args.input ?? {}) as PluginInput,
      args.auth,
    );
  }

  if (args.manifest.runtime === "python") {
    return runNativePythonPlugin(
      args.manifest,
      args.installPath,
      args.action,
      (args.input ?? {}) as PluginInput,
      args.auth,
    );
  }

  throw new ValidationError(`Unsupported plugin runtime: ${args.manifest.runtime}`);
}

async function resolveSavedEntityType(
  db: AppDb,
  action: string,
  entityId: string,
): Promise<string> {
  if (action.startsWith("folder") || action.startsWith("series")) {
    return "video_series";
  }

  if (action === "audioLibraryByName") {
    return "audio_library";
  }

  if (action.startsWith("audio")) {
    return "audio_track";
  }

  if (action.startsWith("gallery")) {
    return "gallery";
  }

  if (action.startsWith("image")) {
    return "image";
  }

  const [episode] = await db
    .select({ id: videoEpisodes.id })
    .from(videoEpisodes)
    .where(eq(videoEpisodes.id, entityId))
    .limit(1);

  if (episode) return "video_episode";

  const [movie] = await db
    .select({ id: videoMovies.id })
    .from(videoMovies)
    .where(eq(videoMovies.id, entityId))
    .limit(1);

  return movie ? "video_movie" : "video";
}

function firstPosterUrl(proposedResult: Record<string, unknown> | null): string | null {
  if (!proposedResult || !Array.isArray(proposedResult.posterCandidates)) {
    return null;
  }

  const first = proposedResult.posterCandidates[0] as Record<string, unknown> | undefined;
  return typeof first?.url === "string" ? first.url : null;
}

function deriveCastNames(
  rawResult: Record<string, unknown>,
  proposedResult: Record<string, unknown> | null,
): string[] | null {
  if (Array.isArray(rawResult.performerNames)) {
    return rawResult.performerNames as string[];
  }

  if (!proposedResult || !Array.isArray(proposedResult.cast)) {
    if (typeof rawResult.artist === "string" && rawResult.artist.trim()) {
      const parts = rawResult.artist
        .split(/\s*,\s*|\s+(?:feat\.?|featuring|&|x)\s+/i)
        .map((value) => value.trim())
        .filter(Boolean);
      return parts.length > 0 ? parts : null;
    }
    return null;
  }

  const names: string[] = [];
  for (const member of proposedResult.cast as Array<{ name?: string }>) {
    if (typeof member?.name === "string" && member.name.trim()) {
      names.push(member.name.trim());
    }
  }

  return names.length > 0 ? names : null;
}

function deriveGenreTags(
  rawResult: Record<string, unknown>,
  proposedResult: Record<string, unknown> | null,
): string[] | null {
  if (Array.isArray(rawResult.tagNames)) {
    return rawResult.tagNames as string[];
  }

  if (!proposedResult || !Array.isArray(proposedResult.genres)) {
    return null;
  }

  const genres = proposedResult.genres.filter(
    (value): value is string => typeof value === "string",
  );

  return genres.length > 0 ? genres : null;
}

async function maybeSavePluginResult(args: {
  db: AppDb;
  plugin: Awaited<ReturnType<typeof resolveInstalledPlugin>>;
  action: string;
  entityId?: string;
  saveResult?: boolean;
  result: unknown;
}) {
  if (
    !args.saveResult ||
    !args.entityId ||
    !args.result ||
    typeof args.result !== "object"
  ) {
    return null;
  }

  const rawResult = args.result as Record<string, unknown>;
  const entityType = await resolveSavedEntityType(args.db, args.action, args.entityId);
  const proposedResult = deriveProposedResultFromPluginOutput(args.result);
  const proposedTitle = (proposedResult?.title ??
    rawResult.title ??
    rawResult.name ??
    null) as string | null;
  const proposedDate = (proposedResult?.firstAirDate ??
    rawResult.date ??
    null) as string | null;
  const proposedDetails = (proposedResult?.overview ??
    rawResult.details ??
    null) as string | null;
  const proposedImageUrl = (firstPosterUrl(proposedResult) ??
    rawResult.imageUrl ??
    null) as string | null;
  const castNames = deriveCastNames(rawResult, proposedResult);
  const genreTags = deriveGenreTags(rawResult, proposedResult);

  const [saved] = await args.db
    .insert(scrapeResults)
    .values({
      entityType,
      entityId: args.entityId,
      pluginPackageId: args.plugin.id,
      action: args.action,
      matchType: "plugin",
      status: "pending",
      rawResult: args.result as Record<string, unknown>,
      proposedResult: proposedResult ?? null,
      proposedTitle,
      proposedDate,
      proposedDetails,
      proposedUrl: Array.isArray(rawResult.urls)
        ? ((rawResult.urls[0] as string | undefined) ?? null)
        : ((rawResult.url as string | undefined) ?? null),
      proposedUrls: Array.isArray(rawResult.urls)
        ? (rawResult.urls as string[])
        : null,
      proposedStudioName: (proposedResult?.studioName ??
        rawResult.studioName ??
        null) as string | null,
      proposedPerformerNames: castNames,
      proposedTagNames: genreTags,
      proposedImageUrl,
      proposedEpisodeNumber:
        typeof rawResult.episodeNumber === "number" ? rawResult.episodeNumber : null,
    })
    .returning();

  return {
    saved,
    normalized: {
      title: proposedTitle,
      date: proposedDate,
      details: proposedDetails,
      url: Array.isArray(rawResult.urls)
        ? ((rawResult.urls[0] as string | undefined) ?? null)
        : ((rawResult.url as string | undefined) ?? null),
      studioName: (proposedResult?.studioName ??
        rawResult.studioName ??
        null) as string | null,
      performerNames: castNames ?? [],
      tagNames: genreTags ?? [],
      imageUrl: proposedImageUrl,
    },
  };
}

export async function executePluginWrite(db: AppDb, input: ExecutePluginInput) {
  if (!input.action) {
    throw new ValidationError("action is required");
  }

  const plugin = await resolveInstalledPlugin(db, input.pluginDbId);
  if (!plugin.enabled) {
    throw new ValidationError("Plugin is disabled");
  }

  const auth = await resolveInstalledPluginAuth(db, plugin.pluginId);
  const manifest = await loadInstalledPluginManifest(plugin.pluginId, plugin.installPath);

  try {
    const result = await runPluginAction({
      manifest,
      installPath: plugin.installPath,
      action: input.action,
      input: input.input,
      auth,
    });

    const saved = await maybeSavePluginResult({
      db,
      plugin,
      action: input.action,
      entityId: input.entityId,
      saveResult: input.saveResult,
      result,
    });

    if (saved) {
      return {
        ok: true as const,
        result: saved.saved,
        normalized: saved.normalized,
        pluginId: plugin.pluginId,
        action: input.action,
      };
    }

    return {
      ok: true as const,
      result,
      pluginId: plugin.pluginId,
      action: input.action,
    };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    if (error instanceof PluginExecutionError) {
      throw new InternalError(`Plugin execution failed: ${error.message}`);
    }
    throw new InternalError(`Plugin execution failed: ${toErrorMessage(error)}`);
  }
}

function buildDefaultAcceptedFields(fields?: string[]) {
  return new Set(
    fields ?? ["title", "date", "details", "url", "studio", "tags", "image"],
  );
}

async function applySeriesPluginResult(
  db: AppDb,
  entityId: string,
  result: Awaited<ReturnType<typeof loadScrapeResult>>,
  fieldsToApply: Set<string>,
) {
  const patch: Record<string, unknown> = {};

  if (fieldsToApply.has("title") && result.proposedTitle) {
    patch.customName = result.proposedTitle;
  }
  if (fieldsToApply.has("details") && result.proposedDetails) {
    patch.details = result.proposedDetails;
  }
  if (fieldsToApply.has("date") && result.proposedDate) {
    patch.date = result.proposedDate;
  }
  if (fieldsToApply.has("studio") && result.proposedStudioName) {
    patch.studioName = result.proposedStudioName;
  }
  if (fieldsToApply.has("tags") && result.proposedTagNames?.length) {
    patch.tagNames = result.proposedTagNames;
  }

  if (Object.keys(patch).length > 0) {
    await updateVideoSeriesWrite(
      db,
      entityId,
      patch as Parameters<typeof updateVideoSeriesWrite>[2],
    );
  }

  const rawResult = result.rawResult as Record<string, unknown> | null;
  const externalIdPatch: Record<string, string> = {};

  if (fieldsToApply.has("url") && result.proposedUrls?.length) {
    result.proposedUrls.forEach((url, index) => {
      externalIdPatch[index === 0 ? "url" : `url_${index}`] = url;
    });
  }

  if (rawResult && typeof rawResult.seriesExternalId === "string") {
    externalIdPatch.seriesExternalId = rawResult.seriesExternalId;
  }

  if (Object.keys(externalIdPatch).length > 0) {
    const [existing] = await db
      .select({ externalIds: videoSeries.externalIds })
      .from(videoSeries)
      .where(eq(videoSeries.id, entityId))
      .limit(1);

    await db
      .update(videoSeries)
      .set({
        externalIds: { ...(existing?.externalIds ?? {}), ...externalIdPatch },
        updatedAt: new Date(),
      })
      .where(eq(videoSeries.id, entityId));
  }

  if (fieldsToApply.has("image") && result.proposedImageUrl) {
    try {
      await setVideoSeriesCoverFromUrlWrite(db, entityId, "cover", result.proposedImageUrl);
    } catch (error) {
      console.warn(
        `[plugins/accept] cover download failed for series ${entityId}: ${toErrorMessage(error)}`,
      );
    }
  }
}

async function applyNonVideoPluginResult(
  db: AppDb,
  entityId: string,
  result: Awaited<ReturnType<typeof loadScrapeResult>>,
  fieldsToApply: Set<string>,
) {
  const patch: Record<string, unknown> = {};

  if (fieldsToApply.has("title") && result.proposedTitle) {
    patch.title = result.proposedTitle;
  }
  if (fieldsToApply.has("details") && result.proposedDetails) {
    patch.details = result.proposedDetails;
  }
  if (fieldsToApply.has("date") && result.proposedDate) {
    patch.date = result.proposedDate;
  }
  if (fieldsToApply.has("studio") && result.proposedStudioName) {
    patch.studioName = result.proposedStudioName;
  }
  if (fieldsToApply.has("performers") && result.proposedPerformerNames?.length) {
    patch.performerNames = result.proposedPerformerNames;
  }
  if (fieldsToApply.has("tags") && result.proposedTagNames?.length) {
    patch.tagNames = result.proposedTagNames;
  }

  if (Object.keys(patch).length === 0) {
    return;
  }

  if (result.entityType === "audio_library") {
    await updateAudioLibraryWrite(
      db,
      entityId,
      patch as Parameters<typeof updateAudioLibraryWrite>[2],
    );
    return;
  }

  if (result.entityType === "audio_track") {
    await updateAudioTrackWrite(
      db,
      entityId,
      patch as Parameters<typeof updateAudioTrackWrite>[2],
    );
    return;
  }

  if (result.entityType === "gallery") {
    await updateGalleryWrite(
      db,
      entityId,
      patch as Parameters<typeof updateGalleryWrite>[2],
    );
    return;
  }

  if (result.entityType === "image") {
    await updateImageWrite(db, entityId, patch as Parameters<typeof updateImageWrite>[2]);
  }
}

async function loadScrapeResult(db: AppDb, scrapeResultId: string) {
  const [result] = await db
    .select()
    .from(scrapeResults)
    .where(eq(scrapeResults.id, scrapeResultId))
    .limit(1);

  if (!result) {
    throw new NotFoundError("Result not found");
  }

  return result;
}

export async function acceptPluginResultWrite(
  db: AppDb,
  input: AcceptPluginResultInput,
) {
  const result = await loadScrapeResult(db, input.scrapeResultId);

  if (result.appliedAt) {
    throw new ConflictError("Already applied");
  }

  const entityId = result.entityId;
  if (!entityId) {
    throw new ValidationError("Result has no entity ID");
  }

  const fieldsToApply = buildDefaultAcceptedFields(input.fields);

  if (result.entityType === "video_series") {
    await applySeriesPluginResult(db, entityId, result, fieldsToApply);
  } else if (
    result.entityType === "video" ||
    result.entityType === "video_episode" ||
    result.entityType === "video_movie"
  ) {
    throw new ValidationError("Use /scrapers/results/:id/accept for video results");
  } else if (
    result.entityType === "audio_library" ||
    result.entityType === "audio_track" ||
    result.entityType === "gallery" ||
    result.entityType === "image"
  ) {
    try {
      await applyNonVideoPluginResult(db, entityId, result, fieldsToApply);
    } catch (error) {
      throw new InternalError(`Failed to apply scrape patch: ${toErrorMessage(error)}`);
    }
  }

  await db
    .update(scrapeResults)
    .set({ status: "pending", appliedAt: new Date(), updatedAt: new Date() })
    .where(eq(scrapeResults.id, input.scrapeResultId));

  await db
    .update(scrapeResults)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(eq(scrapeResults.id, input.scrapeResultId));

  return {
    ok: true as const,
    entityType: result.entityType,
    entityId,
  };
}
