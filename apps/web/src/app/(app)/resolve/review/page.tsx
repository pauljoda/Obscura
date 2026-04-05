export const dynamic = "force-dynamic";

import { ReviewPageClient } from "../../../../components/routes/review-page-client";
import { fetchScrapeResults } from "../../../../lib/server-api";

export default async function ReviewPage() {
  const scrapeResponse = await fetchScrapeResults({ status: "pending", limit: 100 }).catch(
    () => ({ results: [], total: 0, limit: 100, offset: 0 }),
  );

  return <ReviewPageClient initialResults={scrapeResponse.results} />;
}
