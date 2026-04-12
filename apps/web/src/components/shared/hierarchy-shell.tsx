"use client";

import type { ReactNode } from "react";

interface HierarchyShellProps {
  title: ReactNode;
  breadcrumbs?: ReactNode;
  children: ReactNode;
}

export function HierarchyShell({
  title,
  breadcrumbs,
  children,
}: HierarchyShellProps) {
  return (
    <div className="space-y-4">
      {breadcrumbs ? <div>{breadcrumbs}</div> : null}
      {title ? (
        <div className="space-y-1">
          <div>{title}</div>
        </div>
      ) : null}
      {children}
    </div>
  );
}
