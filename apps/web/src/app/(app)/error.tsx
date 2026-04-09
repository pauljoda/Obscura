"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Obscura] Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center bg-surface-2 border border-border-subtle">
          <span className="font-mono text-lg text-status-error">!</span>
        </div>
        <h2 className="font-heading text-lg text-text-primary">Something went wrong</h2>
        <p className="text-sm text-text-muted">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          className="mt-2 px-4 py-2 text-sm font-medium text-text-primary bg-surface-2 border border-border-subtle hover:bg-surface-3 transition-colors duration-fast"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
