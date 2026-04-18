import type { PageServerLoad } from "./$types";
import { fetchLibraryConfig } from "$lib/server/system";

export const load: PageServerLoad = async ({ depends, fetch }) => {
  depends("settings");
  const config = await fetchLibraryConfig({ fetch }).catch(() => null);
  return { config };
};
