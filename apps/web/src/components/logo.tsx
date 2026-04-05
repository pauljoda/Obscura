import { cn } from "@obscura/ui/lib/utils";

interface LogoMarkProps {
  className?: string;
  size?: number;
}

export function LogoMark({ className, size = 28 }: LogoMarkProps) {
  return (
    <img
      src="/logo.svg"
      alt="Obscura"
      width={size}
      height={size}
      className={className}
    />
  );
}

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: number;
  textClassName?: string;
}

export function Logo({ className, showText = true, size = 28, textClassName }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      <LogoMark size={size} />
      {showText && (
        <span className={cn(
          "font-semibold tracking-[0.15em] uppercase bg-gradient-to-r from-accent-300 via-accent-400 to-accent-600 bg-clip-text text-transparent",
          textClassName ?? "text-[0.72rem]"
        )}>
          Obscura
        </span>
      )}
    </div>
  );
}
