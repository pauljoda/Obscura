"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import { NsfwEditToggle } from "./nsfw/nsfw-gate";
import type { StudioItem } from "../lib/api";

export interface StudioFormValues {
  name: string;
  url: string;
  description: string;
  aliases: string;
  isNsfw: boolean;
  parentId: string | null;
}

interface StudioFormProps {
  values: StudioFormValues;
  onChange: (values: StudioFormValues) => void;
  /** All studios available for parent selection */
  allStudios: StudioItem[];
  /** Initial parent name to display in search (for edit mode) */
  initialParentName?: string;
}

export function StudioForm({ values, onChange, allStudios, initialParentName }: StudioFormProps) {
  const [parentSearch, setParentSearch] = useState(initialParentName ?? "");
  const [parentDropdownOpen, setParentDropdownOpen] = useState(false);

  function set<K extends keyof StudioFormValues>(key: K, val: StudioFormValues[K]) {
    onChange({ ...values, [key]: val });
  }

  return (
    <div className="surface-well p-4 space-y-4">
      <div className="text-kicker mb-1">Studio Info</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="col-span-full sm:col-span-1">
          <label className="text-[0.68rem] text-text-muted font-medium mb-1 block">
            Name <span className="text-status-error ml-0.5">*</span>
          </label>
          <input
            type="text"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            className="control-input w-full py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-[0.68rem] text-text-muted font-medium mb-1 block">URL</label>
          <input
            type="text"
            value={values.url}
            onChange={(e) => set("url", e.target.value)}
            placeholder="https://..."
            className="control-input w-full py-1.5 text-sm"
          />
        </div>
        <div className="relative">
          <label className="text-[0.68rem] text-text-muted font-medium mb-1 block">Parent Studio</label>
          <div className="relative">
            <input
              type="text"
              value={parentSearch}
              onChange={(e) => { setParentSearch(e.target.value); setParentDropdownOpen(true); }}
              onFocus={() => setParentDropdownOpen(true)}
              onBlur={() => setTimeout(() => setParentDropdownOpen(false), 200)}
              placeholder="Search studios..."
              className="control-input w-full py-1.5 text-sm"
            />
            {values.parentId && (
              <button
                type="button"
                onClick={() => { set("parentId", null); setParentSearch(""); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-disabled hover:text-text-primary transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {parentDropdownOpen && parentSearch.length > 0 && (
            <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-surface-2 border border-border-subtle shadow-lg max-h-48 overflow-y-auto">
              {allStudios
                .filter((s) => s.name.toLowerCase().includes(parentSearch.toLowerCase()))
                .slice(0, 20)
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      set("parentId", s.id);
                      setParentSearch(s.name);
                      setParentDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-sm hover:bg-surface-3 transition-colors",
                      s.id === values.parentId && "text-text-accent"
                    )}
                  >
                    {s.name}
                  </button>
                ))}
              {allStudios.filter((s) => s.name.toLowerCase().includes(parentSearch.toLowerCase())).length === 0 && (
                <div className="px-3 py-2 text-xs text-text-disabled">No studios found</div>
              )}
            </div>
          )}
        </div>
        <div className="col-span-full">
          <label className="text-[0.68rem] text-text-muted font-medium mb-1 block">Aliases</label>
          <input
            type="text"
            value={values.aliases}
            onChange={(e) => set("aliases", e.target.value)}
            placeholder="Comma-separated"
            className="control-input w-full py-1.5 text-sm"
          />
        </div>
        <div className="col-span-full">
          <label className="text-[0.68rem] text-text-muted font-medium mb-1 block">Description</label>
          <textarea
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            className="control-input w-full py-2 text-sm resize-y"
            placeholder="Studio description..."
          />
        </div>
        <div className="col-span-full flex items-center gap-3">
          <NsfwEditToggle value={values.isNsfw} onChange={(v) => set("isNsfw", v)} />
          {values.isNsfw && <span className="text-[0.68rem] text-text-muted">This studio will be hidden in SFW mode</span>}
        </div>
      </div>
    </div>
  );
}
