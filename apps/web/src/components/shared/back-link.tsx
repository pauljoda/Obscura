"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { getBackHref } from "../../lib/back-navigation";
import { cn } from "@obscura/ui/lib/utils";

interface BackLinkProps {
  /** Default destination when no `from` query parameter is present. */
  fallback: string;
  /** Visible label next to the icon. */
  label: string;
  /** Visual variant — `pill` renders the surface-well badge style,
   *  `text` renders a minimal inline link. Defaults to `pill`. */
  variant?: "pill" | "text";
  className?: string;
}

export function BackLink({
  fallback,
  label,
  variant = "pill",
  className,
}: BackLinkProps) {
  const searchParams = useSearchParams();
  const href = getBackHref(searchParams, fallback);

  if (variant === "text") {
    return (
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1 text-[0.78rem] text-text-muted hover:text-text-secondary transition-colors duration-fast",
          className,
        )}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted transition-colors duration-fast hover:text-text-accent",
        className,
      )}
    >
      <ArrowLeft className="h-3 w-3" />
      {label}
    </Link>
  );
}
