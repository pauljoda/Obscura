"use client";

import { Checkbox } from "@obscura/ui/primitives/checkbox";

interface SelectAllHeaderProps {
  allSelected: boolean;
  onToggle: () => void;
  selectedCount: number;
  totalVisible: number;
}

export function SelectAllHeader({
  allSelected,
  onToggle,
  selectedCount,
  totalVisible,
}: SelectAllHeaderProps) {
  return (
    <div className="surface-card-sharp flex items-center gap-3 px-3 py-2 mb-1">
      <Checkbox checked={allSelected} onChange={() => onToggle()} />
      <span className="text-[0.72rem] text-text-muted">
        {selectedCount > 0
          ? `${selectedCount} of ${totalVisible} selected`
          : `Select All (${totalVisible})`}
      </span>
    </div>
  );
}
