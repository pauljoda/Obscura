import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 font-medium",
    "transition-all duration-fast",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/20 focus-visible:ring-offset-1 focus-visible:ring-offset-bg",
    "disabled:pointer-events-none disabled:opacity-40",
  ].join(" "),
  {
    variants: {
      variant: {
        /** Brass control-plate primary — matches Dark Room hardware actions (not flat SaaS fill). */
        primary: [
          "border border-border-accent bg-gradient-to-r from-accent-900 via-accent-800 to-accent-900",
          "text-accent-200 font-medium shadow-[var(--shadow-glow-accent)]",
          "hover:from-accent-800 hover:via-accent-700 hover:to-accent-800 hover:shadow-[var(--shadow-glow-accent-strong)]",
          "active:from-accent-950 active:via-accent-900 active:to-accent-950 active:shadow-[inset_0_2px_8px_rgba(0,0,0,0.45)]",
        ].join(" "),
        secondary: [
          "surface-card text-text-secondary",
          "hover:text-text-primary hover:border-border-accent",
        ].join(" "),
        ghost: [
          "text-text-muted bg-transparent",
          "hover:text-text-primary hover:bg-surface-2",
        ].join(" "),
        danger: [
          "bg-error-muted text-error-text border border-error/20",
          "hover:bg-error/10 hover:text-error-text",
        ].join(" "),
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        md: "h-8 px-3.5 text-sm",
        lg: "h-10 px-5 text-sm",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
