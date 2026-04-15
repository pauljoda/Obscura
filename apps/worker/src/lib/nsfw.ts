import {
  propagateEpisodeNsfw as propagateEpisodeNsfwImpl,
  propagateMovieNsfw as propagateMovieNsfwImpl,
} from "@obscura/db/src/lib/nsfw-video-propagation";
import { db } from "./db.js";

/**
 * Computes whether a video episode should be marked NSFW based on its library
 * root flag plus any related entities (tags, performers, inherited studio).
 */
export async function propagateEpisodeNsfw(
  episodeId: string,
  libraryRootIsNsfw: boolean,
) {
  return propagateEpisodeNsfwImpl(db, episodeId, libraryRootIsNsfw);
}

/**
 * Computes whether a video movie should be marked NSFW based on its library
 * root flag plus any related entities (tags, performers, studio).
 */
export async function propagateMovieNsfw(
  movieId: string,
  libraryRootIsNsfw: boolean,
) {
  return propagateMovieNsfwImpl(db, movieId, libraryRootIsNsfw);
}
