export const dynamic = "force-dynamic";

import { SettingsPageClient } from "../../../components/routes/settings-page-client";
import {
  fetchInstalledScrapers,
  fetchLibraryConfig,
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
  autoGeneratePreview: true,
  generateTrickplay: true,
  trickplayIntervalSeconds: 10,
  previewClipDurationSeconds: 8,
  thumbnailQuality: 2,
  trickplayQuality: 2,
  createdAt: "",
  updatedAt: "",
};

export default async function SettingsPage() {
  const [config, scrapersResponse] = await Promise.all([
    fetchLibraryConfig().catch(() => ({
      roots: [] as LibraryRoot[],
      settings: defaultSettings,
      storage: null as StorageStats | null,
    })),
    fetchInstalledScrapers().catch(() => ({ packages: [] })),
  ]);

  return (
    <SettingsPageClient
      initialRoots={config.roots}
      initialScraperCount={scrapersResponse.packages.length}
      initialSettings={config.settings}
      initialStorage={config.storage}
    />
  );
}
