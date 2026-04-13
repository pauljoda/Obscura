export const dynamic = "force-dynamic";

import { DashboardPageClient } from "../../../components/routes/dashboard-page-client";

export default function EmptyTestPage() {
  return (
    <DashboardPageClient
      scenes={[]}
      featuredScenes={[]}
      galleries={[]}
      images={[]}
      audioLibraries={[]}
      sceneFolders={[]}
      performers={[]}
      studios={[]}
    />
  );
}
