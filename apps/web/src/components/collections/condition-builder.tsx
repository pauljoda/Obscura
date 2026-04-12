"use client";

import { useState, useCallback } from "react";
import { Eye, Loader2 } from "lucide-react";
import type {
  CollectionRuleGroup,
  CollectionRulePreviewDto,
  CollectionEntityType,
} from "@obscura/contracts";
import { COLLECTION_RULE_FIELDS } from "@obscura/contracts";
import { ConditionGroup } from "./condition-group";
import { CollectionItemCard } from "./collection-item-card";
import { previewCollectionRules } from "../../lib/api/media";

interface ConditionBuilderProps {
  ruleTree: CollectionRuleGroup | null;
  onChange: (ruleTree: CollectionRuleGroup | null) => void;
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

export function ConditionBuilder({
  ruleTree,
  onChange,
}: ConditionBuilderProps) {
  const [preview, setPreview] = useState<CollectionRulePreviewDto | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const tree = ruleTree ?? emptyRuleTree();

  const handlePreview = useCallback(async () => {
    setIsPreviewing(true);
    try {
      const result = await previewCollectionRules(tree);
      setPreview(result);
    } catch (err) {
      console.error("Preview failed:", err);
    } finally {
      setIsPreviewing(false);
    }
  }, [tree]);

  return (
    <div className="space-y-4">
      {/* Rule tree editor */}
      <div className="surface-well p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-heading font-medium text-text-secondary">
            Dynamic Rules
          </h3>
          <button
            onClick={handlePreview}
            disabled={isPreviewing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.75rem] font-medium bg-surface-2 text-text-muted hover:text-text-accent hover:bg-surface-3 transition-colors disabled:opacity-50"
          >
            {isPreviewing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            Preview Results
          </button>
        </div>

        <ConditionGroup
          group={tree}
          onChange={(updated) => onChange(updated)}
        />
      </div>

      {/* Preview results */}
      {preview && (
        <div className="surface-well p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-heading font-medium text-text-secondary">
              Preview
            </h3>
            <span className="text-[0.78rem] font-mono text-text-accent">
              {preview.total} matches
            </span>
          </div>

          {/* Type breakdown */}
          <div className="flex flex-wrap gap-3">
            {(
              Object.entries(preview.byType) as [CollectionEntityType, number][]
            )
              .filter(([, count]) => count > 0)
              .map(([type, count]) => (
                <span
                  key={type}
                  className="text-[0.75rem] text-text-muted"
                >
                  {count} {typeLabels[type]}
                </span>
              ))}
          </div>

          {/* Sample items */}
          {preview.sample.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-[2px]">
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
        </div>
      )}
    </div>
  );
}
