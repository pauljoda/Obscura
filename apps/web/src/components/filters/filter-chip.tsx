import { X } from "lucide-react";

interface FilterChipProps {
  label: string;
  value: string;
  onRemove?: () => void;
}

export function FilterChip({ label, value, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex items-center gap-1 pill-accent px-2 py-0.5 text-[0.68rem] whitespace-nowrap">
      <span className="text-accent-400/70">{label}:</span>
      <span className="text-accent-200">{value}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 text-accent-400/50 hover:text-accent-200 transition-colors duration-fast"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}
