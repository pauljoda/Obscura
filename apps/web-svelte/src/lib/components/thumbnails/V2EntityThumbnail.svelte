<script lang="ts">
  import {
    Album,
    BookOpen,
    Building2,
    Calendar,
    Clock3,
    Film,
    Hash,
    Images,
    Layers,
    Music,
    ShieldAlert,
    Star,
    Tag,
    User,
  } from "@lucide/svelte";
  import { getRatingValue, isNsfw } from "$lib/api/capabilities";
  import {
    getThumbnailAsset,
    hasHoverPreview,
    toAspectRatioValue,
    type EntityThumbnailCard,
    type EntityThumbnailMetaIcon,
  } from "$lib/entities/entity-thumbnail";

  interface Props {
    card: EntityThumbnailCard;
    onSelectedChange?: (selected: boolean) => void;
    selectable?: boolean;
    selected?: boolean;
  }

  let { card, onSelectedChange, selectable = false, selected = false }: Props = $props();

  let pointerRatio = $state<number | null>(null);

  const asset = $derived(getThumbnailAsset(card, pointerRatio));
  const aspectRatio = $derived(toAspectRatioValue(card.aspectRatio));
  const imageFit = $derived(card.fit ?? "contain");
  const hoverable = $derived(hasHoverPreview(card));
  const nsfw = $derived(isNsfw(card.entity.capabilities));
  const rating = $derived(getRatingValue(card.entity.capabilities));

  function fitTitle(node: HTMLHeadingElement, _title: string) {
    let frame = 0;
    let observer: ResizeObserver | null = null;

    function measure() {
      if (typeof requestAnimationFrame === "undefined") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const text = node.querySelector<HTMLElement>(".title-text");
        if (!text) return;

        node.style.setProperty("--title-scale", "1");
        node.style.setProperty("--title-travel", "0px");
        node.dataset.compressed = "false";
        node.dataset.overflow = "false";

        const width = node.clientWidth;
        const scrollWidth = text.scrollWidth;
        if (width <= 0 || scrollWidth <= 0) return;
        const rawOverflow = scrollWidth > width + 1;
        const scale = Math.max(0.78, Math.min(1, width / scrollWidth));
        const travel = Math.max(0, Math.ceil(scrollWidth * scale - width));

        node.style.setProperty("--title-scale", String(scale));
        node.style.setProperty("--title-travel", `${travel}px`);
        node.dataset.compressed = rawOverflow ? "true" : "false";
        node.dataset.overflow = travel > 1 ? "true" : "false";
      });
    }

    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(node);
    }
    measure();

    return {
      update: measure,
      destroy() {
        cancelAnimationFrame(frame);
        observer?.disconnect();
      },
    };
  }

  function handlePointerMove(event: PointerEvent) {
    if (!hoverable) return;
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    pointerRatio = bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0;
  }

  function clearHover() {
    pointerRatio = null;
  }

  function handleSelectionChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    onSelectedChange?.(input.checked);
  }

  function stopSelectionActivation(event: Event) {
    event.stopPropagation();
  }

  function formatRating(value: number): string {
    if (value <= 0) return "";
    return value <= 5 ? `${value}/5` : `${Math.round(value)}%`;
  }
</script>

<svelte:element
  this={card.href && !selectable ? "a" : "article"}
  href={card.href && !selectable ? card.href : undefined}
  role={card.href && !selectable ? undefined : "group"}
  tabindex={card.href && !selectable ? undefined : 0}
  class="entity-thumbnail"
  class:is-hovering={pointerRatio !== null}
  class:is-selected={selected}
  aria-label={card.entity.title}
  onpointermove={handlePointerMove}
  onpointerleave={clearHover}
  onblur={clearHover}
  onfocus={() => {
    pointerRatio = hoverable ? 0.5 : null;
  }}
