"use client";

import Link from "next/link";
import { Star, Users } from "lucide-react";
import type { PerformerCardData } from "./performer-card-data";

interface PerformerEntityCardProps {
  performer: PerformerCardData;
  variant?: "portrait" | "compact";
  onSelect?: (href: string) => void;
}

export function PerformerEntityCard({
  performer,
  variant = "portrait",
  onSelect,
}: PerformerEntityCardProps) {
  if (variant === "compact") {
    return <PerformerCompactCard performer={performer} onSelect={onSelect} />;
  }

  return (
    <Link href={performer.href}>
      <article className="surface-card group h-full cursor-pointer overflow-hidden">
        <div className="relative aspect-[3/4] bg-surface-3">
          {performer.imagePath ? (
            <img
              src={performer.imagePath}
              alt={performer.name}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-moderate group-hover:scale-[1.02]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Users className="h-10 w-10 text-text-disabled/50" />
            </div>
          )}
          {performer.favorite ? (
            <span className="absolute right-2 top-2 rounded-sm bg-black/60 px-1.5 py-1 text-text-accent backdrop-blur-sm">
              <Star className="h-3 w-3 fill-current" />
            </span>
          ) : null}
        </div>
        <div className="space-y-1 px-3 py-2.5">
          <h3 className="truncate text-sm font-medium transition-colors duration-fast group-hover:text-text-accent">
            {performer.name}
          </h3>
          <p className="text-[0.68rem] text-text-disabled">
            {performer.sceneCount} scene{performer.sceneCount !== 1 ? "s" : ""}
            {performer.gender ? ` · ${performer.gender}` : ""}
          </p>
        </div>
      </article>
    </Link>
  );
}

function PerformerCompactCard({
  performer,
  onSelect,
}: {
  performer: PerformerCardData;
  onSelect?: (href: string) => void;
}) {
  const content = (
    <>
      <div className="shrink-0 overflow-hidden bg-surface-1 flex items-center justify-center h-8 w-8 rounded-full">
        {performer.imagePath ? (
          <img src={performer.imagePath} alt="" className="h-full w-full object-cover" />
        ) : (
          <Users className="h-3.5 w-3.5 text-text-disabled" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-primary truncate">{performer.name}</div>
        <div className="text-[0.68rem] text-text-muted truncate">
          {[performer.gender, `${performer.sceneCount} scenes`].filter(Boolean).join(" · ")}
        </div>
      </div>
      <span className="shrink-0 tag-chip tag-chip-default text-[0.6rem]">performer</span>
    </>
  );

  if (onSelect) {
    return (
      <button
        onClick={() => onSelect(performer.href)}
        className="flex items-center gap-3 w-full px-4 py-2 hover:bg-surface-2 transition-colors duration-fast text-left"
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={performer.href}
      className="flex items-center gap-3 w-full px-4 py-2 hover:bg-surface-2 transition-colors duration-fast text-left"
    >
      {content}
    </Link>
  );
}
