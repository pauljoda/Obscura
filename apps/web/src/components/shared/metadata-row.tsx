import type { LucideIcon } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";

export interface MetadataRowProps {
  label: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

export function MetadataRow({
  label,
  icon: Icon,
  children,
  className,
}: MetadataRowProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 py-2.5 border-b border-border-subtle last:border-b-0",
        className
      )}
    >
      <div className="flex items-center gap-2 w-28 flex-shrink-0 pt-0.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-text-disabled" />}
        <span className="text-xs text-text-muted font-medium">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
