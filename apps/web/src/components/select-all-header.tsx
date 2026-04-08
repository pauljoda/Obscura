"use client";

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
      <input
        type="checkbox"
        checked={allSelected}
        onChange={onToggle}
        className="accent-[#c79b5c] h-3.5 w-3.5 cursor-pointer"
      />
      <span className="text-[0.72rem] text-text-muted">
        {selectedCount > 0
          ? `${selectedCount} of ${totalVisible} selected`
          : `Select All (${totalVisible})`}
      </span>
    </div>
  );
}
