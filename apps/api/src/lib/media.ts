import path from "node:path";
import {
  probeVideoFile,
  runProcess,
  type ProbeVideoMetadata,
} from "@obscura/media-core";
import {
  getHlsRenditions,
  HLS_RENDITION_PRESETS,
  type HlsRendition,
} from "@obscura/contracts/media";

export const MEDIA_SCENES_DIR = path.resolve(
  import.meta.dirname,
  "../../../../apps/web/public/media/scenes"
);

export {
  getHlsRenditions,
  HLS_RENDITION_PRESETS,
  probeVideoFile,
  runProcess,
  type HlsRendition,
  type ProbeVideoMetadata,
};
