"use client";

import { X, ChevronUp, ChevronDown, Loader2, AlertCircle } from "lucide-react";

export interface ReviewDrawerProps {
  label: string;
  onClose: () => void;
  // Navigation
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  // State
  loading?: boolean;
  error?: string | null;
  // Content
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function ReviewDrawer({
  label,
  onClose,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
  loading,
  error,
  children,
  footer,
}: ReviewDrawerProps) {
  return (
    <div
      className="fixed inset-0 z-[90] flex justify-end bg-bg/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-1 flex h-full w-full max-w-3xl flex-col border-l border-border-subtle shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[0.6rem] uppercase tracking-[0.14em] text-text-muted">
              Review scrape
            </div>
            <h2 className="truncate text-base font-semibold text-text-primary">
              {label}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Up/Down Navigation */}
            {(onPrev || onNext) && (
              <div className="flex items-center gap-1 border-r border-border-subtle pr-3 mr-1">
                <button
                  type="button"
                  onClick={onPrev}
                  disabled={!hasPrev}
                  className="p-1.5 text-text-muted hover:bg-surface-2/40 hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-sm"
                  aria-label="Previous"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!hasNext}
                  className="p-1.5 text-text-muted hover:bg-surface-2/40 hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded-sm"
                  aria-label="Next"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-text-muted hover:text-text-primary transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex h-32 items-center justify-center text-text-muted">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading scrape
              result…
            </div>
          )}
          {!loading && error && (
            <div className="m-5 flex items-center gap-2 border border-status-error/30 bg-status-error/10 px-3 py-2 text-[0.72rem] text-status-error-text">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
          )}
          {!loading && !error && children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-border-subtle bg-bg px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
