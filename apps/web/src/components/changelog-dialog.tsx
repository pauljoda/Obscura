"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";

function parseChangelog(raw: string): string {
  return raw
    .replace(
      /^### (.+)$/gm,
      '<h3 class="text-xs font-heading font-bold uppercase tracking-wider text-text-accent mt-4 mb-2">$1</h3>',
    )
    .replace(
      /^## \[Unreleased\]$/gm,
      '<h2 class="text-sm font-heading font-bold uppercase tracking-wider text-text-accent/80 mt-6 mb-3 border-b border-border-subtle pb-2">Unreleased</h2>',
    )
    .replace(/^## \[(.+?)\](?: - (.+))?$/gm, (_m, ver, date) => {
      const dateStr = date
        ? `<span class="text-text-disabled font-mono text-[10px] ml-2">${date}</span>`
        : "";
      return `<h2 class="text-sm font-heading font-bold uppercase tracking-wider text-text-primary mt-6 mb-3 border-b border-border-subtle pb-2">${ver}${dateStr}</h2>`;
    })
    .replace(/^# (.+)$/gm, "")
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-text-primary">$1</strong>')
    .replace(
      /\[(.+?)\]\((.+?)\)/g,
      '<a href="$2" target="_blank" rel="noopener" class="text-text-accent hover:underline">$1</a>',
    )
    .replace(
      /^  - (.+)$/gm,
      '<li class="text-xs text-text-muted/70 leading-relaxed pl-5 break-words">$1</li>',
    )
    .replace(
      /^- (.+)$/gm,
      '<li class="text-xs text-text-muted leading-relaxed pl-1 break-words">$1</li>',
    )
    .replace(
      /`([^`]+)`/g,
      '<code class="text-[10px] font-mono bg-surface-3/60 px-1 py-0.5 rounded break-all">$1</code>',
    )
    .replace(
      /((?:<li[^>]*>.*<\/li>\n?)+)/g,
      '<ul class="list-disc list-outside ml-4 space-y-1 mb-2">$1</ul>',
    )
    .replace(/^\s*$/gm, "");
}

export function ChangelogDialog({
  version,
  children,
}: {
  version: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open || content) return;
    setLoading(true);
    fetch("/api/changelog")
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((text) => setContent(text))
      .catch(() => setContent("Failed to load changelog."))
      .finally(() => setLoading(false));
  }, [open, content]);

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) setOpen(false);
    },
    [],
  );

  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">
        {children}
      </span>
      <dialog
        ref={dialogRef}
        onClick={handleBackdropClick}
        onClose={() => setOpen(false)}
        className="fixed inset-0 m-auto w-[90vw] max-w-3xl h-[85vh] sm:h-[80vh] border border-border-subtle bg-surface-1 text-text-primary backdrop:bg-black/70 p-0 open:flex flex-col"
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3.5">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-text-accent">
            Changelog &middot; v{version}
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="flex h-7 w-7 items-center justify-center text-text-muted transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-hidden">
          {loading ? (
            <p className="text-xs text-text-disabled animate-pulse">
              Loading changelog...
            </p>
          ) : content ? (
            <div
              className="pb-4 overflow-hidden break-words"
              dangerouslySetInnerHTML={{ __html: parseChangelog(content) }}
            />
          ) : null}
        </div>
      </dialog>
    </>
  );
}
