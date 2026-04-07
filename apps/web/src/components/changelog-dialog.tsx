"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { X } from "lucide-react";

type ChangelogBlock =
  | { type: "h2"; title: string; date?: string }
  | { type: "h3"; title: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: Array<{ text: string; level: 0 | 1 }> };

function flushParagraph(
  blocks: ChangelogBlock[],
  paragraph: string[],
): ChangelogBlock[] {
  if (paragraph.length === 0) return blocks;

  return [
    ...blocks,
    {
      type: "p",
      text: paragraph.join(" "),
    },
  ];
}

function flushList(
  blocks: ChangelogBlock[],
  items: Array<{ text: string; level: 0 | 1 }>,
): ChangelogBlock[] {
  if (items.length === 0) return blocks;
  return [...blocks, { type: "ul", items }];
}

function parseChangelog(raw: string): ChangelogBlock[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  let blocks: ChangelogBlock[] = [];
  let paragraph: string[] = [];
  let listItems: Array<{ text: string; level: 0 | 1 }> = [];

  const flushAll = () => {
    blocks = flushParagraph(blocks, paragraph);
    paragraph = [];
    blocks = flushList(blocks, listItems);
    listItems = [];
  };

  for (const line of lines) {
    if (line.trim() === "") {
      flushAll();
      continue;
    }

    if (line.startsWith("# ")) {
      flushAll();
      continue;
    }

    if (line.startsWith("## ")) {
      flushAll();
      const match = line.match(/^## \[(.+?)\](?: - (.+))?$/);
      if (match) {
        blocks.push({
          type: "h2",
          title: match[1],
          date: match[2],
        });
      }
      continue;
    }

    if (line.startsWith("### ")) {
      flushAll();
      blocks.push({
        type: "h3",
        title: line.slice(4).trim(),
      });
      continue;
    }

    const nestedBullet = line.match(/^  - (.+)$/);
    if (nestedBullet) {
      listItems.push({ text: nestedBullet[1], level: 1 });
      continue;
    }

    const bullet = line.match(/^- (.+)$/);
    if (bullet) {
      listItems.push({ text: bullet[1], level: 0 });
      continue;
    }

    blocks = flushList(blocks, listItems);
    listItems = [];
    paragraph.push(line.trim());
  }

  flushAll();
  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);

  return parts.filter(Boolean).map((part, index) => {
    const bold = part.match(/^\*\*(.+)\*\*$/);
    if (bold) {
      return (
        <strong key={index} className="text-text-primary">
          {bold[1]}
        </strong>
      );
    }

    const code = part.match(/^`(.+)`$/);
    if (code) {
      return (
        <code
          key={index}
          className="rounded-[3px] bg-surface-3/60 px-1 py-0.5 font-mono text-[10px] break-all"
        >
          {code[1]}
        </code>
      );
    }

    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return (
        <a
          key={index}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-accent hover:underline"
        >
          {link[1]}
        </a>
      );
    }

    return <Fragment key={index}>{part}</Fragment>;
  });
}

function renderBlock(block: ChangelogBlock, index: number) {
  if (block.type === "h2") {
    return (
      <div
        key={index}
        className="mt-6 border-b border-border-subtle pb-2 first:mt-0"
      >
        <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-text-primary">
          {block.title}
          {block.date ? (
            <span className="ml-2 font-mono text-[10px] text-text-disabled">
              {block.date}
            </span>
          ) : null}
        </h2>
      </div>
    );
  }

  if (block.type === "h3") {
    return (
      <h3
        key={index}
        className="mt-4 font-heading text-xs font-bold uppercase tracking-wider text-text-accent"
      >
        {block.title}
      </h3>
    );
  }

  if (block.type === "p") {
    return (
      <p
        key={index}
        className="mt-3 text-xs leading-relaxed text-text-muted first:mt-0"
      >
        {renderInline(block.text)}
      </p>
    );
  }

  return (
    <ul key={index} className="mt-2 space-y-1">
      {block.items.map((item, itemIndex) => (
        <li
          key={itemIndex}
          className={
            item.level === 0
              ? "ml-4 list-disc text-xs leading-relaxed text-text-muted"
              : "ml-8 list-disc text-[11px] leading-relaxed text-text-muted/75"
          }
        >
          {renderInline(item.text)}
        </li>
      ))}
    </ul>
  );
}

export function ChangelogDialog({
  version,
  children,
}: {
  version: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const blocks = content ? parseChangelog(content) : [];

  useEffect(() => {
    if (!open || content) return;
    setLoading(true);
    fetch("/api/changelog")
      .then((response) => (response.ok ? response.text() : Promise.reject()))
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
    (event: MouseEvent<HTMLDialogElement>) => {
      if (event.target === dialogRef.current) setOpen(false);
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
        className="fixed inset-0 m-auto h-[85vh] w-[90vw] max-w-3xl flex-col border border-border-subtle bg-surface-1 p-0 text-text-primary backdrop:bg-black/70 open:flex sm:h-[80vh]"
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
        <div className="scrollbar-hidden flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="animate-pulse text-xs text-text-disabled">
              Loading changelog...
            </p>
          ) : content ? (
            <div className="pb-4">{blocks.map(renderBlock)}</div>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
