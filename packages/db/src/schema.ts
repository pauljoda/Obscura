import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  real,
  timestamp,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Studios ────────────────────────────────────────────────────────
export const studios = pgTable(
  "studios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    aliases: text("aliases"),
    url: text("url"),
    parentId: uuid("parent_id").references(/* drizzle requires any for self-referential FKs */ (): any => studios.id),
    imageUrl: text("image_url"),
    imagePath: text("image_path"),
    favorite: boolean("favorite").default(false).notNull(),
    rating: integer("rating"),
    isNsfw: boolean("is_nsfw").default(false).notNull(),
    // scene_count is dropped by drizzle migration 0014 — services
    // compute counts on demand from video_episodes + video_movies.
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("studios_name_idx").on(table.name),
    index("studios_favorite_idx").on(table.favorite),
    index("studios_rating_idx").on(table.rating),
  ]
);

export const studiosRelations = relations(studios, ({ many, one }) => ({
  galleries: many(galleries),
  images: many(images),
  audioLibraries: many(audioLibraries),
  audioTracks: many(audioTracks),
  parent: one(studios, {
    fields: [studios.parentId],
    references: [studios.id],
    relationName: "studioParent",
  }),
  children: many(studios, { relationName: "studioParent" }),
}));

// ─── Performers ─────────────────────────────────────────────────────
export const performers = pgTable(
  "performers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    disambiguation: text("disambiguation"),
    aliases: text("aliases"),
    gender: text("gender"),
    birthdate: text("birthdate"),
    country: text("country"),
    ethnicity: text("ethnicity"),
    eyeColor: text("eye_color"),
    hairColor: text("hair_color"),
    height: integer("height"),
    weight: integer("weight"),
    measurements: text("measurements"),
    tattoos: text("tattoos"),
    piercings: text("piercings"),
    careerStart: integer("career_start"),
    careerEnd: integer("career_end"),
    details: text("details"),
    imageUrl: text("image_url"),
    imagePath: text("image_path"),
    favorite: boolean("favorite").default(false).notNull(),
    rating: integer("rating"),
    isNsfw: boolean("is_nsfw").default(false).notNull(),
    // scene_count dropped by drizzle migration 0014 (see studios note).
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("performers_name_idx").on(table.name),
    index("performers_gender_idx").on(table.gender),
    index("performers_favorite_idx").on(table.favorite),
    index("performers_rating_idx").on(table.rating),
    index("performers_created_at_idx").on(table.createdAt),
  ]
);

export const performersRelations = relations(performers, ({ many }) => ({
  performerTags: many(performerTags),
  galleryPerformers: many(galleryPerformers),
  imagePerformers: many(imagePerformers),
  audioLibraryPerformers: many(audioLibraryPerformers),
  audioTrackPerformers: many(audioTrackPerformers),
}));

// ─── Tags ───────────────────────────────────────────────────────────
export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    aliases: text("aliases"),
    parentId: uuid("parent_id").references(/* drizzle requires any for self-referential FKs */ (): any => tags.id),
    favorite: boolean("favorite").default(false).notNull(),
    ignoreAutoTag: boolean("ignore_auto_tag").default(false).notNull(),
    imageUrl: text("image_url"),
    imagePath: text("image_path"),
    rating: integer("rating"),
    isNsfw: boolean("is_nsfw").default(false).notNull(),
    // scene_count dropped by drizzle migration 0014 (see studios note).
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tags_name_idx").on(table.name),
    index("tags_favorite_idx").on(table.favorite),
    index("tags_rating_idx").on(table.rating),
  ]
);

export const tagsRelations = relations(tags, ({ many, one }) => ({
  performerTags: many(performerTags),
  galleryTags: many(galleryTags),
  imageTags: many(imageTags),
  audioLibraryTags: many(audioLibraryTags),
  audioTrackTags: many(audioTrackTags),
  parent: one(tags, { fields: [tags.parentId], references: [tags.id] }),
}));

