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
export const studios = pgTable("studios", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  url: text("url"),
  parentId: uuid("parent_id").references((): any => studios.id),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const studiosRelations = relations(studios, ({ many, one }) => ({
  scenes: many(scenes),
  galleries: many(galleries),
  images: many(images),
  parent: one(studios, { fields: [studios.parentId], references: [studios.id] }),
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
    sceneCount: integer("scene_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("tags_name_idx").on(table.name)]
);

export const tagsRelations = relations(tags, ({ many, one }) => ({
  sceneTags: many(sceneTags),
  performerTags: many(performerTags),
  galleryTags: many(galleryTags),
  imageTags: many(imageTags),
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
    action: text("action").notNull(),
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
