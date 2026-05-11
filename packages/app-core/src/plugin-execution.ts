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
import {
  setGalleryCoverFromUrlWrite,
  updateGalleryWrite,
  updateImageWrite,
} from "./gallery-media";
import { updateAudioLibraryWrite } from "./audio-libraries";
import { updateAudioTrackWrite } from "./audio-tracks";
import {
  setBookChapterCoverFromUrlWrite,
  setBookCoverFromUrlWrite,
  updateBookWrite,
} from "./books";
import { setVideoSeriesCoverFromUrlWrite, updateVideoSeriesWrite } from "./video-series";
import { InternalError, NotFoundError, ValidationError, ConflictError } from "./errors";
import { deriveProposedResultFromPluginOutput } from "./plugin-proposed-result";

const {
  bookChapters,
  books,
  pluginAuth,
  pluginPackages,
  scrapeResults,
  videoEpisodes,
  videoMovies,
  videoSeries,
} = schema;

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
  selectedImages?: Record<string, string | null | undefined>;
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

  if (
    action.startsWith("book") ||
    action.startsWith("comic") ||
    action.startsWith("manga")
  ) {
    return "book";
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

  if (proposedResult && Array.isArray(proposedResult.performerNames)) {
    return proposedResult.performerNames as string[];
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

  if (proposedResult && Array.isArray(proposedResult.tagNames)) {
    return proposedResult.tagNames as string[];
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
    proposedResult?.name ??
    rawResult.title ??
    rawResult.name ??
    null) as string | null;
  const proposedDate = (proposedResult?.firstAirDate ??
    proposedResult?.date ??
    rawResult.date ??
    null) as string | null;
  const proposedDetails = (proposedResult?.overview ??
    proposedResult?.details ??
    rawResult.details ??
    null) as string | null;
  const proposedImageUrl = (firstPosterUrl(proposedResult) ??
    proposedResult?.imageUrl ??
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
        : Array.isArray(proposedResult?.urls)
          ? ((proposedResult.urls[0] as string | undefined) ?? null)
        : ((rawResult.url as string | undefined) ?? null),
      proposedUrls: Array.isArray(rawResult.urls)
        ? (rawResult.urls as string[])
        : Array.isArray(proposedResult?.urls)
          ? (proposedResult.urls as string[])
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

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringRecordOrNull(value: unknown): Record<string, string> | null {
  const record = recordOrNull(value);
  if (!record) return null;
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(record)) {
    if (typeof raw === "string" && raw.trim()) out[key] = raw.trim();
  }
  return Object.keys(out).length > 0 ? out : null;
}

function integerChapterNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

async function applyBookChapterPluginMetadata(
  db: AppDb,
  bookId: string,
  result: Awaited<ReturnType<typeof loadScrapeResult>>,
  fieldsToApply: Set<string>,
  selectedImages?: Record<string, string | null | undefined>,
) {
  const proposed = recordOrNull(result.proposedResult);
  if (!proposed) return;

  const externalIds = stringRecordOrNull(proposed.externalIds);
  const mangadexChapter = externalIds?.mangadexChapter;
  const chapterNumber = integerChapterNumber(
    proposed.chapterNumber ?? externalIds?.chapterNumber,
  );
  const manualChapterCovers = Object.entries(selectedImages ?? {})
    .filter(([key, value]) => key.startsWith("chapterCover:") && typeof value === "string")
    .map(([key, value]) => ({
      chapterId: key.slice("chapterCover:".length),
      url: value?.trim() ?? "",
    }))
    .filter((entry) => entry.chapterId && entry.url);
  const selectedMatchedChapterCover =
    selectedImages && Object.prototype.hasOwnProperty.call(selectedImages, "chapterCover")
      ? selectedImages.chapterCover
      : undefined;

  if (
    manualChapterCovers.length === 0 &&
    selectedMatchedChapterCover === undefined &&
    !mangadexChapter &&
    chapterNumber == null
  ) {
    return;
  }

  const chapters = await db
    .select({
      id: bookChapters.id,
      chapterNumber: bookChapters.chapterNumber,
      externalIds: bookChapters.externalIds,
    })
    .from(bookChapters)
    .where(eq(bookChapters.bookId, bookId));

  if (fieldsToApply.has("image") && manualChapterCovers.length > 0) {
    const chapterIds = new Set(chapters.map((chapter) => chapter.id));
    for (const entry of manualChapterCovers) {
      if (!chapterIds.has(entry.chapterId)) continue;
      try {
        await setBookChapterCoverFromUrlWrite(db, entry.chapterId, entry.url);
      } catch (error) {
        console.warn(
          `[plugins/accept] cover download failed for book chapter ${entry.chapterId}: ${toErrorMessage(error)}`,
        );
      }
    }
  }

  const target =
    (mangadexChapter
      ? chapters.find((chapter) => chapter.externalIds?.mangadexChapter === mangadexChapter)
      : null) ??
    (chapterNumber != null
      ? chapters.find((chapter) => chapter.chapterNumber === chapterNumber)
      : null) ??
    (chapters.length === 1 ? chapters[0] : null);

  if (!target) return;

  if (externalIds) {
    await db
      .update(bookChapters)
      .set({
        externalIds: { ...(target.externalIds ?? {}), ...externalIds },
        updatedAt: new Date(),
      })
      .where(eq(bookChapters.id, target.id));
  }

  const matchedChapterCover =
    typeof selectedMatchedChapterCover === "string" && selectedMatchedChapterCover.trim()
      ? selectedMatchedChapterCover.trim()
      : null;
  if (fieldsToApply.has("image") && matchedChapterCover) {
    try {
      await setBookChapterCoverFromUrlWrite(db, target.id, matchedChapterCover);
    } catch (error) {
      console.warn(
        `[plugins/accept] cover download failed for book chapter ${target.id}: ${toErrorMessage(error)}`,
      );
    }
  }
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
  selectedImages?: Record<string, string | null | undefined>,
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
  if (
    (result.entityType === "gallery" || result.entityType === "book") &&
    result.proposedResult &&
    typeof (result.proposedResult as Record<string, unknown>).isNsfw === "boolean"
  ) {
    patch.isNsfw = (result.proposedResult as Record<string, unknown>).isNsfw;
  }

  if (result.entityType === "audio_library") {
    if (Object.keys(patch).length === 0) return;
    await updateAudioLibraryWrite(
      db,
      entityId,
      patch as Parameters<typeof updateAudioLibraryWrite>[2],
    );
    return;
  }

  if (result.entityType === "audio_track") {
    if (Object.keys(patch).length === 0) return;
    await updateAudioTrackWrite(
      db,
      entityId,
      patch as Parameters<typeof updateAudioTrackWrite>[2],
    );
    return;
  }

  if (result.entityType === "gallery") {
    if (Object.keys(patch).length > 0) {
      await updateGalleryWrite(
        db,
        entityId,
        patch as Parameters<typeof updateGalleryWrite>[2],
      );
    }
    if (fieldsToApply.has("image") && result.proposedImageUrl) {
      try {
        await setGalleryCoverFromUrlWrite(db, entityId, result.proposedImageUrl);
      } catch (error) {
        console.warn(
          `[plugins/accept] cover download failed for gallery ${entityId}: ${toErrorMessage(error)}`,
        );
      }
    }
    return;
  }

  if (result.entityType === "book") {
    if (Object.keys(patch).length > 0) {
      await updateBookWrite(
        db,
        entityId,
        patch as Parameters<typeof updateBookWrite>[2],
      );
    }
    const proposed = result.proposedResult as Record<string, unknown> | null;
    const urlPatch: Record<string, unknown> = {};
    if (fieldsToApply.has("url") && result.proposedUrls?.length) {
      urlPatch.urls = result.proposedUrls;
    }
    if (proposed?.externalIds && typeof proposed.externalIds === "object") {
      const [existing] = await db
        .select({ externalIds: books.externalIds })
        .from(books)
        .where(eq(books.id, entityId))
        .limit(1);
      urlPatch.externalIds = {
        ...(existing?.externalIds ?? {}),
        ...(proposed.externalIds as Record<string, string>),
      };
    }
    if (Object.keys(urlPatch).length > 0) {
      await db
        .update(books)
        .set({ ...urlPatch, updatedAt: new Date() })
        .where(eq(books.id, entityId));
    }
    const hasSelectedBookCover =
      selectedImages &&
      (Object.prototype.hasOwnProperty.call(selectedImages, "cover") ||
        Object.prototype.hasOwnProperty.call(selectedImages, "poster"));
    const selectedBookCover =
      typeof selectedImages?.cover === "string" && selectedImages.cover.trim()
        ? selectedImages.cover.trim()
        : typeof selectedImages?.poster === "string" && selectedImages.poster.trim()
          ? selectedImages.poster.trim()
          : null;
    const bookCoverUrl = hasSelectedBookCover ? selectedBookCover : result.proposedImageUrl;
    if (fieldsToApply.has("image") && bookCoverUrl) {
      try {
        await setBookCoverFromUrlWrite(db, entityId, bookCoverUrl);
      } catch (error) {
        console.warn(
          `[plugins/accept] cover download failed for book ${entityId}: ${toErrorMessage(error)}`,
        );
      }
    }
    await applyBookChapterPluginMetadata(db, entityId, result, fieldsToApply, selectedImages);
    return;
  }

  if (result.entityType === "image") {
    if (Object.keys(patch).length === 0) return;
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
    result.entityType === "book" ||
    result.entityType === "image"
  ) {
    try {
      await applyNonVideoPluginResult(
        db,
        entityId,
        result,
        fieldsToApply,
        input.selectedImages,
      );
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
