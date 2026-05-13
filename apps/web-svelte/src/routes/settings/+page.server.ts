import type { PageServerLoad } from "./$types";
import { fetchInstalledScrapers, fetchLibraryConfig } from "$lib/v1/server/system-v1";

export const load: PageServerLoad = async ({ depends, fetch }) => {
  depends("settings");
  const [config, scrapers] = await Promise.all([
    fetchLibraryConfig({ fetch }).catch(() => null),
    fetchInstalledScrapers({ fetch }).catch(() => ({ packages: [] })),
  ]);
  return {
    config,
    scraperCount: scrapers.packages.length,
  };
};
