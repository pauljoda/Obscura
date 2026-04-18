"use client";

export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-5 w-24 bg-surface-2" />

      <div className="aspect-video w-full surface-media-well bg-black/70" />

      <div className="surface-card-sharp p-4 space-y-3">
        <div className="h-7 w-2/3 bg-surface-2" />
        <div className="flex flex-wrap gap-2">
          <div className="h-4 w-24 bg-surface-2" />
          <div className="h-4 w-20 bg-surface-2" />
          <div className="h-4 w-16 bg-surface-2" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-4 w-full bg-surface-2" />
        <div className="h-4 w-5/6 bg-surface-2" />
        <div className="h-4 w-2/3 bg-surface-2" />
      </div>
    </div>
  );
}
