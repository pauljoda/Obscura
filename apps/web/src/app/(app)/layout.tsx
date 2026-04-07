import { cookies } from "next/headers";
import { AppShell } from "../../components/app-shell";
import { fetchLibraryConfig } from "../../lib/server-api/system";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get("obscura-sidebar");
  const initialCollapsed = sidebarCookie?.value === "collapsed";

  let lanAutoEnable = false;
  try {
    const config = await fetchLibraryConfig();
    lanAutoEnable = config.settings.nsfwLanAutoEnable ?? false;
  } catch {
    // Non-fatal — API may be unavailable during cold start
  }

  return (
    <AppShell initialCollapsed={initialCollapsed} lanAutoEnable={lanAutoEnable}>
      {children}
    </AppShell>
  );
}
