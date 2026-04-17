"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";

export interface ProviderGroup {
  label?: string;
  options: { value: string; label: string }[];
}

export interface ProviderSelectorProps {
  value: string;
  onChange: (value: string) => void;
  groups: ProviderGroup[];
  allOption?: { value: string; label: string };
  disabled?: boolean;
  className?: string;
}

export function ProviderSelector({
  value,
  onChange,
  groups,
  allOption,
  disabled,
  className,
}: ProviderSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Find the currently selected label
  let selectedLabel = allOption?.value === value ? allOption.label : "";
  if (!selectedLabel) {
    for (const group of groups) {
      const opt = group.options.find((o) => o.value === value);
      if (opt) {
        selectedLabel = opt.label;
        break;
      }
    }
  }

  const filteredGroups = groups
    .map((g) => ({
      ...g,
      options: g.options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter((g) => g.options.length > 0);

  const showAllOption =
    allOption &&
    (!search || allOption.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          "control-input flex w-full items-center justify-between gap-2 text-left disabled:opacity-50 disabled:cursor-not-allowed",
          open && "border-border-accent ring-1 ring-border-accent"
        )}
      >
        <span className="truncate">{selectedLabel || "Select provider..."}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[240px] rounded-none border border-border-subtle bg-surface-2 shadow-xl">
          <div className="flex items-center gap-2 border-b border-border-subtle p-2">
            <Search className="h-3.5 w-3.5 text-text-disabled" />
            <input
              type="text"
              autoFocus
              placeholder="Search providers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-disabled focus:outline-none"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto p-1">
            {showAllOption && (
              <button
                type="button"
                onClick={() => {
                  onChange(allOption.value);
                  setOpen(false);
                  setSearch("");
                }}
                className={cn(
                  "flex w-full items-center justify-between px-2 py-1.5 text-xs text-left hover:bg-surface-3 transition-colors",
                  value === allOption.value && "bg-accent-950 text-text-accent"
                )}
              >
                <span className="truncate">{allOption.label}</span>
                {value === allOption.value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            )}

            {filteredGroups.length === 0 && !showAllOption ? (
              <div className="p-3 text-center text-xs text-text-disabled">
                No providers found.
              </div>
            ) : (
              filteredGroups.map((group, idx) => (
                <div key={idx} className="mb-1 last:mb-0">
                  {group.label && (
                    <div className="px-2 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-text-disabled">
                      {group.label}
                    </div>
                  )}
                  {group.options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                        setSearch("");
                      }}
                      className={cn(
                        "flex w-full items-center justify-between px-2 py-1.5 text-xs text-left hover:bg-surface-3 transition-colors",
                        value === opt.value && "bg-accent-950 text-text-accent"
                      )}
                    >
                      <span className="truncate">{opt.label}</span>
                      {value === opt.value && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
