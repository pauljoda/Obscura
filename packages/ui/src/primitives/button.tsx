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
        primary: [
          "bg-gradient-to-b from-accent-400 to-accent-500 text-accent-950 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_0_12px_rgba(199,155,92,0.12)]",
          "hover:from-accent-300 hover:to-accent-400 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_18px_rgba(199,155,92,0.18)]",
          "active:from-accent-500 active:to-accent-600 active:shadow-none",
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
          "hover:bg-error/20 hover:text-error-text",
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
