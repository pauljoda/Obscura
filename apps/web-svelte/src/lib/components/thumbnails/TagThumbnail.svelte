<script module lang="ts">
  export type TagThumbnailSize = "grid" | "list" | "compact" | "hero";

  /**
   * Stable per-tag HSL gradient derived from the tag name.
   * Exported so callers can match the gradient elsewhere (e.g. in a hero
   * panel) without drifting from the card-grid colors.
   */
  export function gradientFor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 31 + name.charCodeAt(i)) | 0;
    }
    const h1 = Math.abs(hash) % 360;
    const h2 = (h1 + 35) % 360;
    return `linear-gradient(135deg, hsl(${h1} 35% 22%) 0%, hsl(${h2} 40% 14%) 100%)`;
  }
</script>

<script lang="ts">
  import { Star } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import NsfwBlur from "../NsfwBlur.svelte";
  import NsfwShowModeChip from "../NsfwShowModeChip.svelte";

  interface TagThumbLike {
    name: string;
    imagePath?: string | null;
    favorite?: boolean | null;
    isNsfw?: boolean | null;
    videoCount?: number | null;
    imageCount?: number | null;
    galleryCount?: number | null;
    audioTrackCount?: number | null;
  }

  interface Props {
    tag: TagThumbLike;
    size?: TagThumbnailSize;
    aspectClass?: string;
    loading?: "eager" | "lazy";
    class?: string;
    /** When true, show the large tag name + usage counter centered over the image/gradient. */
    showLabel?: boolean;
    muted?: boolean;
    cacheBust?: string | null;
  }

  let {
    tag,
    size = "grid",
    aspectClass,
    loading = "lazy",
    class: className,
    showLabel = true,
    muted = false,
    cacheBust = null,
  }: Props = $props();

  const imageSrc = $derived(toApiUrl(tag.imagePath, cacheBust ?? undefined));
  const gradient = $derived(gradientFor(tag.name));

  const usage = $derived(
    (tag.videoCount ?? 0) +
      (tag.imageCount ?? 0) +
      (tag.galleryCount ?? 0) +
      (tag.audioTrackCount ?? 0),
  );

  const aspect = $derived.by(() => {
    if (aspectClass) return aspectClass;
    switch (size) {
      case "compact":
        return "aspect-square";
      case "list":
        return "aspect-square";
      case "hero":
        return "aspect-[4/3]";
      case "grid":
      default:
        return "aspect-[4/3]";
    }
  });
</script>

<div
  class={cn("tag-thumb group", aspect, muted && "tag-thumb-muted", className)}
  style:--tag-gradient={gradient}
  title={showLabel ? undefined : tag.name}
>
  <NsfwBlur isNsfw={tag.isNsfw ?? false} class="absolute inset-0">
    {#if imageSrc}
      <img
        src={imageSrc}
        alt=""
        {loading}
        decoding="async"
        class="tag-thumb-image"
      />
      <div class="tag-thumb-scrim"></div>
    {/if}
  </NsfwBlur>

  {#if showLabel && size !== "compact"}
    <div class="tag-thumb-content">
      <span class="tag-thumb-name">{tag.name}</span>
      {#if usage > 0}
        <span class="tag-thumb-meta">
          {usage.toLocaleString()}
          <span class="tag-thumb-meta-label">{usage === 1 ? "use" : "uses"}</span>
        </span>
      {/if}
    </div>
  {/if}

  {#if tag.favorite}
    <Star
      class="pointer-events-none absolute left-1.5 top-1.5 h-3.5 w-3.5 fill-current text-accent-400 drop-shadow-[0_0_6px_rgba(196,154,90,0.8)]"
    />
  {/if}

  <NsfwShowModeChip
    isNsfw={tag.isNsfw ?? false}
    class="pointer-events-none absolute bottom-1 right-1 z-10"
  />
</div>

<style>
  .tag-thumb {
    position: relative;
    display: block;
    border: 1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.08));
    background: var(--tag-gradient);
    overflow: hidden;
    container-type: inline-size;
    transition:
      border-color 0.18s ease,
      box-shadow 0.18s ease;
  }
  .tag-thumb:hover {
    border-color: var(--color-border-accent, #c49a5a);
  }

  .tag-thumb::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(
        circle at 30% 20%,
        rgba(255, 255, 255, 0.1) 0%,
        rgba(0, 0, 0, 0) 55%
      ),
      linear-gradient(165deg, rgba(255, 255, 255, 0.05) 0%, rgba(0, 0, 0, 0.3) 100%);
    pointer-events: none;
    z-index: 1;
  }

  .tag-thumb-image {
    position: absolute;
    inset: 0;
    height: 100%;
    width: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
  }
  .tag-thumb:hover .tag-thumb-image {
    transform: scale(1.04);
  }
  .tag-thumb-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.72) 100%);
    pointer-events: none;
  }

  .tag-thumb-content {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    padding: 0.75rem;
    text-align: center;
    z-index: 2;
  }
  .tag-thumb-name {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    font-family: "Geist", "Inter", system-ui, sans-serif;
    font-size: clamp(0.85rem, 7cqw, 1.6rem);
    font-weight: 600;
    line-height: 1.15;
    letter-spacing: -0.01em;
    color: rgba(255, 255, 255, 0.95);
    text-shadow:
      0 1px 2px rgba(0, 0, 0, 0.55),
      0 2px 14px rgba(0, 0, 0, 0.45);
    word-break: break-word;
  }
  .tag-thumb-meta {
    display: inline-flex;
    align-items: baseline;
    gap: 0.3rem;
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: clamp(0.58rem, 2.6cqw, 0.78rem);
    font-weight: 600;
    color: var(--color-accent-300, #e9cfa3);
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.55);
  }
  .tag-thumb-meta-label {
    font-size: 0.82em;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.55);
  }

  .tag-thumb-muted {
    opacity: 0.72;
  }
  .tag-thumb-muted .tag-thumb-name {
    color: rgba(255, 255, 255, 0.82);
    font-weight: 500;
  }
  .tag-thumb-muted:hover {
    opacity: 1;
  }
</style>
