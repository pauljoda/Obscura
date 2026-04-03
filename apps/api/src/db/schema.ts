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
  parent: one(studios, { fields: [studios.parentId], references: [studios.id] }),
}));

// ─── Performers ─────────────────────────────────────────────────────
export const performers = pgTable("performers", {
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
  favorite: boolean("favorite").default(false).notNull(),
  rating: integer("rating"),
  sceneCount: integer("scene_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const performersRelations = relations(performers, ({ many }) => ({
  scenePerformers: many(scenePerformers),
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
  parent: one(tags, { fields: [tags.parentId], references: [tags.id] }),
}));

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
    previewPath: text("preview_path"),
    spritePath: text("sprite_path"),

    // Fingerprints
    checksumMd5: text("checksum_md5"),
    oshash: text("oshash"),
    phash: text("phash"),

    // Playback tracking
    playCount: integer("play_count").default(0).notNull(),
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