// ─── Library Roots ────────────────────────────────────────────────
export const libraryRoots = pgTable(
  "library_roots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    path: text("path").notNull(),
    label: text("label").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    recursive: boolean("recursive").default(true).notNull(),
    // scan_videos retired in favor of scan_movies + scan_series.
    // The column is dropped by drizzle migration 0014; no code reads
    // it anymore. Kept out of this schema so SELECT * doesn't include
    // a column that may not exist on finalized installs.
    scanMovies: boolean("scan_movies").default(true).notNull(),
    scanSeries: boolean("scan_series").default(true).notNull(),
    scanImages: boolean("scan_images").default(true).notNull(),
    scanAudio: boolean("scan_audio").default(true).notNull(),
    isNsfw: boolean("is_nsfw").default(false).notNull(),
    lastScannedAt: timestamp("last_scanned_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("library_roots_path_idx").on(table.path)]
);

// ─── Library Settings ─────────────────────────────────────────────
export const librarySettings = pgTable("library_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  autoScanEnabled: boolean("auto_scan_enabled").default(false).notNull(),
  scanIntervalMinutes: integer("scan_interval_minutes").default(60).notNull(),
  autoGenerateMetadata: boolean("auto_generate_metadata").default(true).notNull(),
  autoGenerateFingerprints: boolean("auto_generate_fingerprints").default(true).notNull(),
  /**
   * When true, the worker computes a Stash-compatible perceptual hash for each
   * scene as part of the fingerprint job. Default off because the phash pipeline
   * spawns ffmpeg 25 times per scene and is CPU-heavy. Required for contributing
   * fingerprints back to StashDB / ThePornDB.
   */
  generatePhash: boolean("generate_phash").default(false).notNull(),
  autoGeneratePreview: boolean("auto_generate_preview").default(true).notNull(),
  generateTrickplay: boolean("generate_trickplay").default(true).notNull(),
  trickplayIntervalSeconds: integer("trickplay_interval_seconds").default(10).notNull(),
  previewClipDurationSeconds: integer("preview_clip_duration_seconds").default(8).notNull(),
  thumbnailQuality: integer("thumbnail_quality").default(2).notNull(),
  trickplayQuality: integer("trickplay_quality").default(2).notNull(),
  backgroundWorkerConcurrency: integer("background_worker_concurrency").default(1).notNull(),
  nsfwLanAutoEnable: boolean("nsfw_lan_auto_enable").default(false).notNull(),
  // use_library_root_as_folder retired — the library root is never
  // treated as a folder in the new model. Drizzle migration 0016 drops
  // the column. No code reads it anymore.
  /** When true, scene thumbnails/previews/sprites/trickplay live under OBSCURA_CACHE_DIR; when false, beside the video file. */
  metadataStorageDedicated: boolean("metadata_storage_dedicated").default(true).notNull(),
  /** Subtitle defaults — see SubtitleAppearance / LibrarySettingsDto in @obscura/contracts. */
  subtitlesAutoEnable: boolean("subtitles_auto_enable").default(false).notNull(),
  subtitlesPreferredLanguages: text("subtitles_preferred_languages").default("en,eng").notNull(),
  subtitleStyle: text("subtitle_style").default("stylized").notNull(),
  subtitleFontScale: real("subtitle_font_scale").default(1).notNull(),
  subtitlePositionPercent: real("subtitle_position_percent").default(88).notNull(),
  subtitleOpacity: real("subtitle_opacity").default(1).notNull(),
  /** Default playback mode for the video player. "direct" streams the source file; "hls" uses the adaptive HLS pipeline. */
  defaultPlaybackMode: text("default_playback_mode").default("direct").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Job Runs ─────────────────────────────────────────────────────
export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    queueName: text("queue_name").notNull(),
    bullmqJobId: text("bullmq_job_id").notNull(),
    status: text("status").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    targetLabel: text("target_label"),
    progress: integer("progress").default(0).notNull(),
    attempts: integer("attempts").default(0).notNull(),
    payload: jsonb("payload"),
    error: text("error"),
    startedAt: timestamp("started_at"),
    finishedAt: timestamp("finished_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("job_runs_bullmq_job_id_idx").on(table.bullmqJobId),
    index("job_runs_queue_name_idx").on(table.queueName),
    index("job_runs_status_idx").on(table.status),
    index("job_runs_created_at_idx").on(table.createdAt),
  ]
);

// ─── Performer ↔ Tag join ───────────────────────────────────────────
export const performerTags = pgTable(
  "performer_tags",
  {
    performerId: uuid("performer_id")
      .notNull()
      .references(() => performers.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("performer_tags_pk").on(table.performerId, table.tagId),
    index("performer_tags_tag_idx").on(table.tagId),
  ]
);

export const performerTagsRelations = relations(performerTags, ({ one }) => ({
  performer: one(performers, {
    fields: [performerTags.performerId],
    references: [performers.id],
  }),
  tag: one(tags, {
    fields: [performerTags.tagId],
    references: [tags.id],
  }),
}));

// ─── Scraper Packages ───────────────────────────────────────────────
export const scraperPackages = pgTable(
  "scraper_packages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    packageId: text("package_id").notNull(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    installPath: text("install_path").notNull(),
    sha256: text("sha256"),
    capabilities: jsonb("capabilities").$type<Record<string, boolean>>(),
    enabled: boolean("enabled").default(true).notNull(),
    isNsfw: boolean("is_nsfw").default(true).notNull(),
    pluginType: text("plugin_type").default("stash-compat").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("scraper_packages_package_id_idx").on(table.packageId),
  ]
);

export const scraperPackagesRelations = relations(scraperPackages, ({ many }) => ({
  scrapeResults: many(scrapeResults),
}));

// ─── Stash-Box Endpoints ───────────────────────────────────────────
export const stashBoxEndpoints = pgTable(
  "stash_box_endpoints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    endpoint: text("endpoint").notNull(),
    apiKey: text("api_key").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("stash_box_endpoints_endpoint_idx").on(table.endpoint),
  ]
);

export const stashBoxEndpointsRelations = relations(stashBoxEndpoints, ({ many }) => ({
  scrapeResults: many(scrapeResults),
  stashIds: many(stashIds),
}));

// ─── Stash IDs (remote entity links) ─────────────────────────────────
export const stashIds = pgTable(
  "stash_ids",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: text("entity_type").notNull(), // "video" | "performer" | "studio" | "tag"
    entityId: uuid("entity_id").notNull(),
    stashBoxEndpointId: uuid("stash_box_endpoint_id")
      .notNull()
      .references(() => stashBoxEndpoints.id, { onDelete: "cascade" }),
    stashId: text("stash_id").notNull(), // remote ID on the StashBox instance
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("stash_ids_entity_endpoint_idx").on(
      table.entityType,
      table.entityId,
      table.stashBoxEndpointId,
    ),
    index("stash_ids_entity_idx").on(table.entityType, table.entityId),
    index("stash_ids_endpoint_idx").on(table.stashBoxEndpointId),
  ]
);

export const stashIdsRelations = relations(stashIds, ({ one }) => ({
  stashBoxEndpoint: one(stashBoxEndpoints, {
    fields: [stashIds.stashBoxEndpointId],
    references: [stashBoxEndpoints.id],
  }),
}));

