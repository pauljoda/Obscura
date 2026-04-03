import { cn } from "../lib/utils";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "panel" | "well" | "elevated";
}

export function Panel({
  variant = "panel",
  className,
  children,
  ...props
}: PanelProps) {
  return (
    <div
      className={cn(
        variant === "panel" && "surface-panel",
        variant === "well" && "surface-well",
        variant === "elevated" && "surface-elevated",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
