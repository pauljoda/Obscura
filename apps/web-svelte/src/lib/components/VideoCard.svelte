<script module lang="ts">
  export type VideoCardVariant = "grid" | "list" | "compact";
</script>

<script lang="ts">
  import { Captions, Clock, Eye, Film, HardDrive, Star } from "@lucide/svelte";
  import { cn, Checkbox } from "@obscura/ui-svelte";
  import NsfwBlur from "./nsfw/NsfwBlur.svelte";
  import NsfwShowModeChip from "./nsfw/NsfwShowModeChip.svelte";
  import NsfwText from "./nsfw/NsfwText.svelte";
  import NsfwTagLabel from "./nsfw/NsfwTagLabel.svelte";
  import EntityThumbnail from "$lib/v1/components/thumbnails/EntityThumbnailV1.svelte";
  import { VIDEO_TAG_COLORS } from "$lib/video-tag-colors";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";
  import { tagsVisibleInNsfwMode } from "$lib/nsfw/tags";
  import { useNsfw } from "$lib/nsfw/store.svelte";
  import type { VideoCardData } from "$lib/video-card-data";

  interface Props {
    video: VideoCardData;
    variant?: VideoCardVariant;
    index?: number;
    imageLoading?: "eager" | "lazy";
    onSelect?: (href: string) => void;
    selected?: boolean;
    onToggleSelect?: (id: string) => void;
  }

  let {
    video,
    variant = "grid",
    index = 0,
    imageLoading = "lazy",
    onSelect,
    selected,
    onToggleSelect,
  }: Props = $props();

  const nsfw = useNsfw();
  const tagRow = $derived(tagsVisibleInNsfwMode(video.tags, nsfw.mode));
  const performersRow = $derived(
    tagsVisibleInNsfwMode(video.performers ?? [], nsfw.mode).map((p) => ({
      name: p.name,
      imagePath: p.imagePath,
    })),
  );
  const thumbnailGradient = $derived(VIDEO_CARD_GRADIENTS[index % VIDEO_CARD_GRADIENTS.length]);
</script>