// ─── Plugin Packages (Obscura-native plugins) ────────────────────────
export const pluginPackages = pgTable(
  "plugin_packages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pluginId: text("plugin_id").notNull(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    runtime: text("runtime").notNull(), // "python" | "typescript" | "stash-compat"
    installPath: text("install_path").notNull(),
    sha256: text("sha256"),
    isNsfw: boolean("is_nsfw").default(false).notNull(),
    capabilities: jsonb("capabilities").$type<Record<string, boolean>>(),
    manifestRaw: jsonb("manifest_raw"),
    enabled: boolean("enabled").default(true).notNull(),
    sourceIndex: text("source_index"), // "obscura-community" | "stash-community" | "local"
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("plugin_packages_plugin_id_idx").on(table.pluginId),
  ]
);

export const pluginPackagesRelations = relations(pluginPackages, ({ many }) => ({
  scrapeResults: many(scrapeResults),
  pluginAuth: many(pluginAuth),
}));

// ─── Plugin Auth (per-plugin credential storage) ──────────────────────
export const pluginAuth = pgTable(
  "plugin_auth",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pluginId: text("plugin_id").notNull(),
    authKey: text("auth_key").notNull(),
    encryptedValue: text("encrypted_value").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("plugin_auth_plugin_key_idx").on(table.pluginId, table.authKey),
    index("plugin_auth_plugin_idx").on(table.pluginId),
  ]
);

export const pluginAuthRelations = relations(pluginAuth, ({ one }) => ({
  pluginPackage: one(pluginPackages, {
    fields: [pluginAuth.pluginId],
    references: [pluginPackages.pluginId],
  }),
}));

// ─── External IDs (non-StashBox remote entity links) ──────────────────
export const externalIds = pgTable(
  "external_ids",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: text("entity_type").notNull(), // "video" | "video_series" | "gallery" | "audio_library" | "audio_track" | "image"
    entityId: uuid("entity_id").notNull(),
    provider: text("provider").notNull(), // "tvdb" | "tmdb" | "youtube" | "musicbrainz"
    externalId: text("external_id").notNull(),
    externalUrl: text("external_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("external_ids_entity_provider_idx").on(
      table.entityType,
      table.entityId,
      table.provider,
    ),
    index("external_ids_entity_idx").on(table.entityType, table.entityId),
    index("external_ids_provider_idx").on(table.provider),
  ]
);

// ─── Fingerprint Submissions (contribution history) ──────────────────
// One row per (scene, endpoint, algorithm, hash) that we have attempted to
// submit to a StashBox-protocol server via the `submitFingerprint` mutation.
// Used by the web pHashes tab to render per-scene submission state and to
// avoid re-submitting an identical hash on every click.
export const fingerprintSubmissions = pgTable(
  "fingerprint_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Legacy nullable scene id. No longer written; kept as a nullable
    // column so existing rows from pre-videos installs still load.
    sceneId: uuid("scene_id"),
    entityType: text("entity_type"), // "video_episode" | "video_movie"
    entityId: uuid("entity_id"),
    stashBoxEndpointId: uuid("stash_box_endpoint_id")
      .notNull()
      .references(() => stashBoxEndpoints.id, { onDelete: "cascade" }),
    algorithm: text("algorithm").notNull(), // "MD5" | "OSHASH" | "PHASH"
    hash: text("hash").notNull(),
    status: text("status").notNull(), // "success" | "error"
    error: text("error"),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("fingerprint_submissions_unique").on(
      table.sceneId,
      table.stashBoxEndpointId,
      table.algorithm,
      table.hash,
    ),
    index("fingerprint_submissions_scene_idx").on(table.sceneId),
    index("fingerprint_submissions_entity_idx").on(
      table.entityType,
      table.entityId,
    ),
    index("fingerprint_submissions_endpoint_idx").on(table.stashBoxEndpointId),
  ],
);

export const fingerprintSubmissionsRelations = relations(
  fingerprintSubmissions,
  ({ one }) => ({
    stashBoxEndpoint: one(stashBoxEndpoints, {
      fields: [fingerprintSubmissions.stashBoxEndpointId],
      references: [stashBoxEndpoints.id],
    }),
  }),
);

