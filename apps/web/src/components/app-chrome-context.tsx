"use client";

import { createContext, useContext, type ReactNode } from "react";

interface AppChromeValue {
  /** True when the desktop sidebar is in collapsed (rail) mode — main content is `md:ml-14`. */
  sidebarCollapsed: boolean;
}

const AppChromeContext = createContext<AppChromeValue>({ sidebarCollapsed: false });

export function AppChromeProvider({
  sidebarCollapsed,
  children,
}: {
  sidebarCollapsed: boolean;
  children: ReactNode;
}) {
  return (
    <AppChromeContext.Provider value={{ sidebarCollapsed }}>
      {children}
    </AppChromeContext.Provider>
  );
}

export function useAppChrome() {
  return useContext(AppChromeContext);
}
