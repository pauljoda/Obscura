import { cn } from "../lib/utils";

export type LedStatus = "active" | "warning" | "error" | "info" | "idle" | "accent";
export type LedSize = "sm" | "md" | "lg";

interface StatusLedProps {
  status: LedStatus;
  size?: LedSize;
  pulse?: boolean;
  className?: string;
}

const sizeClasses: Record<LedSize, string> = {
  sm: "led-sm",
  md: "",
  lg: "led-lg",
};

const statusClasses: Record<LedStatus, string> = {
  active: "led-active",
  warning: "led-warning",
  error: "led-error",
  info: "led-info",
  idle: "led-idle",
  accent: "led-accent",
};

export function StatusLed({
  status,
  size = "md",
  pulse = false,
  className,
}: StatusLedProps) {
  return (
    <span
      className={cn(
        "led",
        sizeClasses[size],
        statusClasses[status],
        pulse && "led-pulse",
        className
      )}
      role="status"
      aria-label={`Status: ${status}`}
    />
  );
}
