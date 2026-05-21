<script lang="ts">
  import type { Snippet } from "svelte";
  import {
    Album,
    BookOpen,
    Building2,
    Calendar,
    Clock3,
    Disc3,
    Film,
    Flame,
    FolderOpen,
    Hash,
    Image,
    Images,
    Layers,
    Music,
    Star,
    Tag,
    Users,
  } from "@lucide/svelte";
  import { getRatingValue, isNsfw } from "$lib/api/capabilities";
  import OverflowTicker from "$lib/components/OverflowTicker.svelte";
  import {
    getThumbnailAsset,
    hasHoverPreview,
    iconForKind,
    placeholderGradient,
    resolveEntityThumbnailHref,
    toAspectRatioValue,
    type EntityThumbnailCard,
    type EntityThumbnailMetaIcon,
  } from "$lib/entities/entity-thumbnail";
  import { ENTITY_KIND } from "$lib/entities/v2-codes";
  import { loadTrickplayFrames, type TrickplayFrame } from "@obscura/ui-svelte";

  type EntityThumbnailTitleAlign = "left" | "center" | "right";
  type EntityThumbnailTitleSize = "default" | "compact";

  interface Props {
    card: EntityThumbnailCard;
    layout?: "grid" | "list";
    linkable?: boolean;
    onSelectedChange?: (selected: boolean) => void;
    selectable?: boolean;
    selected?: boolean;
    subtitleContent?: Snippet<[EntityThumbnailCard]>;
    titleAlign?: EntityThumbnailTitleAlign;
    titleSize?: EntityThumbnailTitleSize;
  }

  let {
    card,
    layout = "grid",
    linkable = true,
    onSelectedChange,
    selectable = false,
    selected = false,
    subtitleContent,
    titleAlign = "left",
    titleSize = "default",
  }: Props = $props();

  let pointerRatio = $state<number | null>(null);
  let imageFailed = $state(false);
  let hoverBroken = $state(false);
  let lastSrc = $state<string | undefined>(undefined);

  let spriteFrames = $state<TrickplayFrame[] | null>(null);
  let spriteError = $state(false);

  const isSpriteHover = $derived(card.hover.kind === "sprite");
  const asset = $derived(getThumbnailAsset(card, hoverBroken || isSpriteHover ? null : pointerRatio));
  const aspectRatio = $derived(toAspectRatioValue(card.aspectRatio));
  const imageFit = $derived(card.fit ?? "cover");
  const placeholderIcon = $derived(iconForKind(card.entity.kind));
  const showPlaceholder = $derived(isSpriteHover ? !card.cover : !asset || imageFailed);
  const gradient = $derived(placeholderGradient(card.entity.title));

  const activeSpriteFrame = $derived.by(() => {
    if (!isSpriteHover || !spriteFrames || pointerRatio === null) return null;
    const clamped = Math.max(0, Math.min(1, pointerRatio));
    const idx = Math.min(spriteFrames.length - 1, Math.floor(clamped * spriteFrames.length));
    return spriteFrames[idx] ?? null;
  });

  const spriteDims = $derived.by(() => {
    if (!spriteFrames) return { width: 0, height: 0 };
    return {
      width: spriteFrames.reduce((max, f) => Math.max(max, f.x + f.width), 0),
      height: spriteFrames.reduce((max, f) => Math.max(max, f.y + f.height), 0),
    };
  });

  async function ensureSpriteLoaded() {
    if (!isSpriteHover || spriteFrames || spriteError) return;
    const hover = card.hover as { kind: "sprite"; spriteUrl?: string; vttUrl: string };
    try {
      if (hover.spriteUrl && typeof globalThis.Image !== "undefined") {
        const img = new globalThis.Image();
        img.src = hover.spriteUrl;
      }
      spriteFrames = await loadTrickplayFrames(hover.vttUrl);
    } catch (err) {
      console.warn("Failed to load thumbnail trickplay frames", err);
      spriteError = true;
    }
  }

  $effect(() => {
    if (asset?.src !== lastSrc) {
      lastSrc = asset?.src;
      imageFailed = false;
    }
  });
  const hoverable = $derived(hasHoverPreview(card) && !hoverBroken && !spriteError);
  const nsfw = $derived(isNsfw(card.entity.capabilities));
  const rating = $derived(getRatingValue(card.entity.capabilities));
  const imageOnly = $derived(card.entity.kind === ENTITY_KIND.bookPage);
  const bottomLeft = $derived(card.custom?.bottomLeft);
  const href = $derived(linkable ? resolveEntityThumbnailHref(card) : undefined);
  const selectionRole = $derived(!href && selectable ? "checkbox" : href ? undefined : "group");
  const selectionTabIndex = $derived(href ? undefined : 0);

  function updatePointerRatio(event: PointerEvent) {
    if (!hoverable) return;
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    pointerRatio = bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0;
  }

  function handlePointerEnter(event: PointerEvent) {
    updatePointerRatio(event);
    void ensureSpriteLoaded();
  }

  function handlePointerMove(event: PointerEvent) {
    updatePointerRatio(event);
    void ensureSpriteLoaded();
  }

  function handleFocus() {
    pointerRatio = hoverable ? 0.5 : null;
    void ensureSpriteLoaded();
  }

  function clearHover() {
    pointerRatio = null;
  }

  function handleSelectionChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    onSelectedChange?.(input.checked);
  }

  function toggleSurfaceSelection() {
    if (!selectable || href) return;
    onSelectedChange?.(!selected);
  }

  function handleSurfaceKeydown(event: KeyboardEvent) {
    if (!selectable || href || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    toggleSurfaceSelection();
  }

  function stopSelectionActivation(event: Event) {
    event.stopPropagation();
  }

  function formatRating(value: number): string {
    if (value <= 0) return "";
    return String(Math.round(value));
  }
</script>

<svelte:element
  this={href ? "a" : "article"}
  href={href || undefined}
  role={selectionRole}
  tabindex={selectionTabIndex}
  class="entity-thumbnail"
  class:is-hovering={pointerRatio !== null}
  class:is-image-only={imageOnly}
  class:is-list={layout === "list"}
  class:is-selected={selected}
  aria-label={card.entity.title}
  aria-checked={!href && selectable ? selected : undefined}
  onblur={clearHover}
  onclick={toggleSurfaceSelection}
  onfocus={handleFocus}
  onkeydown={handleSurfaceKeydown}
>
  <div
    class="media"
    class:has-placeholder={showPlaceholder}
    role="presentation"
    style:aspect-ratio={layout === "list" ? undefined : aspectRatio}
    style:background={showPlaceholder ? gradient : undefined}
    onpointerenter={handlePointerEnter}
    onpointermove={handlePointerMove}
    onpointerleave={clearHover}
  >
    {#if isSpriteHover && card.cover}
      <img
        src={card.cover.src}
        alt={card.cover.alt}
        loading="lazy"
        style:object-fit={imageFit}
        class:sprite-active={activeSpriteFrame !== null}
        onerror={() => { imageFailed = true; }}
      />
    {:else if asset && !showPlaceholder}
      <img
        src={asset.src}
        alt={asset.alt}
        loading="lazy"
        style:object-fit={imageFit}
        onerror={() => {
          imageFailed = true;
          if (pointerRatio !== null) {
            hoverBroken = true;
            pointerRatio = null;
          }
        }}
      />
    {:else}
      <div class="placeholder-glow" aria-hidden="true"></div>
      <div class="placeholder" aria-hidden="true">
        {@render PlaceholderIcon({ icon: placeholderIcon })}
      </div>
    {/if}

    {#if activeSpriteFrame && card.hover.kind === "sprite" && spriteDims.width > 0}
      <div class="sprite-overlay" aria-hidden="true"
        style:background-image="url({card.hover.spriteUrl ?? activeSpriteFrame.url})"
        style:background-size="{(spriteDims.width / activeSpriteFrame.width) * 100}% {(spriteDims.height / activeSpriteFrame.height) * 100}%"
        style:background-position="{spriteDims.width <= activeSpriteFrame.width ? 0 : (activeSpriteFrame.x / (spriteDims.width - activeSpriteFrame.width)) * 100}% {spriteDims.height <= activeSpriteFrame.height ? 0 : (activeSpriteFrame.y / (spriteDims.height - activeSpriteFrame.height)) * 100}%"
        style:background-repeat="no-repeat"
      ></div>
    {/if}

    {#if !imageOnly}
      <div class="scrim" aria-hidden="true"></div>
    {/if}

    {#if selectable}
      <input
        class="selection"
        class:is-selected={selected}
        type="checkbox"
        checked={selected}
        title={`Select ${card.entity.title}`}
        aria-label={`Select ${card.entity.title}`}
        onclick={stopSelectionActivation}
        onpointerdown={stopSelectionActivation}
        onchange={handleSelectionChange}
      />
    {/if}

    {#if !imageOnly && bottomLeft}
      <div class="custom-overlay bottom-left-overlay">
        <span class="badge custom-badge" title={bottomLeft.title ?? bottomLeft.label}>
          {bottomLeft.label}
        </span>
      </div>
    {/if}

    {#if !imageOnly && (nsfw || rating > 0)}
      {#if nsfw}
        <div class="badges top-badges">
          <span class="badge danger icon-only" title="NSFW" aria-label="NSFW">
            <Flame size={13} />
          </span>
        </div>
      {/if}
      {#if rating > 0}
        <div class="badges bottom-badges">
          <span class="badge rating" title="Rating">
            <Star size={13} />
            {formatRating(rating)}
          </span>
        </div>
      {/if}
    {/if}
  </div>

  {#if !imageOnly}
    <div class="details" class:has-subtitle={Boolean(card.subtitle || subtitleContent)}>
      <div class="copy">
        <h3 class={`title-align-${titleAlign} title-size-${titleSize}`} aria-label={card.entity.title}>
          <OverflowTicker
            text={card.entity.title}
            align={titleAlign}
            scaleToFit={titleSize === "compact"}
            minScale={0.62}
          />
        </h3>
        {#if subtitleContent}
          <div class={`subtitle subtitle-custom title-align-${titleAlign}`}>
            {@render subtitleContent(card)}
          </div>
        {:else if card.subtitle}
          <div class={`subtitle title-align-${titleAlign}`} title={card.subtitle}>
            <OverflowTicker text={card.subtitle} align={titleAlign} />
          </div>
        {/if}
      </div>

      {#if card.meta?.length}
        <dl class="meta">
          {#each card.meta as item (item.icon + item.label)}
            <div>
              <dt>
                {@render MetaIcon({ icon: item.icon })}
              </dt>
              <dd>{item.label}</dd>
            </div>
          {/each}
        </dl>
      {/if}
    </div>
  {/if}
</svelte:element>

{#snippet PlaceholderIcon({ icon }: { icon: EntityThumbnailMetaIcon })}
  {#if icon === "video"}
    <div class="placeholder-frame">
      <Film class="placeholder-icon-framed" />
    </div>
  {:else if icon === "audio"}
    <div class="placeholder-audio">
      <Disc3 class="placeholder-disc" />
      <Music class="placeholder-note" />
    </div>
  {:else if icon === "person"}
    <Users class="placeholder-icon" />
  {:else if icon === "book"}
    <BookOpen class="placeholder-icon" />
  {:else if icon === "gallery"}
    <Layers class="placeholder-icon" />
  {:else if icon === "image"}
    <Image class="placeholder-icon" />
  {:else if icon === "studio"}
    <Building2 class="placeholder-icon" />
  {:else if icon === "tag"}
    <Tag class="placeholder-icon" />
  {:else if icon === "collection"}
    <FolderOpen class="placeholder-icon" />
  {:else}
    <Hash class="placeholder-icon" />
  {/if}
{/snippet}

{#snippet MetaIcon({ icon }: { icon: EntityThumbnailMetaIcon })}
  {#if icon === "audio"}
    <Music size={12} />
  {:else if icon === "book"}
    <BookOpen size={12} />
  {:else if icon === "calendar"}
    <Calendar size={12} />
  {:else if icon === "chapter"}
    <Album size={12} />
  {:else if icon === "collection"}
    <Layers size={12} />
  {:else if icon === "duration"}
    <Clock3 size={12} />
  {:else if icon === "gallery"}
    <Images size={12} />
  {:else if icon === "image"}
    <Images size={12} />
  {:else if icon === "person"}
    <Users size={12} />
  {:else if icon === "studio"}
    <Building2 size={12} />
  {:else if icon === "tag"}
    <Tag size={12} />
  {:else if icon === "video"}
    <Film size={12} />
  {:else}
    <Hash size={12} />
  {/if}
{/snippet}

<style>
  .entity-thumbnail {
    position: relative;
    display: grid;
    grid-template-rows: auto 1fr;
    overflow: hidden;
    border: 1px solid rgb(255 255 255 / 0.08);
    background:
      linear-gradient(180deg, rgb(255 255 255 / 0.04), rgb(255 255 255 / 0.012)),
      rgb(12 12 13 / 0.92);
    color: var(--color-text, #f4efe6);
    text-decoration: none;
    min-width: 0;
    box-shadow:
      inset 0 0 0 1px rgb(0 0 0 / 0.5),
      0 2px 6px rgb(0 0 0 / 0.32);
    transition:
      border-color 200ms var(--ease-default, cubic-bezier(0.4, 0, 0.2, 1)),
      box-shadow 200ms var(--ease-default, cubic-bezier(0.4, 0, 0.2, 1)),
      transform 200ms var(--ease-default, cubic-bezier(0.4, 0, 0.2, 1));
  }

  .entity-thumbnail::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    background: linear-gradient(
      to right,
      transparent,
      rgb(221 180 119) 50%,
      transparent
    );
    box-shadow: 0 0 12px rgb(196 154 90 / 0.55);
    opacity: 0;
    transform: scaleX(0.4);
    transform-origin: center;
    transition:
      opacity 200ms var(--ease-default, cubic-bezier(0.4, 0, 0.2, 1)),
      transform 280ms var(--ease-mechanical, cubic-bezier(0.25, 0, 0.25, 1));
    pointer-events: none;
    z-index: 3;
  }

  .entity-thumbnail:is(:hover, :focus-visible) {
    border-color: rgb(196 154 90 / 0.32);
    box-shadow:
      inset 0 0 0 1px rgb(0 0 0 / 0.5),
      0 0 0 1px rgb(196 154 90 / 0.18),
      0 10px 22px rgb(0 0 0 / 0.42),
      0 0 24px rgb(196 154 90 / 0.07);
    transform: translateY(-1px);
  }

  .entity-thumbnail:is(:hover, :focus-visible)::after {
    opacity: 0.85;
    transform: scaleX(1);
  }

  .entity-thumbnail.is-selected {
    border-color: rgb(196 154 90 / 0.6);
    box-shadow:
      inset 0 0 0 1px rgb(196 154 90 / 0.28),
      0 0 0 1px rgb(196 154 90 / 0.45),
      0 0 26px rgb(196 154 90 / 0.18),
      0 10px 22px rgb(0 0 0 / 0.4);
  }

  .entity-thumbnail.is-selected::after {
    opacity: 1;
    transform: scaleX(1);
  }

  @media (prefers-reduced-motion: reduce) {
    .entity-thumbnail,
    .entity-thumbnail::after {
      transition: none;
    }

    .entity-thumbnail:is(:hover, :focus-visible) {
      transform: none;
    }
  }

  .entity-thumbnail.is-list {
    grid-template-columns: minmax(5.5rem, 7.5rem) minmax(0, 1fr);
    grid-template-rows: none;
    inline-size: 100%;
    min-block-size: 5.25rem;
  }

  .media {
    position: relative;
    overflow: hidden;
    border-bottom: 1px solid rgb(255 255 255 / 0.1);
    background:
      radial-gradient(circle at 50% 45%, rgb(255 255 255 / 0.08), transparent 34%),
      linear-gradient(135deg, rgb(15 16 18 / 0.96), rgb(28 25 20 / 0.92)),
      #111;
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.03);
  }

  .entity-thumbnail.is-image-only .media {
    border-bottom: 0;
  }

  .entity-thumbnail.is-list .media {
    min-block-size: 5.25rem;
    border-right: 1px solid rgb(255 255 255 / 0.1);
    border-bottom: 0;
  }

  .entity-thumbnail.is-list .media img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .media img,
  .placeholder {
    width: 100%;
    height: 100%;
  }

  .media img {
    display: block;
    object-fit: cover;
    object-position: center;
    transition:
      filter 160ms ease;
  }

  .entity-thumbnail:is(:hover, :focus-visible) .media img,
  .entity-thumbnail.is-hovering .media img {
    filter: saturate(1.06) contrast(1.04);
  }

  .media img.sprite-active,
  .media img:global(.sprite-active) {
    opacity: 0;
  }

  .sprite-overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
  }

  .placeholder-glow {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at top, rgb(245 239 213 / 0.16), transparent 38%),
      linear-gradient(180deg, rgb(7 8 11 / 0.06) 0%, rgb(7 8 11 / 0.55) 100%);
    pointer-events: none;
  }

  .placeholder {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .placeholder-frame {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3.5rem;
    height: 3.5rem;
    border: 1px solid rgb(196 154 90 / 0.25);
    background: rgb(0 0 0 / 0.3);
    backdrop-filter: blur(4px);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.08),
      0 0 24px rgb(0 0 0 / 0.35);
  }

  .placeholder :global(.placeholder-icon-framed) {
    width: 1.75rem;
    height: 1.75rem;
    color: rgb(231 211 175 / 0.85);
    filter: drop-shadow(0 0 14px rgb(196 154 90 / 0.24));
  }

  .placeholder :global(.placeholder-icon) {
    width: 2rem;
    height: 2rem;
    color: rgb(255 255 255 / 0.25);
  }

  .placeholder-audio {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .placeholder :global(.placeholder-disc) {
    width: 3.5rem;
    height: 3.5rem;
    color: rgb(255 255 255 / 0.15);
    animation: spin-disc 12s linear infinite;
  }

  .placeholder :global(.placeholder-note) {
    position: absolute;
    width: 1.5rem;
    height: 1.5rem;
    color: rgb(255 255 255 / 0.4);
  }

  @keyframes spin-disc {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (prefers-reduced-motion: reduce) {
    .placeholder :global(.placeholder-disc) {
      animation: none;
    }
  }

  .scrim {
    position: absolute;
    inset: auto 0 0;
    height: 42%;
    background: linear-gradient(to top, rgb(0 0 0 / 0.72), transparent);
    pointer-events: none;
  }

  .badges {
    position: absolute;
    right: 0.45rem;
    left: 2.45rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    align-items: center;
    justify-content: flex-end;
    pointer-events: none;
  }

  .top-badges {
    top: 0.45rem;
  }

  .bottom-badges {
    right: 0.5rem;
    bottom: 0.5rem;
  }

  .custom-overlay {
    position: absolute;
    display: flex;
    pointer-events: none;
  }

  .bottom-left-overlay {
    bottom: 0.5rem;
    left: 0.5rem;
    right: 4rem;
    justify-content: flex-start;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border: 1px solid rgb(255 255 255 / 0.12);
    background: rgb(11 11 12 / 0.72);
    color: rgb(244 239 230 / 0.88);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.66rem;
    line-height: 1;
    letter-spacing: 0;
    min-height: 1.35rem;
    padding: 0.25rem 0.38rem;
    backdrop-filter: blur(12px);
  }

  .badge :global(svg) {
    flex: 0 0 auto;
  }

  .rating {
    border-color: rgb(242 193 95 / 0.34);
    background: rgb(32 25 13 / 0.76);
    color: #f2c15f;
    box-shadow: 0 0 14px rgb(242 193 95 / 0.12);
  }

  .danger {
    color: #ff806f;
    border-color: rgb(255 92 67 / 0.42);
    background: rgb(40 13 10 / 0.76);
    box-shadow: 0 0 14px rgb(255 92 67 / 0.12);
  }

  .custom-badge {
    border-color: rgb(196 154 90 / 0.38);
    background: rgb(13 13 14 / 0.78);
    color: rgb(244 239 230 / 0.92);
    box-shadow: 0 0 14px rgb(196 154 90 / 0.1);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon-only {
    justify-content: center;
    inline-size: 1.35rem;
    padding-inline: 0;
  }

  .selection {
    position: absolute;
    top: 0.45rem;
    left: 0.45rem;
    z-index: 2;
    display: grid;
    inline-size: 1.55rem;
    block-size: 1.55rem;
    border: 1px solid rgb(255 255 255 / 0.12);
    background: rgb(11 11 12 / 0.72);
    appearance: none;
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    backdrop-filter: blur(12px);
    transition:
      opacity 120ms ease,
      border-color 120ms ease,
      box-shadow 120ms ease;
  }

  .entity-thumbnail:is(:hover, :focus-within) .selection,
  .entity-thumbnail.is-selected .selection,
  .selection:focus {
    opacity: 1;
    pointer-events: auto;
  }

  .selection::before {
    position: absolute;
    inset: 0.38rem;
    border: 1px solid rgb(244 239 230 / 0.7);
    background: rgb(0 0 0 / 0.16);
    content: "";
    pointer-events: none;
  }

  .selection::after {
    position: absolute;
    top: 0.58rem;
    left: 0.54rem;
    inline-size: 0.45rem;
    block-size: 0.24rem;
    border-bottom: 2px solid #0b0b0c;
    border-left: 2px solid #0b0b0c;
    content: "";
    opacity: 0;
    transform: rotate(-45deg);
  }

  .selection:checked,
  .selection.is-selected {
    border-color: rgb(196 154 90 / 0.74);
    box-shadow: 0 0 16px rgb(196 154 90 / 0.22);
  }

  .selection:checked::before,
  .selection.is-selected::before {
    border-color: rgb(196 154 90 / 0.95);
    background: linear-gradient(135deg, #d9b370, #9f7333);
  }

  .selection:checked::after,
  .selection.is-selected::after {
    opacity: 1;
  }

  .copy {
    display: block;
    min-width: 0;
  }

  .subtitle {
    overflow: hidden;
    margin: 0.18rem 0 0;
    color: rgb(196 201 212 / 0.72);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.64rem;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .subtitle-custom {
    display: flex;
    min-width: 0;
  }

  .subtitle-custom.title-align-left {
    justify-content: flex-start;
  }

  .subtitle-custom.title-align-center {
    justify-content: center;
  }

  .subtitle-custom.title-align-right {
    justify-content: flex-end;
  }

  .details {
    display: grid;
    grid-template-rows: 1.35rem 1.3rem;
    gap: 0.55rem;
    min-width: 0;
    block-size: 4.55rem;
    padding: 0.72rem 0.78rem 0.7rem;
    background:
      linear-gradient(180deg, rgb(10 12 15 / 0.94), rgb(9 10 12 / 0.98)),
      #0a0b0d;
  }

  .details.has-subtitle {
    grid-template-rows: minmax(0, 2.3rem) minmax(1.15rem, auto);
    gap: 0.35rem;
    block-size: auto;
    min-block-size: 4.55rem;
  }

  .entity-thumbnail.is-list .details {
    align-content: center;
    block-size: auto;
    min-block-size: 5.25rem;
    padding: 0.72rem 0.9rem;
  }

  .entity-thumbnail.is-list .selection {
    opacity: 1;
    pointer-events: auto;
  }

  .entity-thumbnail.is-list .badges {
    right: 0.38rem;
    left: 2.2rem;
  }

  h3 {
    display: block;
    margin: 0;
    min-width: 0;
    overflow: hidden;
    font-family: var(--font-heading, Geist, sans-serif);
    font-size: 0.88rem;
    font-weight: 680;
    line-height: 1.18;
    letter-spacing: 0;
    white-space: nowrap;
  }

  .title-size-compact {
    font-size: 0.66rem;
    font-weight: 620;
    line-height: 1.12;
  }

  .title-align-left {
    text-align: left;
  }

  .title-align-center {
    text-align: center;
  }

  .title-align-right {
    text-align: right;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.28rem;
    margin: 0;
    max-block-size: 1.3rem;
    overflow: hidden;
  }

  .meta div {
    display: inline-flex;
    align-items: center;
    gap: 0.22rem;
    min-width: 0;
    max-width: 100%;
    border: 1px solid rgb(255 255 255 / 0.08);
    background: rgb(255 255 255 / 0.032);
    color: rgb(244 239 230 / 0.6);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.6rem;
    line-height: 1;
    min-height: 1.25rem;
    padding: 0.2rem 0.3rem;
  }

  .meta dt,
  .meta dd {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta dt {
    display: grid;
    place-items: center;
  }

  .meta :global(svg) {
    color: rgb(231 197 142 / 0.82);
  }

  @media (max-width: 640px) {
    .badge {
      font-size: 0.61rem;
    }

    .details {
      grid-template-rows: 1.12rem 1.18rem;
      gap: 0.46rem;
      block-size: 4.18rem;
      padding: 0.62rem;
    }

    h3 {
      font-size: 0.84rem;
    }

    .meta div {
      font-size: 0.56rem;
      min-height: 1.18rem;
    }
  }
</style>
