import { FolderOpen, Film, Images } from "lucide-react";
import Link from "next/link";

export default function CollectionsPage() {
  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h1 className="flex items-center gap-2.5">
          <FolderOpen className="h-5 w-5 text-text-accent" />
          Collections
        </h1>
        <p className="text-text-muted text-[0.78rem] mt-1">
          Organize scenes and galleries into curated collections
        </p>
      </div>

      {/* Empty state */}
      <div className="surface-well flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-3 mb-4">
          <FolderOpen className="h-8 w-8 text-text-disabled" />
        </div>
        <h3 className="text-base font-medium font-heading text-text-secondary mb-1">
          No collections yet
        </h3>
        <p className="text-text-muted text-sm max-w-xs">
          Collections let you group scenes and galleries into curated playlists or sets. This feature is coming soon.
        </p>
        <div className="separator w-32 my-5" />
        <div className="flex items-center gap-4 text-text-disabled text-xs">
          <Link href="/scenes" className="inline-flex items-center gap-1.5 hover:text-text-muted transition-colors duration-fast">
            <Film className="h-3.5 w-3.5" />
            Browse scenes
          </Link>
          <Link href="/galleries" className="inline-flex items-center gap-1.5 hover:text-text-muted transition-colors duration-fast">
            <Images className="h-3.5 w-3.5" />
            Browse galleries
          </Link>
        </div>
      </div>
    </div>
  );
}