// ─── Scrape Results ─────────────────────────────────────────────────
export const scrapeResults = pgTable(
  "scrape_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Legacy nullable scene id. No longer written; kept nullable so
    // existing rows from pre-videos installs still load.
    sceneId: uuid("scene_id"),
    // Generic entity reference
    entityType: text("entity_type").notNull().default("video"),
    entityId: uuid("entity_id"),
    // Source: one of scraper, stashbox, or plugin
    scraperPackageId: uuid("scraper_package_id")
      .references(() => scraperPackages.id, { onDelete: "set null" }),
    stashBoxEndpointId: uuid("stash_box_endpoint_id")
      .references(() => stashBoxEndpoints.id, { onDelete: "set null" }),
    pluginPackageId: uuid("plugin_package_id")
      .references(() => pluginPackages.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    matchType: text("match_type"),
    status: text("status").notNull().default("pending"),
    rawResult: jsonb("raw_result"),
    proposedResult: jsonb("proposed_result").$type<Record<string, unknown>>(),
    cascadeParentId: uuid("cascade_parent_id"),
    // Common proposed fields (scene-compatible)
    proposedTitle: text("proposed_title"),
    proposedDate: text("proposed_date"),
    proposedDetails: text("proposed_details"),
    proposedUrl: text("proposed_url"),
    proposedUrls: jsonb("proposed_urls").$type<string[]>(),
    proposedStudioName: text("proposed_studio_name"),
    proposedPerformerNames: jsonb("proposed_performer_names").$type<string[]>(),
    proposedTagNames: jsonb("proposed_tag_names").$type<string[]>(),
    proposedImageUrl: text("proposed_image_url"),
    // Video-specific
    proposedEpisodeNumber: integer("proposed_episode_number"),
    // Folder-specific (full result blob for series data)
    proposedFolderResult: jsonb("proposed_folder_result"),
    // Audio-specific (artist, album, track info)
    proposedAudioResult: jsonb("proposed_audio_result"),
    appliedAt: timestamp("applied_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("scrape_results_scene_idx").on(table.sceneId),
    index("scrape_results_entity_idx").on(table.entityType, table.entityId),
    index("scrape_results_status_idx").on(table.status),
    index("scrape_results_created_at_idx").on(table.createdAt),
  ]
);

export const scrapeResultsRelations = relations(scrapeResults, ({ one }) => ({
  scraperPackage: one(scraperPackages, {
    fields: [scrapeResults.scraperPackageId],
    references: [scraperPackages.id],
  }),
  stashBoxEndpoint: one(stashBoxEndpoints, {
    fields: [scrapeResults.stashBoxEndpointId],
    references: [stashBoxEndpoints.id],
  }),
  pluginPackage: one(pluginPackages, {
    fields: [scrapeResults.pluginPackageId],
    references: [pluginPackages.id],
  }),
}));

// ─── Galleries ─────────────────────────────────────────────────────
export const galleries = pgTable(
  "galleries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    details: text("details"),
    date: text("date"),
    rating: integer("rating"),
    organized: boolean("organized").default(false).notNull(),
    isNsfw: boolean("is_nsfw").default(false).notNull(),
    urls: jsonb("urls").$type<string[]>().default([]).notNull(),
    photographer: text("photographer"),

    // Gallery type discriminator: "folder" | "zip" | "virtual"
    galleryType: text("gallery_type").notNull().default("virtual"),

    // Folder-based galleries
    folderPath: text("folder_path"),

    // Zip-based galleries (.zip/.cbz/.cbr)
    zipFilePath: text("zip_file_path"),

    // Hierarchy (sub-galleries)
    parentId: uuid("parent_id").references(/* drizzle requires any for self-referential FKs */ (): any => galleries.id),

    // Explicit cover image (plain UUID — no FK to avoid circular dep with images)
    coverImageId: uuid("cover_image_id"),

    // Denormalized count
    imageCount: integer("image_count").default(0).notNull(),

    // Relations
    studioId: uuid("studio_id").references(() => studios.id),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("galleries_studio_idx").on(table.studioId),
    index("galleries_parent_idx").on(table.parentId),
    index("galleries_type_idx").on(table.galleryType),
    index("galleries_date_idx").on(table.date),
    index("galleries_rating_idx").on(table.rating),
    index("galleries_created_at_idx").on(table.createdAt),
    index("galleries_folder_path_idx").on(table.folderPath),
    index("galleries_zip_path_idx").on(table.zipFilePath),
  ]
);

export const galleriesRelations = relations(galleries, ({ one, many }) => ({
  studio: one(studios, { fields: [galleries.studioId], references: [studios.id] }),
  parent: one(galleries, { fields: [galleries.parentId], references: [galleries.id] }),
  children: many(galleries),
  galleryPerformers: many(galleryPerformers),
  galleryTags: many(galleryTags),
  chapters: many(galleryChapters),
  images: many(images),
}));

// ─── Images ────────────────────────────────────────────────────────
export const images = pgTable(
  "images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    details: text("details"),
    date: text("date"),
    rating: integer("rating"),
    organized: boolean("organized").default(false).notNull(),
    isNsfw: boolean("is_nsfw").default(false).notNull(),
    urls: jsonb("urls").$type<string[]>().default([]).notNull(),

    // File info — for zip members: "/path/archive.cbz::member/file.jpg"
    filePath: text("file_path").notNull(),
    fileSize: real("file_size"),
    width: integer("width"),
    height: integer("height"),
    format: text("format"),

    // Generated thumbnail (cache dir)
    thumbnailPath: text("thumbnail_path"),

    // Fingerprints
    checksumMd5: text("checksum_md5"),
    oshash: text("oshash"),

    // Gallery membership
    galleryId: uuid("gallery_id").references(() => galleries.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").default(0).notNull(),

    // Relations
    studioId: uuid("studio_id").references(() => studios.id),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("images_file_path_idx").on(table.filePath),
    index("images_gallery_idx").on(table.galleryId),
    index("images_gallery_sort_idx").on(table.galleryId, table.sortOrder),
    index("images_studio_idx").on(table.studioId),
    index("images_rating_idx").on(table.rating),
    index("images_created_at_idx").on(table.createdAt),
  ]
);

export const imagesRelations = relations(images, ({ one, many }) => ({
  gallery: one(galleries, { fields: [images.galleryId], references: [galleries.id] }),
  studio: one(studios, { fields: [images.studioId], references: [studios.id] }),
  imagePerformers: many(imagePerformers),
  imageTags: many(imageTags),
}));

// ─── Gallery Chapters ──────────────────────────────────────────────
export const galleryChapters = pgTable(
  "gallery_chapters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    galleryId: uuid("gallery_id")
      .notNull()
      .references(() => galleries.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    imageIndex: integer("image_index").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("gallery_chapters_gallery_idx").on(table.galleryId),
  ]
);

export const galleryChaptersRelations = relations(galleryChapters, ({ one }) => ({
  gallery: one(galleries, {
    fields: [galleryChapters.galleryId],
    references: [galleries.id],
  }),
}));