{#if variant === "list"}
  <a href={video.href} class="block">
    <div class="surface-card-sharp group flex items-center gap-3 px-3 py-2 cursor-pointer">
      {#if onToggleSelect}
        <div
          onclick={(e) => e.stopPropagation()}
          role="presentation"
          class="flex-shrink-0"
        >
          <Checkbox
            checked={selected ?? false}
            onchange={(e) => {
              e.preventDefault();
              onToggleSelect?.(video.id);
            }}
          />
        </div>
      {/if}
      <NsfwBlur isNsfw={video.isNsfw ?? false}>
        <EntityThumbnail
          kind="video"
          {video}
          imageLoading={index < 6 ? "eager" : "lazy"}
          size="list"
          gradientFallback={thumbnailGradient}
        />
      </NsfwBlur>

      <div class="flex-1 min-w-0 space-y-1">
        <div class="flex items-center gap-2 min-w-0">
          <NsfwText
            isNsfw={video.isNsfw ?? false}
            class="truncate text-[0.8rem] font-medium text-text-primary block"
          >
            {video.title}
          </NsfwText>
          {#if video.resolution}
            <span class="pill-accent px-1 py-0 text-[0.55rem] font-semibold flex-shrink-0">
              {video.resolution}
            </span>
          {/if}
          {#if video.codec}
            <span class="text-[0.55rem] font-mono text-text-disabled flex-shrink-0">
              {video.codec}
            </span>
          {/if}
        </div>

        {#if performersRow.length > 0}
          <div class="flex items-center gap-2 text-[0.7rem] text-text-muted">
            <span class="inline-flex items-center gap-1.5 truncate">
              {#each performersRow.slice(0, 3) as p (p.name)}
                <span class="inline-flex items-center gap-1">
                  {#if p.imagePath}
                    <span class="h-4 w-3 flex-shrink-0 overflow-hidden">
                      <img
                        src={p.imagePath}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        class="h-4 w-3 object-cover"
                      />
                    </span>
                  {/if}
                  <span>{p.name}</span>
                </span>
              {/each}
              {#if performersRow.length > 3}
                <span class="text-text-disabled">+{performersRow.length - 3}</span>
              {/if}
            </span>
          </div>
        {/if}

        {#if tagRow.length > 0}
          <div class="hidden sm:flex flex-wrap gap-1">
            {#each tagRow.slice(0, 4) as tag (tag.name)}
              <span class={cn("tag-chip", VIDEO_TAG_COLORS[tag.name] || "tag-chip-default")}>
                <NsfwTagLabel isNsfw={tag.isNsfw} text={tag.name} />
              </span>
            {/each}
          </div>
        {/if}
      </div>

      <div
        class="hidden md:flex items-center gap-4 text-[0.65rem] text-text-disabled flex-shrink-0"
      >
        {#if video.rating != null && video.rating > 0}
          <span class="flex items-center gap-0.5 text-glow-accent">
            <Star class="h-3 w-3 fill-current" />
            {Math.round(video.rating / 20)}
          </span>
        {/if}
        {#if video.fileSize}
          <span class="flex items-center gap-1 text-ephemeral">
            <HardDrive class="h-3 w-3" />
            {video.fileSize}
          </span>
        {/if}
        {#if video.views != null && video.views > 0}
          <span class="flex items-center gap-1 text-ephemeral">
            <Eye class="h-3 w-3" />
            {video.views}
          </span>
        {/if}
        {#if video.duration}
          <span class="flex items-center gap-1 text-ephemeral">
            <Clock class="h-3 w-3" />
            {video.duration}
          </span>
        {/if}
      </div>
    </div>
  </a>
{:else if variant === "compact"}
  {#if onSelect}
    <button
      type="button"
      onclick={() => onSelect?.(video.href)}
      class="flex items-center gap-3 w-full px-4 py-2 hover:bg-surface-2 transition-colors duration-fast text-left"
    >
      <EntityThumbnail
        kind="video"
        {video}
        size="compact"
        gradientFallback={thumbnailGradient}
      />
      <div class="flex-1 min-w-0">
        <div class="text-sm text-text-primary truncate">{video.title}</div>
        <div class="text-[0.68rem] text-text-muted truncate">
          {[video.studio, video.duration].filter(Boolean).join(" · ") || "Video"}
        </div>
      </div>
      <span class="shrink-0 tag-chip tag-chip-default text-[0.6rem]">video</span>
    </button>
  {:else}
    <a
      href={video.href}
      class="flex items-center gap-3 w-full px-4 py-2 hover:bg-surface-2 transition-colors duration-fast text-left"
    >
      <EntityThumbnail
        kind="video"
        {video}
        size="compact"
        gradientFallback={thumbnailGradient}
      />
      <div class="flex-1 min-w-0">
        <div class="text-sm text-text-primary truncate">{video.title}</div>
        <div class="text-[0.68rem] text-text-muted truncate">
          {[video.studio, video.duration].filter(Boolean).join(" · ") || "Video"}
        </div>
      </div>
      <span class="shrink-0 tag-chip tag-chip-default text-[0.6rem]">video</span>
    </a>
  {/if}
{:else}
  <!-- grid (default) -->
  <NsfwBlur isNsfw={video.isNsfw ?? false} class="h-full">
    <a href={video.href} class="block h-full">
      <article class="surface-card-sharp media-card-shell group relative h-full overflow-hidden">
        {#if onToggleSelect}
          <div
            onclick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            role="presentation"
            class="absolute left-2 top-2 z-20 glass-2 border border-border-subtle p-1 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
          >
            <Checkbox
              checked={selected ?? false}
              onchange={(e) => {
                e.preventDefault();
                onToggleSelect?.(video.id);
              }}
            />
          </div>
        {/if}
        <EntityThumbnail
          kind="video"
          {video}
          {imageLoading}
          size="grid"
          gradientFallback={thumbnailGradient}
        />

        <div class="p-2.5 space-y-1.5">
          <NsfwText
            isNsfw={video.isNsfw ?? false}
            class="truncate text-[0.8rem] font-medium text-text-primary leading-tight block"
          >
            {video.title}
          </NsfwText>

          {#if video.studio || performersRow.length > 0}
            <div class="flex items-center gap-1.5 text-text-muted min-w-0">
              {#if video.studio}
                <span class="text-[0.7rem] text-text-accent truncate flex-shrink-0">
                  {video.studio}
                </span>
              {/if}
              {#if video.studio && performersRow.length}
                <span class="text-text-disabled text-[0.6rem]">/</span>
              {/if}
              {#if performersRow.length > 0}
                <span class="inline-flex items-center gap-1 text-[0.7rem] truncate">
                  {#each performersRow.slice(0, 2) as p, performerIndex (p.name)}
                    <span class="inline-flex items-center gap-1">
                      {#if performerIndex > 0}
                        <span class="text-text-disabled">,</span>
                      {/if}
                      <span>{p.name}</span>
                    </span>
                  {/each}
                  {#if performersRow.length > 2}
                    <span class="text-text-disabled">+{performersRow.length - 2}</span>
                  {/if}
                </span>
              {/if}
            </div>
          {/if}

          {#if tagRow.length > 0}
            <div class="flex flex-wrap gap-1">
              {#each tagRow.slice(0, 3) as tag (tag.name)}
                <span class={cn("tag-chip", VIDEO_TAG_COLORS[tag.name] || "tag-chip-default")}>
                  <NsfwTagLabel isNsfw={tag.isNsfw} text={tag.name} />
                </span>
              {/each}
              {#if tagRow.length > 3}
                <span class="tag-chip tag-chip-default text-text-disabled">
                  +{tagRow.length - 3}
                </span>
              {/if}
            </div>
          {/if}

          {#if video.fileSize || video.views !== undefined || (video.rating != null && video.rating > 0)}
            <div class="flex items-center gap-3 pt-1 border-t border-border-subtle">
              {#if video.rating != null && video.rating > 0}
                <span class="flex items-center gap-0.5 text-[0.62rem] text-glow-accent">
                  <Star class="h-2.5 w-2.5 fill-current" />
                  {Math.round(video.rating / 20)}
                </span>
              {/if}
              {#if video.fileSize}
                <span class="flex items-center gap-1 text-ephemeral">
                  <HardDrive class="h-2.5 w-2.5" />
                  {video.fileSize}
                </span>
              {/if}
              {#if video.views !== undefined}
                <span class="flex items-center gap-1 text-ephemeral">
                  <Eye class="h-2.5 w-2.5" />
                  {video.views}
                </span>
              {/if}
            </div>
          {/if}
        </div>
      </article>
    </a>
  </NsfwBlur>
{/if}
