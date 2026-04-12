"use client";

import type { ReactNode } from "react";

interface HierarchySectionProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

export function HierarchySection({
  title,
  children,
  action,
}: HierarchySectionProps) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
