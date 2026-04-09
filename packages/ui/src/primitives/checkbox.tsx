import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  type InputHTMLAttributes,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Check } from "lucide-react";
import { cn } from "../lib/utils";

const rootVariants = cva("relative inline-flex shrink-0 items-center justify-center", {
  variants: {
    size: {
      sm: "h-3.5 w-3.5",
      md: "h-4 w-4",
    },
  },
  defaultVariants: {
    size: "sm",
  },
});

const boxVariants = cva(
  [
    "pointer-events-none flex items-center justify-center rounded-none border transition-all duration-fast",
    "border-border-subtle bg-surface-3",
    "peer-checked:border-border-accent peer-checked:bg-accent-500",
    "peer-checked:shadow-[0_0_6px_rgba(199,155,92,0.35)]",
    "peer-focus-visible:ring-2 peer-focus-visible:ring-accent-500/30 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-bg",
    "peer-disabled:cursor-not-allowed peer-disabled:opacity-40",
    "peer-checked:[&>svg]:opacity-100",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "h-3.5 w-3.5",
        md: "h-4 w-4",
      },
    },
    defaultVariants: {
      size: "sm",
    },
  },
);

const iconVariants = cva(
  "text-surface-1 opacity-0 transition-opacity duration-fast pointer-events-none",
  {
    variants: {
      size: {
        sm: "h-2.5 w-2.5",
        md: "h-3 w-3",
      },
    },
    defaultVariants: {
      size: "sm",
    },
  },
);

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size" | "indeterminate">,
    VariantProps<typeof rootVariants> {
  /** Sets the native `indeterminate` state (not controlled via HTML attribute). */
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, size, disabled, indeterminate, ...props }, ref) => {
    const innerRef = useRef<HTMLInputElement>(null);

    const setRefs = useCallback(
      (el: HTMLInputElement | null) => {
        innerRef.current = el;
        if (typeof ref === "function") {
          ref(el);
        } else if (ref) {
          ref.current = el;
        }
      },
      [ref],
    );

    useEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      el.indeterminate = indeterminate === true;
    }, [indeterminate, props.checked]);

    return (
      <div className={cn(rootVariants({ size }), className)}>
        <input
          ref={setRefs}
          type="checkbox"
          disabled={disabled}
          className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...props}
        />
        <span className={boxVariants({ size })} aria-hidden>
          <Check className={iconVariants({ size })} strokeWidth={3} />
        </span>
      </div>
    );
  },
);
Checkbox.displayName = "Checkbox";
