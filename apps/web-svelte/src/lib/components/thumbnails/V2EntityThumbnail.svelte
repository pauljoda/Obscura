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
  const imageFit = $derived(card.fit ?? "contain");
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
      <img src={asset.src} alt={asset.alt} loading="lazy" style:object-fit={imageFit} />
    {:else}
      <div class="placeholder" aria-hidden="true">
        {@render IconFor({ icon: card.meta?.[0]?.icon ?? "collection" })}
      </div>
    {/if}

    <div class="scrim" aria-hidden="true"></div>

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
    left: 0.45rem;
    right: 0.45rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    align-items: center;
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

  .copy {
    display: grid;
    grid-template-rows: 2.45rem 0.95rem;
    gap: 0.3rem;
    min-width: 0;
  }

  .details {
    display: grid;
    grid-template-rows: 3.7rem 1.3rem;
    gap: 0.55rem;
    min-width: 0;
    block-size: 6.92rem;
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
    font-family: var(--font-heading, Geist, sans-serif);
    display: -webkit-box;
    font-size: 1.05rem;
    font-weight: 680;
    line-height: 1.16;
    letter-spacing: 0;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    white-space: normal;
  }

  p {
    color: rgb(244 239 230 / 0.58);
    font-size: 0.76rem;
    line-height: 1.2;
    align-self: end;
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
      grid-template-rows: 3.34rem 1.22rem;
      gap: 0.46rem;
      block-size: 6.26rem;
      padding: 0.62rem;
    }

    .copy {
      grid-template-rows: 2.12rem 0.9rem;
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
