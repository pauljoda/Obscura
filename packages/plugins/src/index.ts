// Types
export type {
  OscuraPluginManifest,
  PluginRuntime,
  PluginAuthField,
  PluginCapabilities,
  PluginInput,
  PluginExecutionInput,
  PluginExecutionOutput,
  BatchItem,
  OscuraPlugin,
  NormalizedVideoResult,
  NormalizedSeriesRef,
  NormalizedFolderResult,
  EpisodeMapping,
  NormalizedGalleryResult,
  NormalizedImageResult,
  NormalizedAudioTrackResult,
  NormalizedAudioLibraryResult,
  PluginResult,
  SeriesCandidate,
  InstalledPluginDto,
  PluginIndexEntry,
} from "./types";
export {
  pluginCapabilityKeys,
  obscuraToStashActionMap,
} from "./types";

// Manifest Parser
export {
  readManifest,
  validateManifest,
  ManifestParseError,
} from "./manifest-parser";

// Auth
export {
  encryptAuthValue,
  decryptAuthValue,
  resolvePluginAuth,
} from "./auth";

// Executor
export {
  runNativePythonPlugin,
  runNativePythonPluginBatch,
  PluginExecutionError,
  type PluginExecutorOptions,
} from "./executor";

// TypeScript Loader
export { loadTypeScriptPlugin } from "./ts-loader";

// Stash Adapter
export {
  executeStashScraper,
  StashAdapterError,
} from "./stash-adapter";

// Normalizers
export {
  normalizeVideoResult,
  hasUsableVideoResult,
  normalizeFolderResult,
  normalizeGalleryResult,
  normalizeImageResult,
  normalizeAudioTrackResult,
  normalizeAudioLibraryResult,
} from "./normalizer";

// Batch
export {
  parseEpisodeFromFilename,
  matchScenesToEpisodes,
  fanOut,
  type SceneFileInfo,
  type EpisodeMatch,
} from "./batch";

// Index Fetcher
export {
  fetchPluginIndex,
  clearPluginIndexCache,
} from "./index-fetcher";
