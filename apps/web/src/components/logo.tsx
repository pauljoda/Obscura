import { cn } from "@obscura/ui";

interface LogoMarkProps {
  className?: string;
  size?: number;
}

export function LogoMark({ className, size = 28 }: LogoMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      width={size}
      height={size}
      className={className}
    >
      <defs>
        <linearGradient id="logo-brass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d4af74" />
          <stop offset="100%" stopColor="#8c6c32" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14" fill="#0d1017" stroke="url(#logo-brass)" strokeWidth="1" strokeOpacity="0.35" />
      <polygon points="16,4 19,11 16,9.5 13,11" fill="url(#logo-brass)" opacity="0.85" />
      <polygon points="26.4,9.6 23,14 21.3,12 22.5,9.8" fill="url(#logo-brass)" opacity="0.7" />
      <polygon points="27.4,22 23,22.3 21.3,20 23,17.5" fill="url(#logo-brass)" opacity="0.6" />
      <polygon points="16,28 13,21 16,22.5 19,21" fill="url(#logo-brass)" opacity="0.85" />
      <polygon points="5.6,22.4 9,18 10.7,20 9.5,22.2" fill="url(#logo-brass)" opacity="0.7" />
      <polygon points="4.6,10 9,9.7 10.7,12 9,14.5" fill="url(#logo-brass)" opacity="0.6" />
      <circle cx="16" cy="16" r="4.5" fill="#08090c" />
      <circle cx="16" cy="16" r="4.5" fill="none" stroke="#c79b5c" strokeWidth="0.75" strokeOpacity="0.4" />
    </svg>
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
