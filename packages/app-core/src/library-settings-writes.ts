/**
 * Library settings write helper shared by Fastify and SvelteKit. Takes a
 * typed Drizzle db and a partial payload, applies the same validation /
 * normalization / clamping as the Fastify route did historically, and
 * returns the updated row.
 */
import {
  normalizeBackgroundWorkerConcurrency,
  normalizePlaybackMode,
  subtitleDisplayStyles,
  type SubtitleDisplayStyle,
} from "@obscura/contracts";
import { schema, type AppDb } from "@obscura/db";
import { eq } from "drizzle-orm";

const { librarySettings } = schema;

type LibrarySettingsRow = typeof librarySettings.$inferSelect;
type LibrarySettingsInsert = typeof librarySettings.$inferInsert;

export type LibrarySettingsWritePayload = Partial<LibrarySettingsInsert>;

function normalizeSubtitleStyle(value: unknown): SubtitleDisplayStyle {
  if (
    typeof value === "string" &&
    (subtitleDisplayStyles as readonly string[]).includes(value)
  ) {
    return value as SubtitleDisplayStyle;
  }
  return "stylized";
}

function clampRange(value: unknown, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

async function ensureLibrarySettingsRowRead(
  db: AppDb,
): Promise<LibrarySettingsRow> {
  const [existing] = await db.select().from(librarySettings).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(librarySettings).values({}).returning();
  return created;
}

export async function updateLibrarySettingsWrite(
  db: AppDb,
  payload: LibrarySettingsWritePayload,
): Promise<LibrarySettingsRow> {
  const settings = await ensureLibrarySettingsRowRead(db);

  const [updated] = await db
    .update(librarySettings)
    .set({
      autoScanEnabled: payload.autoScanEnabled ?? settings.autoScanEnabled,
      scanIntervalMinutes:
        payload.scanIntervalMinutes ?? settings.scanIntervalMinutes,
      autoGenerateMetadata:
        payload.autoGenerateMetadata ?? settings.autoGenerateMetadata,
      autoGenerateFingerprints:
        payload.autoGenerateFingerprints ?? settings.autoGenerateFingerprints,
      generatePhash: payload.generatePhash ?? settings.generatePhash,
      autoGeneratePreview:
        payload.autoGeneratePreview ?? settings.autoGeneratePreview,
      generateTrickplay:
        payload.generateTrickplay ?? settings.generateTrickplay,
      trickplayIntervalSeconds:
        payload.trickplayIntervalSeconds ?? settings.trickplayIntervalSeconds,
      previewClipDurationSeconds:
        payload.previewClipDurationSeconds ??
        settings.previewClipDurationSeconds,
      thumbnailQuality: payload.thumbnailQuality ?? settings.thumbnailQuality,
      trickplayQuality: payload.trickplayQuality ?? settings.trickplayQuality,
      backgroundWorkerConcurrency: normalizeBackgroundWorkerConcurrency(
        payload.backgroundWorkerConcurrency ??
          settings.backgroundWorkerConcurrency,
      ),
      nsfwLanAutoEnable:
        payload.nsfwLanAutoEnable ?? settings.nsfwLanAutoEnable,
      metadataStorageDedicated:
        payload.metadataStorageDedicated ?? settings.metadataStorageDedicated,
      subtitlesAutoEnable:
        payload.subtitlesAutoEnable ?? settings.subtitlesAutoEnable,
      subtitlesPreferredLanguages:
        typeof payload.subtitlesPreferredLanguages === "string"
          ? payload.subtitlesPreferredLanguages.trim()
          : settings.subtitlesPreferredLanguages,
      subtitleStyle: normalizeSubtitleStyle(
        payload.subtitleStyle ?? settings.subtitleStyle,
      ),
      subtitleFontScale: clampRange(
        payload.subtitleFontScale ?? settings.subtitleFontScale,
        0.5,
        3,
      ),
      subtitlePositionPercent: clampRange(
        payload.subtitlePositionPercent ?? settings.subtitlePositionPercent,
        0,
        100,
      ),
      subtitleOpacity: clampRange(
        payload.subtitleOpacity ?? settings.subtitleOpacity,
        0.2,
        1,
      ),
      defaultPlaybackMode: normalizePlaybackMode(
        payload.defaultPlaybackMode ?? settings.defaultPlaybackMode,
      ),
      updatedAt: new Date(),
    })
    .where(eq(librarySettings.id, settings.id))
    .returning();

  return updated;
}
