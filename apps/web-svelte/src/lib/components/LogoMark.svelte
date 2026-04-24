<script lang="ts">
  import { useNsfw } from "$lib/stores/nsfw.svelte";
  import type { NsfwMode } from "$lib/nsfw-cookie";

  interface Props {
    class?: string;
    size?: number;
    alt?: string;
  }

  let { class: className, size = 28, alt = "Obscura" }: Props = $props();
  const nsfw = useNsfw();

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

  const ring = $derived(ringStyle(nsfw.mode));
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 512 512"
  fill="none"
  width={size}
  height={size}
  class={className}
  role="img"
  aria-label={alt}
>
  <defs>
    <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ddb477" />
      <stop offset="50%" stop-color="#c79b5c" />
      <stop offset="100%" stop-color="#8c6c32" />
    </linearGradient>
    <radialGradient id="blade-fill" cx="256" cy="256" r="190" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6b5225" />
      <stop offset="45%" stop-color="#c79b5c" />
      <stop offset="100%" stop-color="#ddb477" />
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#c79b5c" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#c79b5c" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="ring-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3d3540" />
      <stop offset="50%" stop-color="#1f2533" />
      <stop offset="100%" stop-color="#11151c" />
    </linearGradient>
  </defs>

  <circle cx="256" cy="256" r="240" fill="url(#glow)" />

  <circle
    cx="256" cy="256" r="220"
    fill="url(#ring-fill)"
    stroke={ring.stroke}
    stroke-opacity={ring.strokeOpacity}
    stroke-width={nsfw.mode === "off" ? 2 : 5}
  />
  {#if nsfw.mode !== "off"}
    <circle
      cx="256" cy="256" r="223"
      fill="none"
      stroke={ring.stroke}
      stroke-opacity="0.35"
      stroke-width="10"
      style:filter="drop-shadow(0 0 8px {ring.glowColor})"
    />
  {/if}
  <circle cx="256" cy="256" r="218" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1" />

  <circle cx="256" cy="256" r="190" fill="#08090c" />

  <polygon points="256,78 278.4,205.8 233.6,205.8" fill="url(#blade-fill)" opacity="0.88" />
  <polygon points="410.2,167 310.7,250.3 288.3,211.5" fill="url(#blade-fill)" opacity="0.88" />
  <polygon points="410.2,345 288.3,300.5 310.7,261.7" fill="url(#blade-fill)" opacity="0.88" />
  <polygon points="256,434 233.6,306.2 278.4,306.2" fill="url(#blade-fill)" opacity="0.88" />
  <polygon points="101.8,345 201.3,261.7 223.7,300.5" fill="url(#blade-fill)" opacity="0.88" />
  <polygon points="101.8,167 223.7,211.5 201.3,250.3" fill="url(#blade-fill)" opacity="0.88" />

  <circle cx="256" cy="256" r="100" fill="none" stroke="url(#brass)" stroke-width="2.5" stroke-opacity="0.5" />
  <circle cx="256" cy="256" r="80" fill="#08090c" />
  <circle cx="256" cy="256" r="80" fill="none" stroke="#c79b5c" stroke-width="1.5" stroke-opacity="0.3" />
  <circle cx="256" cy="256" r="65" fill="none" stroke="#c79b5c" stroke-width="0.75" stroke-opacity="0.15" />
  <circle cx="242" cy="242" r="4" fill="#c79b5c" opacity="0.1" />

  <g stroke="#c79b5c" stroke-opacity="0.15" stroke-width="1.5">
    <line x1="256" y1="38" x2="256" y2="52" />
    <line x1="256" y1="460" x2="256" y2="474" />
    <line x1="38" y1="256" x2="52" y2="256" />
    <line x1="460" y1="256" x2="474" y2="256" />
  </g>
</svg>
