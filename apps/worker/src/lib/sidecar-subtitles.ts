/**
 * Sidecar subtitle ingestion is paused between the videos-to-series
 * cutover and the APP-8 port of `scene_subtitles` onto the new video
 * model. This stub exists so the module is still importable; nothing
 * currently calls it, and the tests that cover subtitle sidecars will
 * come back online when APP-8 implements the new tables and wiring.
 */
export async function ingestSidecarSubtitlesForVideoEntity(
  _entityKind: "video_episode" | "video_movie",
  _entityId: string,
  _videoFilePath: string,
): Promise<number> {
  return 0;
}
