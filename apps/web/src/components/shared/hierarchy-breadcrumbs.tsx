"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  id: string;
  title: string;
  href: string;
}

interface HierarchyBreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function HierarchyBreadcrumbs({ items }: HierarchyBreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav className="flex flex-wrap items-center gap-1 text-[0.72rem] text-text-muted">
      {items.map((item, index) => (
        <div key={item.id} className="flex items-center gap-1">
          {index > 0 ? <ChevronRight className="h-3 w-3 text-text-disabled" /> : null}
          <Link
            href={item.href}
            className="transition-colors duration-fast hover:text-text-accent"
          >
            {item.title}
          </Link>
        </div>
      ))}
    </nav>
  );
}
