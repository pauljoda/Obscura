import { fetchAllPendingScrapeResults } from "$lib/v1/server/media-v1";

export const prerender = false;

export async function load({ depends }) {
  depends("scrape-results:pending");
  const response = await fetchAllPendingScrapeResults().catch(() => ({
    results: [],
    total: 0,
  }));
  return { initialResults: response.results };
}
