<script module lang="ts">
  export type VideoCardVariant = "grid" | "list" | "compact";
</script>

<script lang="ts">
  import { Captions, Clock, Eye, Film, HardDrive, Star } from "@lucide/svelte";
  import { cn, Checkbox } from "@obscura/ui-svelte";
  import NsfwBlur from "./NsfwBlur.svelte";
  import NsfwShowModeChip from "./NsfwShowModeChip.svelte";
  import NsfwText from "./NsfwText.svelte";
  import NsfwTagLabel from "./NsfwTagLabel.svelte";
  import { VIDEO_TAG_COLORS } from "$lib/video-tag-colors";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";
  import { tagsVisibleInNsfwMode } from "$lib/nsfw-tags";
  import { useNsfw } from "$lib/stores/nsfw.svelte";
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
</script>

{#if variant === "list"}
  <a href={video.href} class="block">
    <div class="surface-card-sharp group flex items-center gap-3 px-3 py-2 cursor-pointer">
      {#if onToggleSelect}
        <!-- svelte-ignore a11y_consider_explicit_label -->
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
        <div
          class={cn(
            "relative w-28 flex-shrink-0 aspect-video overflow-hidden",
            VIDEO_CARD_GRADIENTS[index % VIDEO_CARD_GRADIENTS.length],
          )}
        >
          {#if video.thumbnail}
            <img
              src={video.cardThumbnail || video.thumbnail}
              alt={video.title}
              loading={index < 6 ? "eager" : "lazy"}
              decoding="async"
              class="h-full w-full object-cover"
            />
          {/if}
          <div
            class="pointer-events-none absolute bottom-1 right-1 z-10 flex flex-col items-end gap-0.5"
          >
            <NsfwShowModeChip isNsfw={video.isNsfw} />
            {#if video.hasSubtitles}
              <span
                class="inline-flex items-center gap-0.5 bg-black/70 text-accent-100 border border-accent-500/40 px-1 py-px text-[0.5rem] font-mono uppercase tracking-[0.12em]"
                title="Closed captions available"
              >
                <Captions class="h-2.5 w-2.5" />
                CC
              </span>
            {/if}
            {#if video.duration}
              <span class="text-[0.55rem] font-mono bg-black/70 text-white/80 px-1">
                {video.duration}
              </span>
            {/if}
          </div>
        </div>
      </NsfwBlur>

      <div class="flex-1 min-w-0 space-y-1">
        <div class="flex items-center gap-2 min-w-0">
          <NsfwText
            isNsfw={video.isNsfw ?? false}
            class="truncate text-[0.8rem] font-medium text-text-primary block"
          >
            {#snippet children()}{video.title}{/snippet}
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
      <div
        class={cn(
          "shrink-0 overflow-hidden bg-surface-1 flex items-center justify-center h-8 w-12",
          !video.thumbnail && VIDEO_CARD_GRADIENTS[0],
        )}
      >
        {#if video.cardThumbnail || video.thumbnail}
          <img
            src={video.cardThumbnail || video.thumbnail}
            alt=""
            class="h-full w-full object-cover"
          />
        {:else}
          <Film class="h-3.5 w-3.5 text-text-disabled" />
        {/if}
      </div>
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
      <div
        class={cn(
          "shrink-0 overflow-hidden bg-surface-1 flex items-center justify-center h-8 w-12",
          !video.thumbnail && VIDEO_CARD_GRADIENTS[0],
        )}
      >
        {#if video.cardThumbnail || video.thumbnail}
          <img
            src={video.cardThumbnail || video.thumbnail}
            alt=""
            class="h-full w-full object-cover"
          />
        {:else}
          <Film class="h-3.5 w-3.5 text-text-disabled" />
        {/if}
      </div>
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
      <article class="surface-card-sharp media-card-shell group h-full overflow-hidden">
        <div
          class={cn(
            "relative aspect-video overflow-hidden bg-surface-1",
            !video.thumbnail && VIDEO_CARD_GRADIENTS[index % VIDEO_CARD_GRADIENTS.length],
          )}
        >
          {#if video.thumbnail}
            <img
              src={video.cardThumbnail || video.thumbnail}
              alt={video.title}
              loading={imageLoading}
              decoding="async"
              class="h-full w-full object-cover transition-transform duration-normal group-hover:scale-[1.03]"
            />
          {:else}
            <div class="flex h-full w-full items-center justify-center">
              <Film class="h-7 w-7 text-white/10" />
            </div>
          {/if}

          <div
            class="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/70 to-transparent pointer-events-none"
          ></div>

          {#if video.duration}
            <span
              class="absolute bottom-1.5 left-1.5 flex items-center gap-1 media-chip px-1.5 py-0.5 text-[0.65rem] font-mono text-white/90"
            >
              <Clock class="h-2.5 w-2.5 text-white/60" />
              {video.duration}
            </span>
          {/if}

          <div class="absolute top-1.5 right-1.5 flex items-center gap-1">
            {#if video.hasSubtitles}
              <span
                class="media-chip flex items-center gap-0.5 px-1.5 py-0.5 text-[0.58rem] font-mono text-accent-100 border-accent-500/40"
                title="Closed captions available"
              >
                <Captions class="h-2.5 w-2.5" />
                CC
              </span>
            {/if}
            {#if video.resolution}
              <span class="pill-accent px-1.5 py-0.5 text-[0.58rem] font-semibold tracking-wide">
                {video.resolution}
              </span>
            {/if}
            {#if video.codec}
              <span class="media-chip px-1.5 py-0.5 text-[0.58rem] font-mono text-white/70">
                {video.codec}
              </span>
            {/if}
          </div>

          <div class="pointer-events-none absolute right-2 bottom-2 z-[25]">
            <NsfwShowModeChip isNsfw={video.isNsfw} />
          </div>

          {#if video.episodeNumber != null}
            <div class="pointer-events-none absolute left-1.5 top-1.5 z-[25]">
              <span class="bg-bg/80 px-1 py-0.5 font-mono text-[0.55rem] text-text-muted">
                {video.seasonNumber != null
                  ? `S${String(video.seasonNumber).padStart(2, "0")}E${String(video.episodeNumber).padStart(2, "0")}`
                  : `E${String(video.episodeNumber).padStart(2, "0")}`}
              </span>
            </div>
          {/if}
        </div>

        <div class="p-2.5 space-y-1.5">
          <NsfwText
            isNsfw={video.isNsfw ?? false}
            class="truncate text-[0.8rem] font-medium text-text-primary leading-tight block"
          >
            {#snippet children()}{video.title}{/snippet}
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
