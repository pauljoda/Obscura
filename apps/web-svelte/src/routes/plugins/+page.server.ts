import type { PageServerLoad } from "./$types";
import { fetchInstalledPlugins, fetchInstalledScrapers } from "$lib/server/system";

export const load: PageServerLoad = async ({ depends, fetch }) => {
  depends("plugins");
  const [pluginsRes, scrapersRes] = await Promise.all([
    fetchInstalledPlugins({ fetch }).catch(() => ({ packages: [] })),
    fetchInstalledScrapers({ fetch }).catch(() => ({ packages: [] })),
  ]);
  return {
    plugins: pluginsRes.packages as unknown[],
    scrapers: scrapersRes.packages,
  };
};
