import { cn } from "../lib/utils";

interface MeterProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  variant?: "accent" | "phosphor";
  className?: string;
}

export function Meter({
  value,
  max = 100,
  label,
  showValue = false,
  variant = "accent",
  className,
}: MeterProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className="text-label text-text-muted">{label}</span>
          )}
          {showValue && (
            <span className={cn("text-mono-sm", variant === "phosphor" ? "text-phosphor-400 text-glow-phosphor" : "text-text-muted")}>
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      <div className="meter-track">
        <div className={variant === "phosphor" ? "meter-fill-phosphor" : "meter-fill"} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
