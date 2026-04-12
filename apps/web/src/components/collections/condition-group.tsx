"use client";

import { Plus, FolderPlus, Trash2 } from "lucide-react";
import type {
  CollectionRuleGroup,
  CollectionRuleCondition,
  CollectionRuleNode,
} from "@obscura/contracts";
import { COLLECTION_RULE_FIELDS } from "@obscura/contracts";
import { ConditionRow } from "./condition-row";

interface ConditionGroupProps {
  group: CollectionRuleGroup;
  onChange: (group: CollectionRuleGroup) => void;
  onDelete?: () => void;
  depth?: number;
}

function newCondition(): CollectionRuleCondition {
  const defaultField = COLLECTION_RULE_FIELDS[0];
  return {
    type: "condition",
    entityTypes: [],
    field: defaultField.field,
    operator: defaultField.operators[0],
    value: null,
  };
}

function newGroup(): CollectionRuleGroup {
  return {
    type: "group",
    operator: "and",
    children: [newCondition()],
  };
}

export function ConditionGroup({
  group,
  onChange,
  onDelete,
  depth = 0,
}: ConditionGroupProps) {
  const borderColor =
    depth === 0
      ? "border-accent-brass/30"
      : depth === 1
        ? "border-accent-brass/20"
        : "border-border-default";

  const handleChildChange = (index: number, child: CollectionRuleNode) => {
    const newChildren = [...group.children];
    newChildren[index] = child;
    onChange({ ...group, children: newChildren });
  };

  const handleChildDelete = (index: number) => {
    const newChildren = group.children.filter((_, i) => i !== index);
    if (newChildren.length === 0 && onDelete) {
      onDelete();
    } else {
      onChange({ ...group, children: newChildren });
    }
  };

  const handleAddCondition = () => {
    onChange({
      ...group,
      children: [...group.children, newCondition()],
    });
  };

  const handleAddGroup = () => {
    onChange({
      ...group,
      children: [...group.children, newGroup()],
    });
  };

  return (
    <div
      className={`relative border-l-2 ${borderColor} pl-3 py-2 space-y-2`}
    >
      {/* Group operator toggle */}
      <div className="flex items-center gap-2">
        <div className="flex items-center border border-border-default">
          {(["and", "or", "not"] as const).map((op) => (
            <button
              key={op}
              onClick={() => onChange({ ...group, operator: op })}
              className={`px-2 py-0.5 text-[0.7rem] font-mono uppercase transition-colors ${
                group.operator === op
                  ? "bg-accent-brass/15 text-text-accent"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {op}
            </button>
          ))}
        </div>

        <span className="text-[0.65rem] text-text-disabled">
          {group.operator === "and"
            ? "All conditions must match"
            : group.operator === "or"
              ? "Any condition matches"
              : "None of the conditions match"}
        </span>

        {/* Delete group (not root) */}
        {onDelete && (
          <button
            onClick={onDelete}
            className="ml-auto p-1 text-text-disabled hover:text-error-text transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Children */}
      {group.children.map((child, index) => (
        <div key={index}>
          {child.type === "condition" ? (
            <ConditionRow
              condition={child}
              onChange={(updated) => handleChildChange(index, updated)}
              onDelete={() => handleChildDelete(index)}
            />
          ) : (
            <ConditionGroup
              group={child as CollectionRuleGroup}
              onChange={(updated) => handleChildChange(index, updated)}
              onDelete={() => handleChildDelete(index)}
              depth={depth + 1}
            />
          )}
        </div>
      ))}

      {/* Add buttons */}
      <div className="flex items-center gap-1.5 pt-1">
        <button
          onClick={handleAddCondition}
          className="inline-flex items-center gap-1 px-2 py-1 text-[0.7rem] text-text-muted hover:text-text-accent bg-surface-2 hover:bg-surface-3 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Condition
        </button>
        {depth < 3 && (
          <button
            onClick={handleAddGroup}
            className="inline-flex items-center gap-1 px-2 py-1 text-[0.7rem] text-text-muted hover:text-text-accent bg-surface-2 hover:bg-surface-3 transition-colors"
          >
            <FolderPlus className="h-3 w-3" />
            Group
          </button>
        )}
      </div>
    </div>
  );
}
