"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Eye, Loader2, Film, Images, Layers, Music } from "lucide-react";
import type {
  CollectionRuleGroup,
  CollectionRulePreviewDto,
  CollectionEntityType,
} from "@obscura/contracts";
import { COLLECTION_RULE_FIELDS } from "@obscura/contracts";
import { ConditionGroup } from "./condition-group";
import { CollectionItemCard } from "./collection-item-card";
import { previewCollectionRules } from "../../lib/api/media";
import type { SuggestionItem } from "../routes/collection-editor-client";

interface ConditionBuilderProps {
  ruleTree: CollectionRuleGroup | null;
  onChange: (ruleTree: CollectionRuleGroup | null) => void;
  availableTags?: SuggestionItem[];
  availablePerformers?: SuggestionItem[];
  availableStudios?: SuggestionItem[];
}

function emptyRuleTree(): CollectionRuleGroup {
  const defaultField = COLLECTION_RULE_FIELDS[0];
  return {
    type: "group",
    operator: "and",
    children: [
      {
        type: "condition",
        entityTypes: [],
        field: defaultField.field,
        operator: defaultField.operators[0],
        value: null,
      },
    ],
  };
}

const typeLabels: Record<CollectionEntityType, string> = {
  scene: "scenes",
  gallery: "galleries",
  image: "images",
  "audio-track": "audio tracks",
};

const typeIcons: Record<CollectionEntityType, typeof Film> = {
  scene: Film,
  gallery: Images,
  image: Layers,
  "audio-track": Music,
};

export function ConditionBuilder({
  ruleTree,
  onChange,
  availableTags = [],
  availablePerformers = [],
  availableStudios = [],
}: ConditionBuilderProps) {
  const [preview, setPreview] = useState<CollectionRulePreviewDto | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tree = ruleTree ?? emptyRuleTree();

  // Live preview: debounce rule changes and auto-preview
  const triggerPreview = useCallback(
    async (currentTree: CollectionRuleGroup) => {
      setIsPreviewing(true);
      try {
        const result = await previewCollectionRules(currentTree);
        setPreview(result);
      } catch {
        // Preview failed silently — user can still save
      } finally {
        setIsPreviewing(false);
      }
    },
    [],
  );

  // Auto-preview on rule tree changes (debounced 800ms)
  useEffect(() => {
    if (!ruleTree || ruleTree.children.length === 0) {
      setPreview(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      triggerPreview(ruleTree);
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [ruleTree, triggerPreview]);

  return (
    <div className="space-y-4">
      {/* Rule tree editor */}
      <section className="surface-well p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-heading font-medium text-text-secondary">
            Dynamic Rules
          </h2>
          {isPreviewing && (
            <span className="inline-flex items-center gap-1.5 text-[0.7rem] text-text-muted">
              <Loader2 className="h-3 w-3 animate-spin" />
              Updating preview...
            </span>
          )}
        </div>

        <ConditionGroup
          group={tree}
          onChange={(updated) => onChange(updated)}
          availableTags={availableTags}
          availablePerformers={availablePerformers}
          availableStudios={availableStudios}
        />
      </section>

      {/* Live preview results */}
      {preview && (
        <section className="surface-well p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-heading font-medium text-text-secondary">
              Preview
            </h2>
            <span className="text-[0.78rem] font-mono text-text-accent">
              {preview.total} match{preview.total !== 1 ? "es" : ""}
            </span>
          </div>

          {/* Type breakdown */}
          <div className="flex flex-wrap gap-3">
            {(
              Object.entries(preview.byType) as [CollectionEntityType, number][]
            )
              .filter(([, count]) => count > 0)
              .map(([type, count]) => {
                const Icon = typeIcons[type];
                return (
                  <span
                    key={type}
                    className="inline-flex items-center gap-1 text-[0.75rem] text-text-muted"
                  >
                    <Icon className="h-3 w-3" />
                    {count} {typeLabels[type]}
                  </span>
                );
              })}
          </div>

          {/* Sample items */}
          {preview.sample.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {preview.sample.map((item) => (
                <CollectionItemCard key={item.id} item={item} />
              ))}
            </div>
          )}

          {preview.total > preview.sample.length && (
            <p className="text-[0.7rem] text-text-disabled text-center">
              Showing {preview.sample.length} of {preview.total} matches
            </p>
          )}
        </section>
      )}
    </div>
  );
}
