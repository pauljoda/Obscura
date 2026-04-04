import { Images } from "lucide-react";
import Link from "next/link";

export default function GalleriesPage() {
  return (
    <div className="space-y-4">
      {/* Page header */}
      <div>
        <h1 className="flex items-center gap-2.5">
          <Images className="h-5 w-5 text-text-accent" />
          Galleries
        </h1>
        <p className="text-text-muted text-[0.78rem] mt-1">
          Browse image galleries from your library
        </p>
      </div>

      {/* Empty state */}
      <div className="surface-well flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-3 mb-4">
          <Images className="h-8 w-8 text-text-disabled" />
        </div>
        <h3 className="text-base font-medium font-heading text-text-secondary mb-1">
          No galleries yet
        </h3>
        <p className="text-text-muted text-sm max-w-xs">
          Galleries will be discovered and populated automatically during library scanning.
        </p>
        <div className="separator w-32 my-5" />
        <p className="text-text-disabled text-xs mb-3">
          Make sure your library roots are configured and a scan has been run.
        </p>
        <Link
          href="/settings"
          className="text-text-accent text-xs hover:text-text-accent-bright transition-colors duration-fast"
        >
          Configure library →
        </Link>
      </div>
    </div>
  );
}
