export const dynamic = "force-dynamic";

import { ReviewPageClient } from "../../../../components/routes/review-page-client";
import { fetchAllPendingScrapeResults } from "../../../../lib/server-api";

export default async function ReviewPage() {
  const scrapeResponse = await fetchAllPendingScrapeResults().catch(() => ({
    results: [],
    total: 0,
  }));

  return <ReviewPageClient initialResults={scrapeResponse.results} />;
}
