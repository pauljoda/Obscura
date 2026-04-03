import { FolderOpen } from "lucide-react";

export default function CollectionsPage() {
  return (
    <div className="space-y-4">
      <h1>Collections</h1>
      <div className="surface-well flex flex-col items-center justify-center py-16">
        <FolderOpen className="h-12 w-12 text-text-disabled mb-3" />
        <p className="text-text-muted text-sm">No collections created yet.</p>
        <p className="text-text-disabled text-xs mt-1">
          Create collections to organize your library.
        </p>
      </div>
    </div>
  );
}
