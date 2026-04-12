import type { SearchProvider } from "./types";
import { sceneFoldersSearchProvider } from "./providers/scene-folders.provider";
import { scenesSearchProvider } from "./providers/scenes.provider";
import { performersSearchProvider } from "./providers/performers.provider";
import { studiosSearchProvider } from "./providers/studios.provider";
import { tagsSearchProvider } from "./providers/tags.provider";
import { galleriesSearchProvider } from "./providers/galleries.provider";
import { imagesSearchProvider } from "./providers/images.provider";

export const searchProviders = new Map<string, SearchProvider>([
  ["scene-folder", sceneFoldersSearchProvider],
  ["scene", scenesSearchProvider],
  ["performer", performersSearchProvider],
  ["studio", studiosSearchProvider],
  ["tag", tagsSearchProvider],
  ["gallery", galleriesSearchProvider],
  ["image", imagesSearchProvider],
]);
