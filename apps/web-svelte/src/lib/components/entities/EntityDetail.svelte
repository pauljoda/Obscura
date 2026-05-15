<script lang="ts">
  import { marked } from "marked";
  import type { Snippet } from "svelte";
  import {
    Star,
    Heart,
    Flame,
    CheckCircle,
    ExternalLink,
    FileText,
    Link,
  } from "@lucide/svelte";
  import type { EntityDetailCard } from "$lib/entities/entity-detail";
  import { hasHero, hasPoster } from "$lib/entities/entity-detail";
  import { placeholderGradient } from "$lib/entities/entity-thumbnail";

  export type EntityDetailPosterSize = "none" | "small" | "medium" | "large";

  interface Props {
    card: EntityDetailCard;
    onRatingChange?: (value: number | null) => void;
    onFavoriteToggle?: () => void;
    onOrganizedToggle?: () => void;
    posterSize?: EntityDetailPosterSize;
    ratingBusy?: boolean;
    showHero?: boolean;
    /** Inline metadata rendered below the title (e.g. studio link · date · count). */
    heroMeta?: Snippet;
    /** Badge row rendered below the rating stars (e.g. Season 1, Episode 2). */
    heroBadges?: Snippet;
    /** Extra badges appended to the flags row (e.g. classification). */
    extraFlags?: Snippet;
    /** Content rendered between the detail body and the metadata sections (e.g. studio, credits). */
    afterBody?: Snippet;
    /** Extra metadata sections appended inside the lower metadata area. */
    extraSections?: Snippet;
  }

  let {
    card,
    onRatingChange,
    onFavoriteToggle,
    onOrganizedToggle,
    posterSize = "medium",
    ratingBusy = false,
    showHero = true,
    heroMeta,
    heroBadges,
    extraFlags,
    afterBody,
    extraSections,
  }: Props = $props();

  let favoriteAnimating = $state(false);
  let organizedAnimating = $state(false);

  const isFavorite = $derived(card.flags.find((f) => f.code === "favorite")?.active ?? false);
  const isNsfw = $derived(card.flags.find((f) => f.code === "nsfw")?.active ?? false);
  const isOrganized = $derived(card.flags.find((f) => f.code === "organized")?.active ?? false);

  function handleFavoriteClick() {
    if (!onFavoriteToggle) return;
    favoriteAnimating = true;
    onFavoriteToggle();
    setTimeout(() => (favoriteAnimating = false), 400);
  }

  function handleOrganizedClick() {
    if (!onOrganizedToggle) return;
    organizedAnimating = true;
    onOrganizedToggle();
    setTimeout(() => (organizedAnimating = false), 400);
  }

  type HeroMode = "image" | "poster-blur" | "gradient";

  const heroMode = $derived.by((): HeroMode => {
    if (!showHero) return "gradient";
    if (hasHero(card)) return "image";
    if (hasPoster(card)) return "poster-blur";
    return "gradient";
  });

  const posterVisible = $derived(posterSize !== "none" && hasPoster(card));

  const renderedDescription = $derived.by(() => {
    if (!card.description) return null;
    const renderer = new marked.Renderer();
    renderer.link = ({ href, text }) =>
      `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    return marked.parse(card.description, { renderer, async: false, gfm: true, breaks: true }) as string;
  });

  function handleRatingClick(value: number) {
    if (!onRatingChange || ratingBusy || !card.rating) return;
    const nextValue = card.rating.value === value ? null : value;
    onRatingChange(nextValue);
  }
</script>

<article class="entity-detail" data-poster-size={posterSize} data-hero-mode={heroMode}>
  <!-- Hero -->
  <div class="hero" data-hero-mode={heroMode}>

    {#snippet heroContent()}
      <div class="hero-content">
        {#if posterVisible}
          <div class="poster-frame">
            <img src={card.poster!.src} alt={card.poster!.alt} />
          </div>
        {/if}

        <div class="hero-text">
          <div class="action-badges">
            <button
              type="button"
              class="action-badge favorite"
              class:active={isFavorite}
              class:animating={favoriteAnimating}
              disabled={!onFavoriteToggle}
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              onclick={handleFavoriteClick}
            >
              <Heart class="h-4 w-4" />
            </button>

            {#if isNsfw}
              <span class="action-badge nsfw active" aria-label="NSFW">
                <Flame class="h-4 w-4" />
              </span>
            {/if}

            <button
              type="button"
              class="action-badge organized"
              class:active={isOrganized}
              class:animating={organizedAnimating}
              disabled={!onOrganizedToggle}
              aria-label={isOrganized ? "Mark as unorganized" : "Mark as organized"}
              onclick={handleOrganizedClick}
            >
              <CheckCircle class="h-4 w-4" />
            </button>

            {#if extraFlags}
              {@render extraFlags()}
            {/if}
          </div>
          <h1>{card.entity.title}</h1>

          {#if heroMeta}
            <div class="meta-row">
              {@render heroMeta()}
            </div>
          {/if}

          {#if card.rating}
            <div class="rating-row" role="group" aria-label="Rating">
              {#each { length: card.rating.max } as _, i (i)}
                {@const value = i + 1}
                <button
                  type="button"
                  class="rating-star"
                  class:active={card.rating!.value >= value}
                  disabled={ratingBusy || !onRatingChange}
                  aria-label={`Rate ${value}`}
                  onclick={() => handleRatingClick(value)}
                >
                  <Star class="h-5 w-5" />
                </button>
              {/each}
            </div>
          {/if}

          {#if heroBadges}
            <div class="position-badges">
              {@render heroBadges()}
            </div>
          {/if}
        </div>
      </div>
    {/snippet}

    {#if heroMode === "image"}
      <!-- Sharp banner, mask fades bottom 10% -->
      <div class="hero-banner">
        <img src={card.hero!.src} alt="Banner" />
      </div>
      <!-- Lower zone: reflection bg + content on top -->
      <div class="hero-lower">
        <div class="hero-reflection">
          <img src={card.hero!.src} alt="" aria-hidden="true" />
        </div>
        <div class="hero-blur-overlay"></div>
        {@render heroContent()}
      </div>
    {:else if heroMode === "poster-blur"}
      <div class="hero-backdrop poster-mode">
        <div class="hero-backdrop-img">
          <img src={card.poster!.src} alt="" aria-hidden="true" />
        </div>
        <div class="hero-backdrop-blur"></div>
      </div>
      {@render heroContent()}
    {:else}
      <div class="hero-gradient-bg" style:background-image={placeholderGradient(card.entity.title)}></div>
      {@render heroContent()}
    {/if}
  </div>

  <div class="detail-body">
    <!-- Description -->
    {#if renderedDescription}
      <div class="description-content markdown-body">
        {@html renderedDescription}
      </div>
    {/if}

    <!-- Tags -->
    {#if card.tags.length > 0}
      <div class="tags-row">
        <span class="tags-label">Tags:</span>
        {#each card.tags as tag (tag)}
          <span class="tag-chip">{tag}</span>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Kind-specific content between body and metadata (studio, credits, etc.) -->
  {#if afterBody}
    {@render afterBody()}
  {/if}

  <!-- Lower metadata sections -->
  {#if card.links.length > 0 || card.files.length > 0 || extraSections}
    <div class="metadata-sections">
      {#if extraSections}
        {@render extraSections()}
      {/if}

      <!-- Links (universal) -->
      {#if card.links.length > 0}
        <section class="detail-section">
          <h2 class="section-label">
            <Link class="h-4 w-4" />
            Links
          </h2>
          <div class="link-list">
            {#each card.links as link (link.label)}
              {#if link.url}
                <a href={link.url} target="_blank" rel="noopener noreferrer" class="link-item">
                  <ExternalLink class="h-3.5 w-3.5" />
                  {link.label}
                </a>
              {:else}
                <span class="link-item no-url">
                  <Link class="h-3.5 w-3.5" />
                  {link.label}
                </span>
              {/if}
            {/each}
          </div>
        </section>
      {/if}

      <!-- Files (universal) -->
      {#if card.files.length > 0}
        <section class="detail-section">
          <h2 class="section-label">
            <FileText class="h-4 w-4" />
            Files
          </h2>
          <div class="file-list">
            {#each card.files as file (file.path)}
              <div class="file-row">
                <span class="file-role">{file.role}</span>
                <span class="file-path mono">{file.path}</span>
                {#if file.mimeType}
                  <span class="file-mime mono">{file.mimeType}</span>
                {/if}
              </div>
            {/each}
          </div>
        </section>
      {/if}
    </div>
  {/if}
</article>

<style>
  /* ── Layout ─────────────────────────────────────────────── */

  .entity-detail {
    --detail-accent: #c49a5a;
    --detail-accent-muted: rgba(196, 154, 90, 0.35);
    --detail-accent-glow: rgba(196, 154, 90, 0.15);
    --detail-surface: var(--color-surface-2, #101420);
    --detail-surface-raised: var(--color-surface-3, #151a28);
    --detail-border: var(--color-border, #1c2235);
    --detail-text: var(--color-text-primary, #f2eed8);
    --detail-text-secondary: var(--color-text-secondary, #c4c9d4);
    --detail-text-muted: var(--color-text-muted, #8a93a6);
    --detail-text-disabled: var(--color-text-disabled, #4a5260);
    --detail-glass: rgba(12, 15, 21, 0.72);
    --detail-glass-blur: 12px;

    display: grid;
    gap: 0;
    min-width: 0;
    overflow: hidden;
  }

  .entity-detail > * {
    min-width: 0;
  }

  /* ── Hero ────────────────────────────────────────────────── */

  .hero {
    position: relative;
    overflow: hidden;
  }

  .hero[data-hero-mode="gradient"] {
    /* No reserved space — fits to content */
  }

  /* ── Sharp banner (mask fades bottom 10% into reflection) ── */

  .hero-banner {
    position: relative;
    z-index: 2;
    line-height: 0;
    mask-image: linear-gradient(to bottom, black 92%, transparent 100%);
    -webkit-mask-image: linear-gradient(to bottom, black 92%, transparent 100%);
  }

  .hero-banner img {
    width: 100%;
    height: auto;
    display: block;
    max-height: 22rem;
    object-fit: cover;
    filter: brightness(0.85) saturate(0.9);
  }

  /* ── Lower zone: reflection bg + content ──────────────── */

  .hero-lower {
    position: relative;
    margin-top: -5%;
    overflow: hidden;
  }

  /* Reflection: absolute, fills the lower zone as its background */
  .hero-reflection {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    mask-image: linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%);
    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%);
  }

  .hero-reflection img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scaleY(-1) scale(1.25);
  }

  /* Frosted glass: backdrop-filter blurs the reflection underneath */
  .hero-blur-overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
    backdrop-filter: blur(15px) saturate(1.3) brightness(0.5);
    -webkit-backdrop-filter: blur(15px) saturate(1.3) brightness(0.5);
    background: rgba(7, 8, 11, 0.45);
  }


  /* ── Poster-blur backdrop (no banner) ──────────────────── */

  .hero-backdrop {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
  }

  .hero-backdrop-img {
    position: absolute;
    inset: -40px;
  }

  .hero-backdrop-img img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center center;
    transform: scale(1.3);
  }

  .hero-backdrop-blur {
    position: absolute;
    inset: 0;
    backdrop-filter: blur(15px) saturate(1.3) brightness(0.5);
    -webkit-backdrop-filter: blur(15px) saturate(1.3) brightness(0.5);
    background: rgba(7, 8, 11, 0.45);
  }


  /* Gradient background when no images exist */
  .hero-gradient-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    background-size: cover;
  }

  /* ── Hero content (poster + text) ──────────────────────── */

  .hero-content {
    position: relative;
    display: flex;
    align-items: end;
    gap: 1.25rem;
    padding: 1.5rem;
    padding-top: 3rem;
    z-index: 3;
  }

  /* ── Poster / cover ────────────────────────────────────── */

  .poster-frame {
    flex-shrink: 0;
    width: var(--poster-width, 7rem);
    background: #050505;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(196, 154, 90, 0.2);
    overflow: hidden;
  }

  [data-poster-size="small"] .poster-frame { --poster-width: 5rem; }
  [data-poster-size="medium"] .poster-frame { --poster-width: 7rem; }
  [data-poster-size="large"] .poster-frame { --poster-width: 10rem; }

  .poster-frame img {
    display: block;
    width: 100%;
    height: auto;
    object-fit: cover;
  }

  .hero-text {
    display: grid;
    gap: 0.4rem;
    min-width: 0;
  }

  /* ── Action badges (favorite, nsfw, organized) ──────── */

  .action-badges {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .action-badge {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    border: 1px solid var(--detail-border);
    background: rgba(255, 255, 255, 0.04);
    color: var(--detail-text-disabled);
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s;
  }

  .action-badge:disabled {
    cursor: default;
    opacity: 0.5;
  }

  .action-badge:not(:disabled):hover {
    color: var(--detail-text-muted);
    border-color: var(--detail-text-muted);
  }

  /* Favorite — red when active */
  .action-badge.favorite.active {
    color: #e06070;
    border-color: rgba(224, 96, 112, 0.5);
    box-shadow: 0 0 10px rgba(224, 96, 112, 0.2);
  }

  .action-badge.favorite.active:not(:disabled):hover {
    color: #e06070;
    border-color: rgba(224, 96, 112, 0.7);
  }

  .action-badge.favorite.animating {
    animation: badge-pop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  /* NSFW — red fire, display only */
  .action-badge.nsfw {
    cursor: default;
    color: #e06070;
    border-color: rgba(224, 96, 112, 0.5);
    box-shadow: 0 0 8px rgba(224, 96, 112, 0.15);
  }

  /* Organized — green when active */
  .action-badge.organized.active {
    color: #80b898;
    border-color: rgba(78, 138, 98, 0.5);
    box-shadow: 0 0 10px rgba(78, 138, 98, 0.2);
  }

  .action-badge.organized.active:not(:disabled):hover {
    color: #80b898;
    border-color: rgba(78, 138, 98, 0.7);
  }

  .action-badge.organized.animating {
    animation: badge-pop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @keyframes badge-pop {
    0% { transform: scale(1); }
    40% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }

  h1 {
    margin: 0;
    font-family: var(--font-heading, Geist, sans-serif);
    font-size: clamp(1.4rem, 3vw, 2rem);
    font-weight: 700;
    line-height: 1.15;
    color: var(--detail-text);
  }

  /* ── Meta row (studio · date · count) ─────────────────── */

  .meta-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.15rem 0;
    font-size: 0.82rem;
    color: var(--detail-text-muted);
  }

  .meta-item {
    white-space: nowrap;
  }

  .meta-item.is-studio {
    color: var(--detail-accent);
  }

  .meta-sep {
    display: inline-block;
    width: 3px;
    height: 3px;
    margin: 0 0.5rem;
    background: var(--detail-text-muted);
    opacity: 0.5;
  }

  /* ── Rating (in hero) ──────────────────────────────────── */

  .rating-row {
    display: flex;
    gap: 0.15rem;
  }

  .rating-star {
    display: grid;
    height: 1.75rem;
    width: 1.75rem;
    place-items: center;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--detail-text-disabled);
    cursor: pointer;
    transition: color 0.15s, filter 0.15s;
  }

  .rating-star:hover:not(:disabled) {
    color: var(--detail-accent);
  }

  .rating-star.active {
    color: var(--detail-accent);
    filter: drop-shadow(0 0 6px var(--detail-accent-glow));
  }

  .rating-star:disabled {
    cursor: default;
    opacity: 0.7;
  }

  .position-badges {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
  }

  /* ── Detail Body ────────────────────────────────────────── */

  .detail-body {
    display: grid;
    gap: 0;
    padding: 1rem 1.5rem 1.5rem;
  }

  /* ── Description (markdown) ─────────────────────────────── */

  .description-content {
    color: var(--detail-text-secondary);
    font-size: 0.88rem;
    line-height: 1.65;
    padding: 0.5rem 0 1rem;
  }

  .description-content :global(p) {
    margin: 0 0 0.65rem;
  }

  .description-content :global(p:last-child) {
    margin-bottom: 0;
  }

  .description-content :global(a) {
    color: var(--detail-accent);
    text-decoration: underline;
    text-decoration-color: var(--detail-accent-muted);
    text-underline-offset: 2px;
  }

  .description-content :global(a:hover) {
    text-decoration-color: var(--detail-accent);
  }

  .description-content :global(strong) {
    color: var(--detail-text);
    font-weight: 600;
  }

  .description-content :global(em) {
    font-style: italic;
  }

  .description-content :global(code) {
    padding: 0.1em 0.35em;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.82em;
    color: var(--detail-text);
    background: var(--detail-surface-raised);
    border: 1px solid var(--detail-border);
  }

  .description-content :global(pre) {
    margin: 0.65rem 0;
    padding: 0.75rem 1rem;
    background: var(--detail-surface-raised);
    border: 1px solid var(--detail-border);
    overflow-x: auto;
  }

  .description-content :global(pre code) {
    padding: 0;
    border: none;
    background: none;
  }

  .description-content :global(ul),
  .description-content :global(ol) {
    margin: 0.5rem 0;
    padding-left: 1.4rem;
  }

  .description-content :global(li) {
    margin-bottom: 0.25rem;
  }

  .description-content :global(blockquote) {
    margin: 0.65rem 0;
    padding: 0.5rem 1rem;
    border-left: 3px solid var(--detail-accent-muted);
    color: var(--detail-text-muted);
    font-style: italic;
  }

  .description-content :global(h1),
  .description-content :global(h2),
  .description-content :global(h3),
  .description-content :global(h4) {
    margin: 1rem 0 0.5rem;
    font-family: var(--font-heading, Geist, sans-serif);
    color: var(--detail-text);
  }

  .description-content :global(h1) { font-size: 1.2rem; }
  .description-content :global(h2) { font-size: 1.05rem; }
  .description-content :global(h3) { font-size: 0.95rem; }

  .description-content :global(hr) {
    border: none;
    border-top: 1px solid var(--detail-border);
    margin: 1rem 0;
  }

  /* ── Tags ───────────────────────────────────────────────── */

  .tags-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.35rem;
    padding-top: 0.25rem;
  }

  .tags-label {
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--detail-text-muted);
    margin-right: 0.25rem;
  }

  .tag-chip {
    padding: 0.18rem 0.55rem;
    font-size: 0.75rem;
    color: var(--detail-text-secondary);
    border: 1px solid var(--detail-border);
    background: var(--detail-surface-raised);
    text-transform: uppercase;
    transition: border-color 0.15s, color 0.15s;
  }

  .tag-chip:hover {
    color: var(--detail-text);
    border-color: var(--detail-accent-muted);
  }

  /* ── Metadata sections ──────────────────────────────────── */

  .metadata-sections {
    padding: 0 1.5rem 1.5rem;
    border-top: 1px solid var(--detail-border);
  }

  .detail-section {
    padding: 1rem 0;
    border-bottom: 1px solid var(--detail-border);
  }

  .detail-section:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .section-label {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin: 0 0 0.75rem;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--detail-text-muted);
  }

  /* ── Links ──────────────────────────────────────────────── */

  .link-list {
    display: grid;
    gap: 0.35rem;
  }

  .link-item {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--detail-border);
    background: var(--detail-surface-raised);
    color: var(--detail-text-secondary);
    font-size: 0.82rem;
    text-decoration: none;
    transition: border-color 0.15s, color 0.15s;
  }

  a.link-item:hover {
    color: var(--detail-accent);
    border-color: var(--detail-accent-muted);
  }

  .link-item.no-url {
    color: var(--detail-text-muted);
  }

  /* ── Files ──────────────────────────────────────────────── */

  .file-list {
    display: grid;
    gap: 0;
  }

  .file-row {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    padding: 0.4rem 0;
    border-bottom: 1px solid color-mix(in srgb, var(--detail-border) 50%, transparent);
    font-size: 0.82rem;
  }

  .file-row:last-child {
    border-bottom: none;
  }

  .file-role {
    flex-shrink: 0;
    min-width: 4rem;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--detail-text-muted);
  }

  .file-path {
    color: var(--detail-text);
    word-break: break-all;
  }

  .file-mime {
    flex-shrink: 0;
    color: var(--detail-text-muted);
    font-size: 0.72rem;
  }

  /* ── Shared ─────────────────────────────────────────────── */

  .mono {
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.78rem;
  }

  /* ── Responsive ─────────────────────────────────────────── */

  @media (min-width: 640px) {
    .hero-banner img {
      max-height: 28rem;
    }

    .hero-content {
      padding: 2rem;
      padding-top: 3rem;
    }

    [data-poster-size="small"] .poster-frame { --poster-width: 6rem; }
    [data-poster-size="medium"] .poster-frame { --poster-width: 9rem; }
    [data-poster-size="large"] .poster-frame { --poster-width: 13rem; }

    .detail-body {
      padding: 1.25rem 2rem 2rem;
    }

    .metadata-sections {
      padding: 0 2rem 2rem;
    }
  }

  @media (min-width: 1024px) {
    .hero-banner img {
      max-height: 34rem;
    }

    [data-poster-size="small"] .poster-frame { --poster-width: 7rem; }
    [data-poster-size="medium"] .poster-frame { --poster-width: 11rem; }
    [data-poster-size="large"] .poster-frame { --poster-width: 16rem; }

    h1 {
      font-size: 2.2rem;
    }
  }
</style>
