import { Checkbox } from "@obscura/ui/primitives/checkbox";
import { cn } from "@obscura/ui/lib/utils";

interface ScrapeFieldProps {
  field: string;
  label: string;
  value: string;
  enabled: boolean;
  onToggle: () => void;
}

/**
 * A toggleable field row used in scrape/identify result previews.
 * Shows a checkbox, label, and value — user can toggle which fields to accept.
 */
export function ScrapeField({ field, label, value, enabled, onToggle }: ScrapeFieldProps) {
  return (
    <div
      className={cn("flex items-start gap-2 cursor-pointer transition-opacity", !enabled && "opacity-40")}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
    >
      <Checkbox
        checked={enabled}
        onChange={() => onToggle()}
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5 flex-shrink-0"
      />
      <div className="min-w-0">
        <span className="text-text-disabled text-[0.6rem] uppercase tracking-wider font-semibold">{label}</span>
        <p className={cn("truncate text-[0.78rem]", enabled ? "text-text-primary" : "text-text-disabled line-through")}>{value}</p>
      </div>
    </div>
  );
}
