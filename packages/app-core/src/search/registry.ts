import type { AppDb } from "@obscura/db";
import type { EntityKind } from "@obscura/contracts";
import type { SearchProvider } from "./types";
import { createVideoSeriesSearchProvider } from "./providers/video-series";
import { createVideosSearchProvider } from "./providers/videos";
import { createPerformersSearchProvider } from "./providers/performers";
import { createStudiosSearchProvider } from "./providers/studios";
import { createTagsSearchProvider } from "./providers/tags";
import { createGalleriesSearchProvider } from "./providers/galleries";
import { createImagesSearchProvider } from "./providers/images";

export function createSearchProviders(
  db: AppDb,
): Map<EntityKind, SearchProvider> {
  return new Map<EntityKind, SearchProvider>([
    ["video-series", createVideoSeriesSearchProvider(db)],
    ["video", createVideosSearchProvider(db)],
    ["performer", createPerformersSearchProvider(db)],
    ["studio", createStudiosSearchProvider(db)],
    ["tag", createTagsSearchProvider(db)],
    ["gallery", createGalleriesSearchProvider(db)],
    ["image", createImagesSearchProvider(db)],
  ]);
}
