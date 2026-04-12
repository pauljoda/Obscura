"use client";

import { Trash2 } from "lucide-react";
import type {
  CollectionRuleCondition,
  CollectionEntityType,
  CollectionOperator,
  CollectionConditionValue,
  CollectionRuleFieldDef,
} from "@obscura/contracts";
import { COLLECTION_RULE_FIELDS } from "@obscura/contracts";

interface ConditionRowProps {
  condition: CollectionRuleCondition;
  onChange: (condition: CollectionRuleCondition) => void;
  onDelete: () => void;
}

const operatorLabels: Record<CollectionOperator, string> = {
  equals: "equals",
  not_equals: "not equals",
  contains: "contains",
  not_contains: "not contains",
  greater_than: ">",
  less_than: "<",
  greater_equal: ">=",
  less_equal: "<=",
  between: "between",
  in: "includes",
  not_in: "excludes",
  is_null: "is empty",
  is_not_null: "is not empty",
  is_true: "is true",
  is_false: "is false",
};

function getFieldDef(fieldName: string): CollectionRuleFieldDef | undefined {
  return COLLECTION_RULE_FIELDS.find((f) => f.field === fieldName);
}

function getAvailableFields(
  entityTypes: CollectionEntityType[],
): CollectionRuleFieldDef[] {
  if (entityTypes.length === 0) return COLLECTION_RULE_FIELDS;
  return COLLECTION_RULE_FIELDS.filter(
    (f) =>
      f.entityTypes.length === 0 ||
      f.entityTypes.some((t) => entityTypes.includes(t)),
  );
}

function needsValueInput(operator: CollectionOperator): boolean {
  return !["is_null", "is_not_null", "is_true", "is_false"].includes(operator);
}

export function ConditionRow({
  condition,
  onChange,
  onDelete,
}: ConditionRowProps) {
  const fieldDef = getFieldDef(condition.field);
  const availableFields = getAvailableFields(condition.entityTypes);
  const operators = fieldDef?.operators ?? [];
  const showValue = needsValueInput(condition.operator);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Entity type filter chips */}
      <div className="flex items-center gap-0.5">
        {(
          ["scene", "gallery", "image", "audio-track"] as CollectionEntityType[]
        ).map((type) => {
          const active = condition.entityTypes.includes(type);
          const label =
            type === "audio-track"
              ? "Audio"
              : type.charAt(0).toUpperCase() + type.slice(1);
          return (
            <button
              key={type}
              onClick={() => {
                const types = active
                  ? condition.entityTypes.filter((t) => t !== type)
                  : [...condition.entityTypes, type];
                onChange({ ...condition, entityTypes: types });
              }}
              className={`px-1.5 py-0.5 text-[0.6rem] font-mono uppercase transition-colors ${
                active
                  ? "bg-accent-brass/20 text-text-accent border border-accent-brass/30"
                  : "bg-surface-2 text-text-disabled border border-border-subtle hover:text-text-muted"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Field selector */}
      <select
        value={condition.field}
        onChange={(e) => {
          const newFieldDef = getFieldDef(e.target.value);
          const newOperators = newFieldDef?.operators ?? [];
          const newOperator = newOperators.includes(condition.operator)
            ? condition.operator
            : newOperators[0] ?? "equals";
          onChange({
            ...condition,
            field: e.target.value,
            operator: newOperator,
            value: null,
          });
        }}
        className="px-2 py-1 text-[0.75rem] bg-surface-1 border border-border-default text-text-primary focus:outline-none focus:border-accent-brass/30"
      >
        {availableFields.map((f) => (
          <option key={f.field} value={f.field}>
            {f.label}
          </option>
        ))}
      </select>

      {/* Operator selector */}
      <select
        value={condition.operator}
        onChange={(e) =>
          onChange({
            ...condition,
            operator: e.target.value as CollectionOperator,
          })
        }
        className="px-2 py-1 text-[0.75rem] bg-surface-1 border border-border-default text-text-primary focus:outline-none focus:border-accent-brass/30"
      >
        {operators.map((op) => (
          <option key={op} value={op}>
            {operatorLabels[op]}
          </option>
        ))}
      </select>

      {/* Value input */}
      {showValue && (
        <ValueInput
          fieldDef={fieldDef}
          operator={condition.operator}
          value={condition.value}
          onChange={(value) => onChange({ ...condition, value })}
        />
      )}

      {/* Delete */}
      <button
        onClick={onDelete}
        className="p-1 text-text-disabled hover:text-error-text transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ValueInput({
  fieldDef,
  operator,
  value,
  onChange,
}: {
  fieldDef?: CollectionRuleFieldDef;
  operator: CollectionOperator;
  value: CollectionConditionValue;
  onChange: (value: CollectionConditionValue) => void;
}) {
  if (!fieldDef) return null;

  const fieldType = fieldDef.fieldType;

  // Enum fields use a multi-select style
  if (fieldType === "enum" && fieldDef.enumValues) {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-wrap gap-0.5">
        {fieldDef.enumValues.map((v) => {
          const isSelected = selected.includes(v);
          return (
            <button
              key={v}
              onClick={() => {
                const newValue = isSelected
                  ? selected.filter((s) => s !== v)
                  : [...selected, v];
                onChange(newValue);
              }}
              className={`px-1.5 py-0.5 text-[0.65rem] font-mono transition-colors ${
                isSelected
                  ? "bg-accent-brass/20 text-text-accent border border-accent-brass/30"
                  : "bg-surface-2 text-text-muted border border-border-subtle hover:text-text-secondary"
              }`}
            >
              {v}
            </button>
          );
        })}
      </div>
    );
  }

  // Relation fields (tags, performers, studios)
  if (fieldType === "relation") {
    const currentValues = Array.isArray(value) ? (value as string[]) : [];
    return (
      <input
        type="text"
        value={currentValues.join(", ")}
        onChange={(e) => {
          const names = e.target.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          onChange(names);
        }}
        placeholder="comma-separated names..."
        className="px-2 py-1 text-[0.75rem] bg-surface-1 border border-border-default text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent-brass/30 min-w-[180px]"
      />
    );
  }

  // Between operator uses two inputs
  if (operator === "between") {
    const [min, max] = Array.isArray(value)
      ? (value as [number, number])
      : [0, 0];
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={min}
          onChange={(e) => onChange([Number(e.target.value), max])}
          className="px-2 py-1 text-[0.75rem] bg-surface-1 border border-border-default text-text-primary w-20 focus:outline-none focus:border-accent-brass/30"
        />
        <span className="text-[0.7rem] text-text-disabled">to</span>
        <input
          type="number"
          value={max}
          onChange={(e) => onChange([min, Number(e.target.value)])}
          className="px-2 py-1 text-[0.75rem] bg-surface-1 border border-border-default text-text-primary w-20 focus:outline-none focus:border-accent-brass/30"
        />
      </div>
    );
  }

  // Number fields
  if (fieldType === "number") {
    return (
      <input
        type="number"
        value={typeof value === "number" ? value : ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="px-2 py-1 text-[0.75rem] bg-surface-1 border border-border-default text-text-primary w-24 focus:outline-none focus:border-accent-brass/30"
      />
    );
  }

  // Date fields
  if (fieldType === "date") {
    return (
      <input
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 text-[0.75rem] bg-surface-1 border border-border-default text-text-primary focus:outline-none focus:border-accent-brass/30"
      />
    );
  }

  // Default text
  return (
    <input
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="value..."
      className="px-2 py-1 text-[0.75rem] bg-surface-1 border border-border-default text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent-brass/30 min-w-[140px]"
    />
  );
}
