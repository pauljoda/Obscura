import { cn } from "../lib/utils";

interface MeterProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  className?: string;
}

export function Meter({
  value,
  max = 100,
  label,
  showValue = false,
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
            <span className="text-mono-sm text-text-muted">
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
