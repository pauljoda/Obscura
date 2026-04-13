"use client";

import { cn } from "@obscura/ui/lib/utils";
import { useNsfw, type NsfwMode } from "./nsfw/nsfw-context";

interface LogoMarkProps {
  className?: string;
  size?: number;
  /** Empty when the parent link/button supplies the accessible name. */
  alt?: string;
}

/**
 * Outer-ring stroke colour per NSFW mode:
 *  off  → default dark ring (subtle brass stroke)
 *  blur → brass accent ring
 *  show → red ring
 */
function ringStyle(mode: NsfwMode) {
  switch (mode) {
    case "show":
      return { stroke: "#dc2626", strokeOpacity: 0.85, glowColor: "rgba(220,38,38,0.25)" };
    case "blur":
      return { stroke: "#c79b5c", strokeOpacity: 0.8, glowColor: "rgba(199,155,92,0.2)" };
    default:
      return { stroke: "#c79b5c", strokeOpacity: 0.2, glowColor: "none" };
  }
}

export function LogoMark({ className, size = 28, alt = "Obscura" }: LogoMarkProps) {
  const { mode } = useNsfw();
  const ring = ringStyle(mode);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      fill="none"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={alt}
    >
      <defs>
        <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ddb477" />
          <stop offset="50%" stopColor="#c79b5c" />
          <stop offset="100%" stopColor="#8c6c32" />
        </linearGradient>
        <radialGradient id="blade-fill" cx="256" cy="256" r="190" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6b5225" />
          <stop offset="45%" stopColor="#c79b5c" />
          <stop offset="100%" stopColor="#ddb477" />
        </radialGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c79b5c" stopOpacity={0.15} />
          <stop offset="100%" stopColor="#c79b5c" stopOpacity={0} />
        </radialGradient>
        <linearGradient id="ring-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d3540" />
          <stop offset="50%" stopColor="#1f2533" />
          <stop offset="100%" stopColor="#11151c" />
        </linearGradient>
      </defs>

      {/* Background glow */}
      <circle cx="256" cy="256" r="240" fill="url(#glow)" />

      {/* Outer housing ring — colour changes per NSFW mode */}
      <circle
        cx="256" cy="256" r="220"
        fill="url(#ring-fill)"
        stroke={ring.stroke}
        strokeOpacity={ring.strokeOpacity}
        strokeWidth={mode === "off" ? 2 : 5}
      />
      {/* Outer glow ring (visible only in non-SFW modes) */}
      {mode !== "off" && (
        <circle
          cx="256" cy="256" r="223"
          fill="none"
          stroke={ring.stroke}
          strokeOpacity={0.35}
          strokeWidth={10}
          style={{ filter: `drop-shadow(0 0 8px ${ring.glowColor})` }}
        />
      )}
      <circle cx="256" cy="256" r="218" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1} />

      {/* Inner dark field */}
      <circle cx="256" cy="256" r="190" fill="#08090c" />

      {/* 6 triangular aperture blades */}
      <polygon points="256,78 278.4,205.8 233.6,205.8" fill="url(#blade-fill)" opacity={0.88} />
      <polygon points="410.2,167 310.7,250.3 288.3,211.5" fill="url(#blade-fill)" opacity={0.88} />
      <polygon points="410.2,345 288.3,300.5 310.7,261.7" fill="url(#blade-fill)" opacity={0.88} />
      <polygon points="256,434 233.6,306.2 278.4,306.2" fill="url(#blade-fill)" opacity={0.88} />
      <polygon points="101.8,345 201.3,261.7 223.7,300.5" fill="url(#blade-fill)" opacity={0.88} />
      <polygon points="101.8,167 223.7,211.5 201.3,250.3" fill="url(#blade-fill)" opacity={0.88} />

      {/* Inner ring — lens element */}
      <circle cx="256" cy="256" r="100" fill="none" stroke="url(#brass)" strokeWidth={2.5} strokeOpacity={0.5} />

      {/* Center circle */}
      <circle cx="256" cy="256" r="80" fill="#08090c" />
      <circle cx="256" cy="256" r="80" fill="none" stroke="#c79b5c" strokeWidth={1.5} strokeOpacity={0.3} />

      {/* Inner accent ring */}
      <circle cx="256" cy="256" r="65" fill="none" stroke="#c79b5c" strokeWidth={0.75} strokeOpacity={0.15} />

      {/* Lens flare highlight */}
      <circle cx="242" cy="242" r="4" fill="#c79b5c" opacity={0.1} />

      {/* Machined tick marks */}
      <g stroke="#c79b5c" strokeOpacity={0.15} strokeWidth={1.5}>
        <line x1="256" y1="38" x2="256" y2="52" />
        <line x1="256" y1="460" x2="256" y2="474" />
        <line x1="38" y1="256" x2="52" y2="256" />
        <line x1="460" y1="256" x2="474" y2="256" />
        <line x1="102.1" y1="102.1" x2="112" y2="112" />
        <line x1="409.9" y1="102.1" x2="400" y2="112" />
        <line x1="102.1" y1="409.9" x2="112" y2="400" />
        <line x1="409.9" y1="409.9" x2="400" y2="400" />
      </g>
    </svg>
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
