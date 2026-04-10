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

// Visual state is driven directly by the `checked` / `indeterminate`
// props rather than `peer-checked:` CSS selectors. The peer-based
// approach is fragile when the checkbox lives inside other interactive
// wrappers (e.g. a Link acting as a row) because the browser's
// :checked state and React's controlled value can desync for a frame
// and the arbitrary-variant combinations occasionally escape Tailwind's
// class scanner. Prop-driven classes are simpler and deterministic.

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
  ].join(" "),
  {
    variants: {
      size: {
        sm: "h-3.5 w-3.5",
        md: "h-4 w-4",
      },
      state: {
        unchecked: "border-border-subtle bg-surface-3",
        checked:
          "border-border-accent bg-accent-500 shadow-[0_0_6px_rgba(199,155,92,0.35)]",
      },
      disabled: {
        true: "cursor-not-allowed opacity-40",
        false: "",
      },
    },
    defaultVariants: {
      size: "sm",
      state: "unchecked",
      disabled: false,
    },
  },
);

const iconVariants = cva(
  "text-surface-1 transition-opacity duration-fast pointer-events-none",
  {
    variants: {
      size: {
        sm: "h-2.5 w-2.5",
        md: "h-3 w-3",
      },
      visible: {
        true: "opacity-100",
        false: "opacity-0",
      },
    },
    defaultVariants: {
      size: "sm",
      visible: false,
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
  ({ className, size, disabled, indeterminate, checked, ...props }, ref) => {
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
    }, [indeterminate, checked]);

    const isChecked = Boolean(checked);

    return (
      <div className={cn(rootVariants({ size }), className)}>
        <input
          ref={setRefs}
          type="checkbox"
          disabled={disabled}
          checked={isChecked}
          className="absolute inset-0 z-10 m-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          {...props}
        />
        <span
          className={boxVariants({
            size,
            state: isChecked ? "checked" : "unchecked",
            disabled: Boolean(disabled),
          })}
          aria-hidden
        >
          <Check
            className={iconVariants({ size, visible: isChecked })}
            strokeWidth={3}
          />
        </span>
      </div>
    );
  },
);
Checkbox.displayName = "Checkbox";
