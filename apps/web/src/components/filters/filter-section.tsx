import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface FilterSectionProps {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
}

export function FilterSection({ title, icon: Icon, children }: FilterSectionProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-kicker mb-2">
        {Icon && <Icon className="h-3 w-3 text-text-disabled" />}
        {title}
      </div>
      {children}
    </div>
  );
}
