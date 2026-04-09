"use client";

import { NsfwEditToggle } from "./nsfw/nsfw-gate";

export interface TagFormValues {
  name: string;
  description: string;
  aliases: string;
  isNsfw: boolean;
}

interface TagFormProps {
  values: TagFormValues;
  onChange: (values: TagFormValues) => void;
}

export function TagForm({ values, onChange }: TagFormProps) {
  function set<K extends keyof TagFormValues>(key: K, val: TagFormValues[K]) {
    onChange({ ...values, [key]: val });
  }

  return (
    <div className="surface-well p-4 space-y-4">
      <div className="text-kicker mb-1">Tag Info</div>
      <div className="grid grid-cols-1 gap-3">
        <div>
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
          <label className="text-[0.68rem] text-text-muted font-medium mb-1 block">Aliases</label>
          <input
            type="text"
            value={values.aliases}
            onChange={(e) => set("aliases", e.target.value)}
            placeholder="Comma-separated"
            className="control-input w-full py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-[0.68rem] text-text-muted font-medium mb-1 block">Description</label>
          <textarea
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            rows={4}
            className="control-input w-full py-2 text-sm resize-y"
            placeholder="Tag description..."
          />
        </div>
        <div className="flex items-center gap-3">
          <NsfwEditToggle value={values.isNsfw} onChange={(v) => set("isNsfw", v)} />
          {values.isNsfw && <span className="text-[0.68rem] text-text-muted">This tag will be hidden in SFW mode</span>}
        </div>
      </div>
    </div>
  );
}
