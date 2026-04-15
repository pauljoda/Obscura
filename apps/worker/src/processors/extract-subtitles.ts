import type { JobLike as Job } from "../lib/job-tracking.js";
import { markJobActive, markJobProgress } from "../lib/job-tracking.js";

/**
 * Subtitle extraction is paused between the videos-to-series cutover and
 * the APP-8 port of `scene_subtitles` onto the new video model. Nothing
 * enqueues jobs against this processor today, but the queue registration
 * is kept so in-flight jobs from before the cutover complete cleanly as
 * no-ops instead of crashing the worker.
 *
 * The processor will be re-implemented against `video_episode_subtitles`
 * / `video_movie_subtitles` when APP-8 lands.
 */
export async function processExtractSubtitles(job: Job) {
  await markJobActive(job, "extract-subtitles", {
    type: "system",
    id: "noop",
    label: "Subtitle extraction disabled (APP-8)",
  });
  await markJobProgress(job, "extract-subtitles", 100);
}
