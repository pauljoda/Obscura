// Public surface of @obscura/app-core. Internal helpers
// (appearance-count-expressions, hierarchy, library-root-visibility,
// media-query-helpers, media-shared, upload-utils) are deliberately
// not re-exported — they are SQL/upload primitives meant for use
// inside this package only.

export * from "./breaking-gate";
export * from "./changelog";
export * from "./collections";
export * from "./errors";
export * from "./hls";
export * from "./hls-virtual";
export * from "./image-media";
export * from "./jobs-reads";
export * from "./jobs-writes";
export * from "./library-browse";
export * from "./library-config";
export * from "./library-root-nsfw-sync";
export * from "./library-roots-crud";
export * from "./library-settings-writes";
export * from "./media-file-ignores";
export * from "./gallery-media";
export * from "./books";
export * from "./audio-libraries";
export * from "./audio-tracks";
export * from "./network";
export * from "./performer-reads";
export * from "./performer-writes";
export * from "./plugin-execution";
export * from "./plugin-packages";
export * from "./plugin-registry";
export * from "./playlist-session";
export * from "./provider-lists";
export * from "./queue-writes";
export * from "./release-check";
export * from "./search";
export * from "./studio-reads";
export * from "./studio-writes";
export * from "./stashbox-runtime";
export * from "./tag-reads";
export * from "./tag-writes";
export * from "./ui-prefs";
export * from "./video-markers";
export * from "./video-collection-reads";
export * from "./video-core";
export * from "./video-playback";
export * from "./video-previews";
export * from "./video-scrape-accept";
export * from "./video-series";
export * from "./video-subtitles";
