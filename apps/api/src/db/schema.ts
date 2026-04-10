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
    parentId: uuid("parent_id").references((): any => studios.id),
    imageUrl: text("image_url"),
    imagePath: text("image_path"),
    favorite: boolean("favorite").default(false).notNull(),
    rating: integer("rating"),
    isNsfw: boolean("is_nsfw").default(false).notNull(),
    sceneCount: integer("scene_count").default(0).notNull(),
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
  scenes: many(scenes),
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
    sceneCount: integer("scene_count").default(0).notNull(),
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
  scenePerformers: many(scenePerformers),
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
    parentId: uuid("parent_id").references((): any => tags.id),
    favorite: boolean("favorite").default(false).notNull(),
    ignoreAutoTag: boolean("ignore_auto_tag").default(false).notNull(),
    imageUrl: text("image_url"),
    imagePath: text("image_path"),
    rating: integer("rating"),
    isNsfw: boolean("is_nsfw").default(false).notNull(),
    sceneCount: integer("scene_count").default(0).notNull(),
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
  sceneTags: many(sceneTags),
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
    scanVideos: boolean("scan_videos").default(true).notNull(),
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
  autoGeneratePreview: boolean("auto_generate_preview").default(true).notNull(),
  generateTrickplay: boolean("generate_trickplay").default(true).notNull(),
  trickplayIntervalSeconds: integer("trickplay_interval_seconds").default(10).notNull(),
  previewClipDurationSeconds: integer("preview_clip_duration_seconds").default(8).notNull(),
  thumbnailQuality: integer("thumbnail_quality").default(2).notNull(),
  trickplayQuality: integer("trickplay_quality").default(2).notNull(),
  backgroundWorkerConcurrency: integer("background_worker_concurrency").default(1).notNull(),
  nsfwLanAutoEnable: boolean("nsfw_lan_auto_enable").default(false).notNull(),
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

// ─── Scenes ─────────────────────────────────────────────────────────
export const scenes = pgTable(
  "scenes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    details: text("details"),
    url: text("url"),
    date: text("date"),
    rating: integer("rating"),
    organized: boolean("organized").default(false).notNull(),
    isNsfw: boolean("is_nsfw").default(false).notNull(),
    interactive: boolean("interactive").default(false).notNull(),

    // File info
    filePath: text("file_path"),
    fileSize: real("file_size"),
    duration: real("duration"),
    width: integer("width"),
    height: integer("height"),
    frameRate: real("frame_rate"),
    bitRate: integer("bit_rate"),
    codec: text("codec"),
    container: text("container"),

    // Generated media paths
    thumbnailPath: text("thumbnail_path"),
    cardThumbnailPath: text("card_thumbnail_path"),
    previewPath: text("preview_path"),
    spritePath: text("sprite_path"),
    trickplayVttPath: text("trickplay_vtt_path"),

    // Fingerprints
    checksumMd5: text("checksum_md5"),
    oshash: text("oshash"),
    phash: text("phash"),

    // Playback tracking
    playCount: integer("play_count").default(0).notNull(),
    orgasmCount: integer("orgasm_count").default(0).notNull(),
    playDuration: real("play_duration").default(0).notNull(),
    resumeTime: real("resume_time").default(0).notNull(),
    lastPlayedAt: timestamp("last_played_at"),

    // Relations
    studioId: uuid("studio_id").references(() => studios.id),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("scenes_studio_idx").on(table.studioId),
    index("scenes_date_idx").on(table.date),
    index("scenes_rating_idx").on(table.rating),
    index("scenes_created_at_idx").on(table.createdAt),
  ]
);

export const scenesRelations = relations(scenes, ({ one, many }) => ({
  studio: one(studios, {
    fields: [scenes.studioId],
    references: [studios.id],
  }),
  scenePerformers: many(scenePerformers),
  sceneTags: many(sceneTags),
  markers: many(sceneMarkers),
}));

