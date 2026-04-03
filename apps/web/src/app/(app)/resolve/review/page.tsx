import { GitCompareArrows } from "lucide-react";

export default function ReviewPage() {
  return (
    <div className="space-y-4">
      <h1>Review</h1>
      <div className="surface-well flex flex-col items-center justify-center py-16">
        <GitCompareArrows className="h-12 w-12 text-text-disabled mb-3" />
        <p className="text-text-muted text-sm">
          No matches to review at this time.
        </p>
        <p className="text-text-disabled text-xs mt-1">
          Reviewed matches from the resolve queue appear here.
        </p>
      </div>
    </div>
  );
}
