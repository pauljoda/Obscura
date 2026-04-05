import { cookies } from "next/headers";
import { AppShell } from "../../components/app-shell";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get("obscura-sidebar");
  const initialCollapsed = sidebarCookie?.value === "collapsed";

  return <AppShell initialCollapsed={initialCollapsed}>{children}</AppShell>;
}
