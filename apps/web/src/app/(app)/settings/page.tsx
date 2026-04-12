export const dynamic = "force-dynamic";

import { SettingsPageClient } from "../../../components/routes/settings-page-client";
import {
  fetchInstalledScrapers,
  fetchLibraryConfig,
  fetchStashBoxEndpointsServer,
  type LibraryRoot,
  type LibrarySettings,
  type StorageStats,
} from "../../../lib/server-api";

const defaultSettings: LibrarySettings = {
  id: "pending",
  autoScanEnabled: false,
  scanIntervalMinutes: 60,
  autoGenerateMetadata: true,
  autoGenerateFingerprints: true,
  generatePhash: false,
  autoGeneratePreview: true,
  generateTrickplay: true,
  trickplayIntervalSeconds: 10,
  previewClipDurationSeconds: 8,
  thumbnailQuality: 2,
  trickplayQuality: 2,
  backgroundWorkerConcurrency: 1,
  nsfwLanAutoEnable: false,
  useLibraryRootAsFolder: false,
  metadataStorageDedicated: true,
  subtitlesAutoEnable: false,
  subtitlesPreferredLanguages: "en,eng",
  subtitleStyle: "stylized",
  subtitleFontScale: 1,
  subtitlePositionPercent: 88,
  subtitleOpacity: 1,
  defaultPlaybackMode: "direct",
  createdAt: "",
  updatedAt: "",
};

export default async function SettingsPage() {
  const [config, scrapersResponse, stashBoxResponse] = await Promise.all([
    fetchLibraryConfig().catch(() => ({
      roots: [] as LibraryRoot[],
      settings: defaultSettings,
      storage: null as StorageStats | null,
    })),
    fetchInstalledScrapers().catch(() => ({ packages: [] })),
    fetchStashBoxEndpointsServer().catch(() => ({ endpoints: [] })),
  ]);

  return (
    <SettingsPageClient
      initialRoots={config.roots}
      initialScraperCount={scrapersResponse.packages.length}
      initialSettings={config.settings}
      initialStorage={config.storage}
      initialStashBoxEndpoints={stashBoxResponse.endpoints as any}
    />
  );
}
