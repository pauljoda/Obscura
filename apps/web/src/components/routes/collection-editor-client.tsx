"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  FolderOpen,
  Save,
  Loader2,
  Hand,
  Zap,
  Shuffle,
} from "lucide-react";
import type {
  CollectionDetailDto,
  CollectionMode,
  CollectionRuleGroup,
  CollectionPatchDto,
  CollectionCreateDto,
} from "@obscura/contracts";
import {
  createCollection,
  updateCollection,
} from "../../lib/api/media";
import { ConditionBuilder } from "../collections/condition-builder";

interface CollectionEditorClientProps {
  collection?: CollectionDetailDto;
  isNew?: boolean;
}

const modeOptions: {
  value: CollectionMode;
  label: string;
  description: string;
  icon: typeof Hand;
}[] = [
  {
    value: "manual",
    label: "Manual",
    description: "Manually curated items only",
    icon: Hand,
  },
  {
    value: "dynamic",
    label: "Dynamic",
    description: "Auto-populate based on rules, plus manual additions",
    icon: Zap,
  },
  {
    value: "hybrid",
    label: "Hybrid",
    description: "Combines dynamic rules with manual curation",
    icon: Shuffle,
  },
];

export function CollectionEditorClient({
  collection,
  isNew = false,
}: CollectionEditorClientProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState(collection?.name ?? "New Collection");
  const [description, setDescription] = useState(
    collection?.description ?? "",
  );
  const [mode, setMode] = useState<CollectionMode>(
    collection?.mode ?? "manual",
  );
  const [ruleTree, setRuleTree] = useState<CollectionRuleGroup | null>(
    collection?.ruleTree ?? null,
  );
  const [slideshowDuration, setSlideshowDuration] = useState(
    collection?.slideshowDurationSeconds ?? 5,
  );
  const [slideshowAutoAdvance, setSlideshowAutoAdvance] = useState(
    collection?.slideshowAutoAdvance ?? true,
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      if (isNew) {
        const dto: CollectionCreateDto = {
          name,
          description: description || undefined,
          mode,
          ruleTree: mode !== "manual" ? (ruleTree ?? undefined) : undefined,
          slideshowDurationSeconds: slideshowDuration,
          slideshowAutoAdvance,
        };
        const result = await createCollection(dto);
        router.push(`/collections/${result.id}`);
      } else if (collection) {
        const dto: CollectionPatchDto = {
          name,
          description: description || null,
          mode,
          ruleTree: mode !== "manual" ? ruleTree : null,
          slideshowDurationSeconds: slideshowDuration,
          slideshowAutoAdvance,
        };
        await updateCollection(collection.id, dto);
        router.push(`/collections/${collection.id}`);
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setIsSaving(false);
    }
  }, [
    isNew,
    collection,
    name,
    description,
    mode,
    ruleTree,
    slideshowDuration,
    slideshowAutoAdvance,
    router,
  ]);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back link */}
      <Link
        href={
          collection
            ? `/collections/${collection.id}`
            : "/collections"
        }
        className="inline-flex items-center gap-1 text-[0.78rem] text-text-muted hover:text-text-secondary transition-colors duration-fast"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {collection ? collection.name : "Collections"}
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2.5">
          <FolderOpen className="h-5 w-5 text-text-accent" />
          {isNew ? "New Collection" : "Edit Collection"}
        </h1>
        <button
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent-brass/10 text-text-accent border border-accent-brass/20 hover:bg-accent-brass/20 transition-colors duration-fast disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isNew ? "Create" : "Save"}
        </button>
      </div>

      {/* Metadata */}
      <section className="surface-well p-4 space-y-4">
        <h2 className="text-sm font-heading font-medium text-text-secondary">
          Details
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-[0.75rem] font-medium text-text-muted mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-surface-1 border border-border-default text-text-primary focus:outline-none focus:border-accent-brass/30"
            />
          </div>

          <div>
            <label className="block text-[0.75rem] font-medium text-text-muted mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm bg-surface-1 border border-border-default text-text-primary focus:outline-none focus:border-accent-brass/30 resize-none"
            />
          </div>
        </div>
      </section>

      {/* Mode */}
      <section className="surface-well p-4 space-y-3">
        <h2 className="text-sm font-heading font-medium text-text-secondary">
          Collection Mode
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {modeOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setMode(opt.value)}
                className={`p-3 text-left border transition-colors ${
                  mode === opt.value
                    ? "border-accent-brass/30 bg-accent-brass/5"
                    : "border-border-default hover:border-border-accent"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon
                    className={`h-4 w-4 ${
                      mode === opt.value
                        ? "text-text-accent"
                        : "text-text-muted"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      mode === opt.value
                        ? "text-text-accent"
                        : "text-text-primary"
                    }`}
                  >
                    {opt.label}
                  </span>
                </div>
                <p className="text-[0.7rem] text-text-muted">
                  {opt.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Dynamic Rules */}
      {mode !== "manual" && (
        <ConditionBuilder ruleTree={ruleTree} onChange={setRuleTree} />
      )}

      {/* Slideshow Settings */}
      <section className="surface-well p-4 space-y-3">
        <h2 className="text-sm font-heading font-medium text-text-secondary">
          Slideshow Settings
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-[0.7rem] font-medium text-text-muted mb-1">
              Image Duration (seconds)
            </label>
            <input
              type="number"
              min={1}
              max={120}
              value={slideshowDuration}
              onChange={(e) =>
                setSlideshowDuration(
                  Math.max(1, Math.min(120, Number(e.target.value))),
                )
              }
              className="w-20 px-2 py-1.5 text-sm bg-surface-1 border border-border-default text-text-primary focus:outline-none focus:border-accent-brass/30"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={slideshowAutoAdvance}
              onChange={(e) => setSlideshowAutoAdvance(e.target.checked)}
              className="accent-[#c49a5a]"
            />
            <span className="text-[0.78rem] text-text-secondary">
              Auto-advance
            </span>
          </label>
        </div>
      </section>
    </div>
  );
}
