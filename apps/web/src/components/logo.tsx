import { cn } from "@obscura/ui";

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
}

export function Logo({ className, showText = true, size = 28 }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5 select-none", className)}>
      <LogoMark size={size} />
      {showText && (
        <span className="text-[0.72rem] font-semibold tracking-[0.15em] uppercase bg-gradient-to-r from-accent-300 via-accent-400 to-accent-600 bg-clip-text text-transparent">
          Obscura
        </span>
      )}
    </div>
  );
}