// ─── Scene ↔ Performer join ─────────────────────────────────────────
export const scenePerformers = pgTable(
  "scene_performers",
  {
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    performerId: uuid("performer_id")
      .notNull()
      .references(() => performers.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("scene_performers_pk").on(table.sceneId, table.performerId),
    index("scene_performers_performer_idx").on(table.performerId),
  ]
);

export const scenePerformersRelations = relations(
  scenePerformers,
  ({ one }) => ({
    scene: one(scenes, {
      fields: [scenePerformers.sceneId],
      references: [scenes.id],
    }),
    performer: one(performers, {
      fields: [scenePerformers.performerId],
      references: [performers.id],
    }),
  })
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

// ─── Scene ↔ Tag join ───────────────────────────────────────────────
export const sceneTags = pgTable(
  "scene_tags",
  {
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("scene_tags_pk").on(table.sceneId, table.tagId),
    index("scene_tags_tag_idx").on(table.tagId),
  ]
);

export const sceneTagsRelations = relations(sceneTags, ({ one }) => ({
  scene: one(scenes, {
    fields: [sceneTags.sceneId],
    references: [scenes.id],
  }),
  tag: one(tags, {
    fields: [sceneTags.tagId],
    references: [tags.id],
  }),
}));

// ─── Scene Markers ──────────────────────────────────────────────────
export const sceneMarkers = pgTable(
  "scene_markers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    seconds: real("seconds").notNull(),
    endSeconds: real("end_seconds"),
    primaryTagId: uuid("primary_tag_id").references(() => tags.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("scene_markers_scene_idx").on(table.sceneId),
  ]
);

export const sceneMarkersRelations = relations(sceneMarkers, ({ one }) => ({
  scene: one(scenes, {
    fields: [sceneMarkers.sceneId],
    references: [scenes.id],
  }),
  primaryTag: one(tags, {
    fields: [sceneMarkers.primaryTagId],
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
    entityType: text("entity_type").notNull(), // "scene" | "performer" | "studio" | "tag"
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

// ─── Scrape Results ─────────────────────────────────────────────────
export const scrapeResults = pgTable(
  "scrape_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    scraperPackageId: uuid("scraper_package_id")
      .references(() => scraperPackages.id, { onDelete: "set null" }),
    stashBoxEndpointId: uuid("stash_box_endpoint_id")
      .references(() => stashBoxEndpoints.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    matchType: text("match_type"),
    status: text("status").notNull().default("pending"),
    rawResult: jsonb("raw_result"),
    proposedTitle: text("proposed_title"),
    proposedDate: text("proposed_date"),
    proposedDetails: text("proposed_details"),
    proposedUrl: text("proposed_url"),
    proposedStudioName: text("proposed_studio_name"),
    proposedPerformerNames: jsonb("proposed_performer_names").$type<string[]>(),
    proposedTagNames: jsonb("proposed_tag_names").$type<string[]>(),
    proposedImageUrl: text("proposed_image_url"),
    appliedAt: timestamp("applied_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("scrape_results_scene_idx").on(table.sceneId),
    index("scrape_results_status_idx").on(table.status),
    index("scrape_results_created_at_idx").on(table.createdAt),
  ]
);

export const scrapeResultsRelations = relations(scrapeResults, ({ one }) => ({
  scene: one(scenes, {
    fields: [scrapeResults.sceneId],
    references: [scenes.id],
  }),
  scraperPackage: one(scraperPackages, {
    fields: [scrapeResults.scraperPackageId],
    references: [scraperPackages.id],
  }),
  stashBoxEndpoint: one(stashBoxEndpoints, {
    fields: [scrapeResults.stashBoxEndpointId],
    references: [stashBoxEndpoints.id],
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
    photographer: text("photographer"),

    // Gallery type discriminator: "folder" | "zip" | "virtual"
    galleryType: text("gallery_type").notNull().default("virtual"),

    // Folder-based galleries
    folderPath: text("folder_path"),

    // Zip-based galleries (.zip/.cbz/.cbr)
    zipFilePath: text("zip_file_path"),

    // Hierarchy (sub-galleries)
    parentId: uuid("parent_id").references((): any => galleries.id),

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

    // Folder on disk
    folderPath: text("folder_path"),

    // Hierarchy
    parentId: uuid("parent_id").references((): any => audioLibraries.id),

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
    primaryTagId: uuid("primary_tag_id").references(() => tags.id),
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
  primaryTag: one(tags, {
    fields: [audioTrackMarkers.primaryTagId],
    references: [tags.id],
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
