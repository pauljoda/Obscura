import { cn } from "@obscura/ui/lib/utils";

interface StatusMessageProps {
  type: "error" | "success";
  message: string | null | undefined;
  className?: string;
}

/**
 * Inline status banner used for form feedback (errors, success confirmations).
 * Renders nothing when message is falsy.
 */
export function StatusMessage({ type, message, className }: StatusMessageProps) {
  if (!message) return null;

  return (
    <div
      className={cn(
        "surface-well border-l-2 px-3 py-2 text-sm",
        type === "error" && "border-status-error text-status-error",
        type === "success" && "border-status-success text-status-success",
        className,
      )}
    >
      {message}
    </div>
  );
}