// ─── Gallery ↔ Performer join ──────────────────────────────────────
export const galleryPerformers = pgTable(
  "gallery_performers",
  {
    galleryId: uuid("gallery_id")
      .notNull()
      .references(() => galleries.id, { onDelete: "cascade" }),
    performerId: uuid("performer_id")
      .notNull()
      .references(() => performers.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("gallery_performers_pk").on(table.galleryId, table.performerId),
    index("gallery_performers_performer_idx").on(table.performerId),
  ]
);

export const galleryPerformersRelations = relations(galleryPerformers, ({ one }) => ({
  gallery: one(galleries, {
    fields: [galleryPerformers.galleryId],
    references: [galleries.id],
  }),
  performer: one(performers, {
    fields: [galleryPerformers.performerId],
    references: [performers.id],
  }),
}));

// ─── Gallery ↔ Tag join ────────────────────────────────────────────
export const galleryTags = pgTable(
  "gallery_tags",
  {
    galleryId: uuid("gallery_id")
      .notNull()
      .references(() => galleries.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("gallery_tags_pk").on(table.galleryId, table.tagId),
    index("gallery_tags_tag_idx").on(table.tagId),
  ]
);

export const galleryTagsRelations = relations(galleryTags, ({ one }) => ({
  gallery: one(galleries, {
    fields: [galleryTags.galleryId],
    references: [galleries.id],
  }),
  tag: one(tags, {
    fields: [galleryTags.tagId],
    references: [tags.id],
  }),
}));

// ─── Image ↔ Performer join ───────────────────────────────────────
export const imagePerformers = pgTable(
  "image_performers",
  {
    imageId: uuid("image_id")
      .notNull()
      .references(() => images.id, { onDelete: "cascade" }),
    performerId: uuid("performer_id")
      .notNull()
      .references(() => performers.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("image_performers_pk").on(table.imageId, table.performerId),
    index("image_performers_performer_idx").on(table.performerId),
  ]
);

export const imagePerformersRelations = relations(imagePerformers, ({ one }) => ({
  image: one(images, {
    fields: [imagePerformers.imageId],
    references: [images.id],
  }),
  performer: one(performers, {
    fields: [imagePerformers.performerId],
    references: [performers.id],
  }),
}));

// ─── Image ↔ Tag join ─────────────────────────────────────────────
export const imageTags = pgTable(
  "image_tags",
  {
    imageId: uuid("image_id")
      .notNull()
      .references(() => images.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("image_tags_pk").on(table.imageId, table.tagId),
    index("image_tags_tag_idx").on(table.tagId),
  ]
);

export const imageTagsRelations = relations(imageTags, ({ one }) => ({
  image: one(images, {
    fields: [imageTags.imageId],
    references: [images.id],
  }),
  tag: one(tags, {
    fields: [imageTags.tagId],
    references: [tags.id],
  }),
}));

// ─── Audio Libraries ──────────────────────────────────────────────
export const audioLibraries = pgTable(
  "audio_libraries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    details: text("details"),
    date: text("date"),
    rating: integer("rating"),
    organized: boolean("organized").default(false).notNull(),
    isNsfw: boolean("is_nsfw").default(false).notNull(),
    urls: jsonb("urls").$type<string[]>().default([]).notNull(),

    // Folder on disk
    folderPath: text("folder_path"),

    // Hierarchy
    parentId: uuid("parent_id").references(/* drizzle requires any for self-referential FKs */ (): any => audioLibraries.id),

    // User-uploaded media (cache dir paths)
    coverImagePath: text("cover_image_path"),
    iconPath: text("icon_path"),

    // Denormalized count
    trackCount: integer("track_count").default(0).notNull(),

    // Relations
    studioId: uuid("studio_id").references(() => studios.id),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("audio_libraries_parent_idx").on(table.parentId),
    uniqueIndex("audio_libraries_folder_path_idx").on(table.folderPath),
    index("audio_libraries_rating_idx").on(table.rating),
    index("audio_libraries_created_at_idx").on(table.createdAt),
    index("audio_libraries_studio_idx").on(table.studioId),
  ]
);

export const audioLibrariesRelations = relations(audioLibraries, ({ one, many }) => ({
  studio: one(studios, { fields: [audioLibraries.studioId], references: [studios.id] }),
  parent: one(audioLibraries, { fields: [audioLibraries.parentId], references: [audioLibraries.id] }),
  children: many(audioLibraries),
  audioTracks: many(audioTracks),
  audioLibraryPerformers: many(audioLibraryPerformers),
  audioLibraryTags: many(audioLibraryTags),
}));

// ─── Audio Tracks ─────────────────────────────────────────────────
export const audioTracks = pgTable(
  "audio_tracks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    details: text("details"),
    date: text("date"),
    rating: integer("rating"),
    organized: boolean("organized").default(false).notNull(),
    isNsfw: boolean("is_nsfw").default(false).notNull(),
    urls: jsonb("urls").$type<string[]>().default([]).notNull(),

    // File info
    filePath: text("file_path").notNull(),
    fileSize: real("file_size"),
    duration: real("duration"),
    bitRate: integer("bit_rate"),
    sampleRate: integer("sample_rate"),
    channels: integer("channels"),
    codec: text("codec"),
    container: text("container"),

    // Embedded tags from file (ID3, Vorbis comments, etc.)
    embeddedArtist: text("embedded_artist"),
    embeddedAlbum: text("embedded_album"),
    trackNumber: integer("track_number"),

    // Fingerprints
    checksumMd5: text("checksum_md5"),
    oshash: text("oshash"),

    // Waveform peaks data (cache dir path to JSON file)
    waveformPath: text("waveform_path"),

    // Playback tracking
    playCount: integer("play_count").default(0).notNull(),
    playDuration: real("play_duration").default(0).notNull(),
    resumeTime: real("resume_time").default(0).notNull(),
    lastPlayedAt: timestamp("last_played_at"),

    // Library membership
    libraryId: uuid("library_id").references(() => audioLibraries.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").default(0).notNull(),

    // Relations
    studioId: uuid("studio_id").references(() => studios.id),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("audio_tracks_file_path_idx").on(table.filePath),
    index("audio_tracks_library_idx").on(table.libraryId),
    index("audio_tracks_library_sort_idx").on(table.libraryId, table.sortOrder),
    index("audio_tracks_studio_idx").on(table.studioId),
    index("audio_tracks_rating_idx").on(table.rating),
    index("audio_tracks_created_at_idx").on(table.createdAt),
  ]
);

export const audioTracksRelations = relations(audioTracks, ({ one, many }) => ({
  library: one(audioLibraries, { fields: [audioTracks.libraryId], references: [audioLibraries.id] }),
  studio: one(studios, { fields: [audioTracks.studioId], references: [studios.id] }),
  audioTrackPerformers: many(audioTrackPerformers),
  audioTrackTags: many(audioTrackTags),
  markers: many(audioTrackMarkers),
}));

// ─── Audio Track Markers ──────────────────────────────────────────
export const audioTrackMarkers = pgTable(
  "audio_track_markers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => audioTracks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    seconds: real("seconds").notNull(),
    endSeconds: real("end_seconds"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("audio_track_markers_track_idx").on(table.trackId),
  ]
);

export const audioTrackMarkersRelations = relations(audioTrackMarkers, ({ one }) => ({
  track: one(audioTracks, {
    fields: [audioTrackMarkers.trackId],
    references: [audioTracks.id],
  }),
}));

// ─── Audio Library ↔ Performer join ───────────────────────────────
export const audioLibraryPerformers = pgTable(
  "audio_library_performers",
  {
    libraryId: uuid("library_id")
      .notNull()
      .references(() => audioLibraries.id, { onDelete: "cascade" }),
    performerId: uuid("performer_id")
      .notNull()
      .references(() => performers.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("audio_library_performers_pk").on(table.libraryId, table.performerId),
    index("audio_library_performers_performer_idx").on(table.performerId),
  ]
);

export const audioLibraryPerformersRelations = relations(audioLibraryPerformers, ({ one }) => ({
  library: one(audioLibraries, {
    fields: [audioLibraryPerformers.libraryId],
    references: [audioLibraries.id],
  }),
  performer: one(performers, {
    fields: [audioLibraryPerformers.performerId],
    references: [performers.id],
  }),
}));

// ─── Audio Library ↔ Tag join ─────────────────────────────────────
export const audioLibraryTags = pgTable(
  "audio_library_tags",
  {
    libraryId: uuid("library_id")
      .notNull()
      .references(() => audioLibraries.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("audio_library_tags_pk").on(table.libraryId, table.tagId),
    index("audio_library_tags_tag_idx").on(table.tagId),
  ]
);

export const audioLibraryTagsRelations = relations(audioLibraryTags, ({ one }) => ({
  library: one(audioLibraries, {
    fields: [audioLibraryTags.libraryId],
    references: [audioLibraries.id],
  }),
  tag: one(tags, {
    fields: [audioLibraryTags.tagId],
    references: [tags.id],
  }),
}));

// ─── Audio Track ↔ Performer join ─────────────────────────────────
export const audioTrackPerformers = pgTable(
  "audio_track_performers",
  {
    trackId: uuid("track_id")
      .notNull()
      .references(() => audioTracks.id, { onDelete: "cascade" }),
    performerId: uuid("performer_id")
      .notNull()
      .references(() => performers.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("audio_track_performers_pk").on(table.trackId, table.performerId),
    index("audio_track_performers_performer_idx").on(table.performerId),
  ]
);

export const audioTrackPerformersRelations = relations(audioTrackPerformers, ({ one }) => ({
  track: one(audioTracks, {
    fields: [audioTrackPerformers.trackId],
    references: [audioTracks.id],
  }),
  performer: one(performers, {
    fields: [audioTrackPerformers.performerId],
    references: [performers.id],
  }),
}));

// ─── Audio Track ↔ Tag join ───────────────────────────────────────
export const audioTrackTags = pgTable(
  "audio_track_tags",
  {
    trackId: uuid("track_id")
      .notNull()
      .references(() => audioTracks.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("audio_track_tags_pk").on(table.trackId, table.tagId),
    index("audio_track_tags_tag_idx").on(table.tagId),
  ]
);

export const audioTrackTagsRelations = relations(audioTrackTags, ({ one }) => ({
  track: one(audioTracks, {
    fields: [audioTrackTags.trackId],
    references: [audioTracks.id],
  }),
  tag: one(tags, {
    fields: [audioTrackTags.tagId],
    references: [tags.id],
  }),
}));

// ─── Collections ───────────────────────────────────────────────────
export const collections = pgTable(
  "collections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    mode: text("mode").notNull().default("manual"), // "manual" | "dynamic" | "hybrid"
    ruleTree: jsonb("rule_tree"),
    itemCount: integer("item_count").default(0).notNull(),
    coverMode: text("cover_mode").notNull().default("mosaic"), // "mosaic" | "custom" | "item"
    coverImagePath: text("cover_image_path"),
    coverItemId: uuid("cover_item_id"),
    coverItemType: text("cover_item_type"),
    slideshowDurationSeconds: integer("slideshow_duration_seconds")
      .default(5)
      .notNull(),
    slideshowAutoAdvance: boolean("slideshow_auto_advance")
      .default(true)
      .notNull(),
    lastRefreshedAt: timestamp("last_refreshed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("collections_name_idx").on(table.name),
    index("collections_mode_idx").on(table.mode),
    index("collections_created_at_idx").on(table.createdAt),
  ]
);

export const collectionsRelations = relations(collections, ({ many }) => ({
  items: many(collectionItems),
}));

// ─── Collection Items ──────────────────────────────────────────────
export const collectionItems = pgTable(
  "collection_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(), // "video" | "gallery" | "image" | "audio-track"
    entityId: uuid("entity_id").notNull(),
    source: text("source").notNull().default("manual"), // "manual" | "dynamic"
    sortOrder: integer("sort_order").default(0).notNull(),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("collection_items_unique").on(
      table.collectionId,
      table.entityType,
      table.entityId
    ),
    index("collection_items_collection_idx").on(table.collectionId),
    index("collection_items_entity_idx").on(table.entityType, table.entityId),
    index("collection_items_sort_idx").on(table.collectionId, table.sortOrder),
  ]
);

export const collectionItemsRelations = relations(
  collectionItems,
  ({ one }) => ({
    collection: one(collections, {
      fields: [collectionItems.collectionId],
      references: [collections.id],
    }),
  })
);

// ─── Video Series Model ─────────────────────────────────────────────
// Typed tables for the Series → Season → Episode / Movie reshape.

export const videoSeries = pgTable(
  "video_series",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    libraryRootId: uuid("library_root_id")
      .references(() => libraryRoots.id, { onDelete: "cascade" })
      .notNull(),
    folderPath: text("folder_path").notNull(),
    relativePath: text("relative_path").notNull(),
    title: text("title").notNull(),
    /**
     * User-overridden display name. When non-null, UI components show
     * `customName` instead of `title`. Persists across scans so a
     * manual rename survives re-discovery and metadata scrape accepts.
     */
    customName: text("custom_name"),
    sortTitle: text("sort_title"),
    originalTitle: text("original_title"),
    overview: text("overview"),
    tagline: text("tagline"),
    status: text("status"),
    firstAirDate: text("first_air_date"),
    endAirDate: text("end_air_date"),
    posterPath: text("poster_path"),
    backdropPath: text("backdrop_path"),
    logoPath: text("logo_path"),
    studioId: uuid("studio_id").references(() => studios.id, {
      onDelete: "set null",
    }),
    rating: integer("rating"),
    contentRating: text("content_rating"),
    isNsfw: boolean("is_nsfw").default(false).notNull(),
    organized: boolean("organized").default(false).notNull(),
    externalIds: jsonb("external_ids")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("video_series_folder_path_idx").on(table.folderPath),
    index("video_series_library_root_idx").on(table.libraryRootId),
    index("video_series_studio_idx").on(table.studioId),
    index("video_series_is_nsfw_idx").on(table.isNsfw),
  ],
);

export const videoSeasons = pgTable(
  "video_seasons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seriesId: uuid("series_id")
      .references(() => videoSeries.id, { onDelete: "cascade" })
      .notNull(),
    seasonNumber: integer("season_number").notNull(),
    folderPath: text("folder_path"),
    title: text("title"),
    overview: text("overview"),
    posterPath: text("poster_path"),
    airDate: text("air_date"),
    externalIds: jsonb("external_ids")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("video_seasons_series_season_idx").on(
      table.seriesId,
      table.seasonNumber,
    ),
    index("video_seasons_series_idx").on(table.seriesId),
  ],
);

export const videoEpisodes = pgTable(
  "video_episodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seasonId: uuid("season_id")
      .references(() => videoSeasons.id, { onDelete: "cascade" })
      .notNull(),
    seriesId: uuid("series_id")
      .references(() => videoSeries.id, { onDelete: "cascade" })
      .notNull(),
    seasonNumber: integer("season_number").notNull(),
    episodeNumber: integer("episode_number"),
    absoluteEpisodeNumber: integer("absolute_episode_number"),
    title: text("title"),
    overview: text("overview"),
    airDate: text("air_date"),
    stillPath: text("still_path"),
    runtime: integer("runtime"),
    externalIds: jsonb("external_ids")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    filePath: text("file_path").notNull(),
    fileSize: real("file_size"),
    duration: real("duration"),
    width: integer("width"),
    height: integer("height"),
    frameRate: real("frame_rate"),
    bitRate: integer("bit_rate"),
    codec: text("codec"),
    container: text("container"),
    checksumMd5: text("checksum_md5"),
    oshash: text("oshash"),
    phash: text("phash"),
    thumbnailPath: text("thumbnail_path"),
    cardThumbnailPath: text("card_thumbnail_path"),
    previewPath: text("preview_path"),
    spritePath: text("sprite_path"),
    trickplayVttPath: text("trickplay_vtt_path"),
    playCount: integer("play_count").default(0).notNull(),
    orgasmCount: integer("orgasm_count").default(0).notNull(),
    playDuration: real("play_duration").default(0).notNull(),
    resumeTime: real("resume_time").default(0).notNull(),
    lastPlayedAt: timestamp("last_played_at"),
    rating: integer("rating"),
    isNsfw: boolean("is_nsfw").default(false).notNull(),
    organized: boolean("organized").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("video_episodes_file_path_idx").on(table.filePath),
    index("video_episodes_season_idx").on(table.seasonId),
    index("video_episodes_series_idx").on(table.seriesId),
    index("video_episodes_is_nsfw_idx").on(table.isNsfw),
  ],
);

export const videoMovies = pgTable(
  "video_movies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    libraryRootId: uuid("library_root_id")
      .references(() => libraryRoots.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    sortTitle: text("sort_title"),
    originalTitle: text("original_title"),
    overview: text("overview"),
    tagline: text("tagline"),
    releaseDate: text("release_date"),
    runtime: integer("runtime"),
    posterPath: text("poster_path"),
    backdropPath: text("backdrop_path"),
    logoPath: text("logo_path"),
    studioId: uuid("studio_id").references(() => studios.id, {
      onDelete: "set null",
    }),
    rating: integer("rating"),
    contentRating: text("content_rating"),
    isNsfw: boolean("is_nsfw").default(false).notNull(),
    organized: boolean("organized").default(false).notNull(),
    externalIds: jsonb("external_ids")
      .$type<Record<string, string>>()
      .default({})
      .notNull(),
    filePath: text("file_path").notNull(),
    fileSize: real("file_size"),
    duration: real("duration"),
    width: integer("width"),
    height: integer("height"),
    frameRate: real("frame_rate"),
    bitRate: integer("bit_rate"),
    codec: text("codec"),
    container: text("container"),
    checksumMd5: text("checksum_md5"),
    oshash: text("oshash"),
    phash: text("phash"),
    thumbnailPath: text("thumbnail_path"),
    cardThumbnailPath: text("card_thumbnail_path"),
    previewPath: text("preview_path"),
    spritePath: text("sprite_path"),
    trickplayVttPath: text("trickplay_vtt_path"),
    playCount: integer("play_count").default(0).notNull(),
    orgasmCount: integer("orgasm_count").default(0).notNull(),
    playDuration: real("play_duration").default(0).notNull(),
    resumeTime: real("resume_time").default(0).notNull(),
    lastPlayedAt: timestamp("last_played_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("video_movies_file_path_idx").on(table.filePath),
    index("video_movies_library_root_idx").on(table.libraryRootId),
    index("video_movies_studio_idx").on(table.studioId),
    index("video_movies_is_nsfw_idx").on(table.isNsfw),
  ],
);

export const videoMoviePerformers = pgTable(
  "video_movie_performers",
  {
    movieId: uuid("movie_id")
      .references(() => videoMovies.id, { onDelete: "cascade" })
      .notNull(),
    performerId: uuid("performer_id")
      .references(() => performers.id, { onDelete: "cascade" })
      .notNull(),
    character: text("character"),
    order: integer("order"),
  },
  (table) => [
    uniqueIndex("video_movie_performers_pk").on(
      table.movieId,
      table.performerId,
    ),
    index("video_movie_performers_performer_idx").on(table.performerId),
  ],
);

export const videoMovieTags = pgTable(
  "video_movie_tags",
  {
    movieId: uuid("movie_id")
      .references(() => videoMovies.id, { onDelete: "cascade" })
      .notNull(),
    tagId: uuid("tag_id")
      .references(() => tags.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [
    uniqueIndex("video_movie_tags_pk").on(table.movieId, table.tagId),
    index("video_movie_tags_tag_idx").on(table.tagId),
  ],
);

export const videoSeriesPerformers = pgTable(
  "video_series_performers",
  {
    seriesId: uuid("series_id")
      .references(() => videoSeries.id, { onDelete: "cascade" })
      .notNull(),
    performerId: uuid("performer_id")
      .references(() => performers.id, { onDelete: "cascade" })
      .notNull(),
    character: text("character"),
    order: integer("order"),
  },
  (table) => [
    uniqueIndex("video_series_performers_pk").on(
      table.seriesId,
      table.performerId,
    ),
    index("video_series_performers_performer_idx").on(table.performerId),
  ],
);

export const videoSeriesTags = pgTable(
  "video_series_tags",
  {
    seriesId: uuid("series_id")
      .references(() => videoSeries.id, { onDelete: "cascade" })
      .notNull(),
    tagId: uuid("tag_id")
      .references(() => tags.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [
    uniqueIndex("video_series_tags_pk").on(table.seriesId, table.tagId),
    index("video_series_tags_tag_idx").on(table.tagId),
  ],
);

export const videoEpisodePerformers = pgTable(
  "video_episode_performers",
  {
    episodeId: uuid("episode_id")
      .references(() => videoEpisodes.id, { onDelete: "cascade" })
      .notNull(),
    performerId: uuid("performer_id")
      .references(() => performers.id, { onDelete: "cascade" })
      .notNull(),
    character: text("character"),
    order: integer("order"),
  },
  (table) => [
    uniqueIndex("video_episode_performers_pk").on(
      table.episodeId,
      table.performerId,
    ),
    index("video_episode_performers_performer_idx").on(table.performerId),
  ],
);

export const videoEpisodeTags = pgTable(
  "video_episode_tags",
  {
    episodeId: uuid("episode_id")
      .references(() => videoEpisodes.id, { onDelete: "cascade" })
      .notNull(),
    tagId: uuid("tag_id")
      .references(() => tags.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [
    uniqueIndex("video_episode_tags_pk").on(table.episodeId, table.tagId),
    index("video_episode_tags_tag_idx").on(table.tagId),
  ],
);

/**
 * Polymorphic subtitle store for the video model. Each row belongs to
 * either a video_episode or a video_movie — the discriminator is
 * `entity_type`. There's no FK to the underlying table; the video-scene
 * service cleans up on delete.
 */
export const videoSubtitles = pgTable(
  "video_subtitles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: text("entity_type").notNull(), // "video_episode" | "video_movie"
    entityId: uuid("entity_id").notNull(),
    language: text("language").notNull(),
    label: text("label"),
    format: text("format").notNull(),
    source: text("source").notNull(),
    storagePath: text("storage_path").notNull(),
    sourceFormat: text("source_format").notNull().default("vtt"),
    sourcePath: text("source_path"),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("video_subtitles_entity_idx").on(table.entityType, table.entityId),
    uniqueIndex("video_subtitles_entity_lang_source_idx").on(
      table.entityType,
      table.entityId,
      table.language,
      table.source,
    ),
  ],
);

/**
 * Polymorphic marker store for the new video model. Same pattern as
 * video_subtitles: discriminator column, no FK. Replaces the legacy
 * `scene_markers` table.
 */
export const videoMarkers = pgTable(
  "video_markers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: text("entity_type").notNull(), // "video_episode" | "video_movie"
    entityId: uuid("entity_id").notNull(),
    title: text("title").notNull(),
    seconds: real("seconds").notNull(),
    endSeconds: real("end_seconds"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("video_markers_entity_idx").on(table.entityType, table.entityId),
  ],
);
