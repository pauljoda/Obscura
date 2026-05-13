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
  }

  let { card }: Props = $props();

  let pointerRatio = $state<number | null>(null);

  const asset = $derived(getThumbnailAsset(card, pointerRatio));
  const aspectRatio = $derived(toAspectRatioValue(card.aspectRatio));
  const hoverable = $derived(hasHoverPreview(card));
  const nsfw = $derived(isNsfw(card.entity.capabilities));
  const rating = $derived(getRatingValue(card.entity.capabilities));

  function handlePointerMove(event: PointerEvent) {
    if (!hoverable) return;
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    pointerRatio = bounds.width > 0 ? (event.clientX - bounds.left) / bounds.width : 0;
  }

  function clearHover() {
    pointerRatio = null;
  }

  function formatRating(value: number): string {
    if (value <= 0) return "";
    return value <= 5 ? `${value}/5` : `${Math.round(value)}%`;
  }
</script>

<svelte:element
  this={card.href ? "a" : "article"}
  href={card.href}
  role={card.href ? undefined : "group"}
  tabindex={card.href ? undefined : 0}
  class="entity-thumbnail"
  class:is-hovering={pointerRatio !== null}
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
      <img src={asset.src} alt={asset.alt} loading="lazy" />
    {:else}
      <div class="placeholder" aria-hidden="true">
        {@render IconFor({ icon: card.meta?.[0]?.icon ?? "collection" })}
      </div>
    {/if}

    <div class="scrim" aria-hidden="true"></div>

    <div class="badges">
      <span class="kind">{card.entity.kind}</span>
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

    {#if hoverable}
      <div class="hover-state" data-kind={card.hover.kind}>
        {#if card.hover.kind === "trickplay"}
          <Film size={13} />
          Scrub
        {:else}
          <Images size={13} />
          Preview
        {/if}
      </div>
    {/if}
  </div>

  <div class="copy">
    <h3>{card.entity.title}</h3>
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
</svelte:element>

{#snippet IconFor({ icon }: { icon: EntityThumbnailMetaIcon })}
  {#if icon === "audio"}
    <Music size={14} />
  {:else if icon === "book"}
    <BookOpen size={14} />
  {:else if icon === "calendar"}
    <Calendar size={14} />
  {:else if icon === "chapter"}
    <Album size={14} />
  {:else if icon === "collection"}
    <Layers size={14} />
  {:else if icon === "duration"}
    <Clock3 size={14} />
  {:else if icon === "gallery"}
    <Images size={14} />
  {:else if icon === "image"}
    <Images size={14} />
  {:else if icon === "person"}
    <User size={14} />
  {:else if icon === "studio"}
    <Building2 size={14} />
  {:else if icon === "tag"}
    <Tag size={14} />
  {:else if icon === "video"}
    <Film size={14} />
  {:else}
    <Hash size={14} />
  {/if}
{/snippet}

<style>
  .entity-thumbnail {
    display: grid;
    gap: 0.65rem;
    color: var(--color-text, #f4efe6);
    text-decoration: none;
    min-width: 0;
  }

  .media {
    position: relative;
    overflow: hidden;
    border: 1px solid rgb(255 255 255 / 0.1);
    background:
      linear-gradient(135deg, rgb(15 16 18 / 0.96), rgb(38 34 28 / 0.92)),
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
    transition:
      filter 160ms ease,
      transform 160ms ease;
  }

  .entity-thumbnail:is(:hover, :focus-visible) .media img,
  .entity-thumbnail.is-hovering .media img {
    filter: saturate(1.06) contrast(1.04);
    transform: scale(1.015);
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
    left: 0.45rem;
    right: 0.45rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    align-items: center;
  }

  .kind,
  .badge,
  .hover-state {
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

  .kind {
    color: rgb(231 197 142 / 0.95);
    text-transform: uppercase;
  }

  .badge :global(svg),
  .hover-state :global(svg) {
    flex: 0 0 auto;
  }

  .danger {
    color: #ffb5a9;
    border-color: rgb(255 121 97 / 0.35);
  }

  .hover-state {
    position: absolute;
    right: 0.45rem;
    bottom: 0.45rem;
    color: rgb(244 239 230 / 0.78);
  }

  .copy {
    display: grid;
    gap: 0.2rem;
    min-width: 0;
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
    font-family: var(--font-heading, Geist, sans-serif);
    font-size: 0.96rem;
    font-weight: 650;
    line-height: 1.2;
    letter-spacing: 0;
  }

  p {
    color: rgb(244 239 230 / 0.58);
    font-size: 0.78rem;
    line-height: 1.2;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: 0;
  }

  .meta div {
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
    min-width: 0;
    border: 1px solid rgb(255 255 255 / 0.08);
    background: rgb(255 255 255 / 0.045);
    color: rgb(244 239 230 / 0.68);
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.68rem;
    line-height: 1;
    padding: 0.28rem 0.38rem;
  }

  .meta dt,
  .meta dd {
    margin: 0;
  }

  .meta dt {
    display: grid;
    place-items: center;
  }

  .meta :global(svg) {
    color: rgb(231 197 142 / 0.82);
  }

  @media (max-width: 640px) {
    .kind,
    .badge,
    .hover-state {
      font-size: 0.61rem;
    }

    h3 {
      font-size: 0.9rem;
    }
  }
</style>
