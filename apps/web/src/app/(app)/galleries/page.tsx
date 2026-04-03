import { Images } from "lucide-react";

export default function GalleriesPage() {
  return (
    <div className="space-y-4">
      <h1>Galleries</h1>
      <div className="surface-well flex flex-col items-center justify-center py-16">
        <Images className="h-12 w-12 text-text-disabled mb-3" />
        <p className="text-text-muted text-sm">No galleries in the library yet.</p>
        <p className="text-text-disabled text-xs mt-1">
          Galleries will be populated during library scanning.
        </p>
      </div>
    </div>
  );
}