>
  <div class="media" style:aspect-ratio={aspectRatio}>
    {#if asset}
      <img src={asset.src} alt={asset.alt} loading="lazy" style:object-fit={imageFit} />
    {:else}
      <div class="placeholder" aria-hidden="true">
        {@render IconFor({ icon: card.meta?.[0]?.icon ?? "collection" })}
      </div>
    {/if}

    <div class="scrim" aria-hidden="true"></div>

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

    {#if nsfw || rating > 0}
      <div class="badges">
        {#if nsfw}
          <span class="badge danger" title="NSFW">
            <ShieldAlert size={13} />
            NSFW
          </span>
        {/if}
        {#if rating > 0}
          <span class="badge" title="Rating">
            <Star size={13} />
            {formatRating(rating)}
          </span>
        {/if}
      </div>
    {/if}
  </div>

  <div class="details">
    <div class="copy">
      <h3 class="ticker-title" use:fitTitle={card.entity.title} title={card.entity.title}>
        <span class="title-text">{card.entity.title}</span>
      </h3>
      {#if card.entity.subtitle}
        <p>{card.entity.subtitle}</p>
      {/if}
    </div>

    {#if card.meta?.length}
      <dl class="meta">
        {#each card.meta as item (item.icon + item.label)}
          <div>
            <dt>
              {@render IconFor({ icon: item.icon })}
            </dt>
            <dd>{item.label}</dd>
          </div>
        {/each}
      </dl>
    {/if}
  </div>
</svelte:element>

{#snippet IconFor({ icon }: { icon: EntityThumbnailMetaIcon })}
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
    <User size={12} />
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
    display: grid;
    grid-template-rows: auto 1fr;
    overflow: hidden;
    border: 1px solid rgb(255 255 255 / 0.12);
    background:
      linear-gradient(180deg, rgb(255 255 255 / 0.055), rgb(255 255 255 / 0.018)),
      rgb(12 12 13 / 0.92);
    color: var(--color-text, #f4efe6);
    text-decoration: none;
    min-width: 0;
    box-shadow:
      inset 0 0 0 1px rgb(0 0 0 / 0.42),
      0 14px 28px rgb(0 0 0 / 0.24);
  }

  .entity-thumbnail.is-selected {
    border-color: rgb(196 154 90 / 0.55);
    box-shadow:
      inset 0 0 0 1px rgb(196 154 90 / 0.22),
      0 0 24px rgb(196 154 90 / 0.12),
      0 14px 28px rgb(0 0 0 / 0.24);
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

  .placeholder {
    display: grid;
    place-items: center;
    color: rgb(244 239 230 / 0.58);
  }

  .placeholder :global(svg) {
    width: 30%;
    height: 30%;
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
    top: 0.45rem;
    right: 0.45rem;
    left: 2.45rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    align-items: center;
    justify-content: flex-end;
    pointer-events: none;
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

  .danger {
    color: #ffb5a9;
    border-color: rgb(255 121 97 / 0.35);
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
    display: grid;
    grid-template-rows: 1.35rem 0.95rem;
    gap: 0.28rem;
    min-width: 0;
  }

  .details {
    display: grid;
    grid-template-rows: 2.58rem 1.3rem;
    gap: 0.55rem;
    min-width: 0;
    block-size: 5.8rem;
    padding: 0.72rem 0.78rem 0.7rem;
    background:
      linear-gradient(180deg, rgb(10 12 15 / 0.94), rgb(9 10 12 / 0.98)),
      #0a0b0d;
  }

  h3,
  p {
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  h3 {
    position: relative;
    font-family: var(--font-heading, Geist, sans-serif);
    display: block;
    font-size: calc(1.05rem * var(--title-scale, 1));
    font-weight: 680;
    line-height: 1.16;
    letter-spacing: 0;
    white-space: nowrap;
    transition: font-size 120ms ease;
  }

  :global(.ticker-title[data-compressed="true"]) {
    padding-right: 1.28rem;
  }

  :global(.ticker-title[data-compressed="true"])::after {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    display: grid;
    align-items: center;
    justify-items: end;
    width: 1.35rem;
    border-right: 2px solid rgb(196 154 90 / 0.72);
    background: linear-gradient(to right, rgb(10 12 15 / 0), #0a0b0d 34%);
    color: rgb(196 154 90 / 0.98);
    content: ">>";
    font-size: inherit;
    line-height: inherit;
    pointer-events: none;
  }

  .title-text {
    display: inline-block;
    width: max-content;
    max-width: none;
    min-width: 0;
    transform: translateX(0);
    transition: transform 160ms ease;
    will-change: transform;
  }

  :global(.ticker-title[data-compressed="true"]:hover)::after {
    opacity: 0;
  }

  :global(.ticker-title[data-overflow="true"]:is(:hover, :focus-visible)) .title-text {
    animation: title-ticker 7s linear infinite;
  }

  @keyframes title-ticker {
    0%,
    12% {
      transform: translateX(0);
    }

    46%,
    62% {
      transform: translateX(calc(-1 * var(--title-travel, 0px)));
    }

    100% {
      transform: translateX(0);
    }
  }

  p {
    color: rgb(244 239 230 / 0.58);
    font-size: 0.76rem;
    line-height: 1.2;
    align-self: end;
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.ticker-title[data-overflow="true"]:is(:hover, :focus-visible)) .title-text {
      animation: none;
    }
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
      grid-template-rows: 2.32rem 1.22rem;
      gap: 0.46rem;
      block-size: 5.38rem;
      padding: 0.62rem;
    }

    .copy {
      grid-template-rows: 1.12rem 0.9rem;
      gap: 0.26rem;
    }

    h3 {
      font-size: 0.92rem;
    }

    .meta div {
      font-size: 0.56rem;
      min-height: 1.18rem;
    }
  }
</style>
