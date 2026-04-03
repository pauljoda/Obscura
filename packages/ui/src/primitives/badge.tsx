import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border",
  {
    variants: {
      variant: {
        default:
          "bg-surface-2 border-border-subtle text-text-secondary",
        accent:
          "bg-accent-950 border-accent-500/20 text-accent-400",
        success:
          "bg-success-muted/30 border-success/20 text-success-text",
        warning:
          "bg-warning-muted/30 border-warning/20 text-warning-text",
        error:
          "bg-error-muted/30 border-error/20 text-error-text",
        info:
          "bg-info-muted/30 border-info/20 text-info-text",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
