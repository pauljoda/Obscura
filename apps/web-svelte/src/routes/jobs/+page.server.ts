import type { PageServerLoad } from "./$types";
import { fetchJobsDashboard } from "$lib/server/system";

export const load: PageServerLoad = async ({ depends, fetch }) => {
  depends("jobs");
  const dashboard = await fetchJobsDashboard({ fetch }).catch(() => null);
  return { dashboard };
};
