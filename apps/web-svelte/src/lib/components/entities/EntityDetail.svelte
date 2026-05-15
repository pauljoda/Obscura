<script lang="ts">
  import { marked } from "marked";
  import {
    Star,
    Heart,
    ShieldAlert,
    CheckCircle,
    ExternalLink,
    Clock,
    Hash,
    User,
    Building2,
    Tag,
    Calendar,
    FileText,
    Fingerprint,
    Bookmark,
    Captions,
    BarChart3,
    MapPin,
    Link,
    Database,
    Layers,
  } from "@lucide/svelte";
  import EntityThumbnail from "$lib/components/thumbnails/EntityThumbnail.svelte";
  import type { EntityThumbnailCard } from "$lib/entities/entity-thumbnail";
  import type {
    EntityDetailCard,
    EntityDetailCredit,
    EntityDetailRating,
  } from "$lib/entities/entity-detail";
  import { hasHero, hasPoster, presentSections } from "$lib/entities/entity-detail";
  import { placeholderGradient } from "$lib/entities/entity-thumbnail";

  export type EntityDetailPosterSize = "none" | "small" | "medium" | "large";

  interface Props {
    card: EntityDetailCard;
    onRatingChange?: (value: number | null) => void;
    posterSize?: EntityDetailPosterSize;
    ratingBusy?: boolean;
    showHero?: boolean;
    debugNoBlur?: boolean;
  }

  let {
    card,
    onRatingChange,
    posterSize = "medium",
    ratingBusy = false,
    showHero = true,
    debugNoBlur = false,
  }: Props = $props();

  type HeroMode = "image" | "poster-blur" | "gradient";

  const heroMode = $derived.by((): HeroMode => {
    if (!showHero) return "gradient";
    if (hasHero(card)) return "image";
    if (hasPoster(card)) return "poster-blur";
    return "gradient";
  });

  const posterVisible = $derived(posterSize !== "none" && hasPoster(card));

  const sections = $derived(presentSections(card));

  const renderedDescription = $derived.by(() => {
    if (!card.description) return null;
    const renderer = new marked.Renderer();
    renderer.link = ({ href, text }) =>
      `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    return marked.parse(card.description, { renderer, async: false, gfm: true, breaks: true }) as string;
  });

  function creditToThumbnailCard(credit: EntityDetailCredit): EntityThumbnailCard {
    return {
      entity: { id: credit.id, kind: credit.kind, title: credit.title, capabilities: [] },
      aspectRatio: credit.kind === "studio" ? "square" : "portrait",
      cover: credit.thumbnail ? { src: credit.thumbnail, alt: credit.title } : null,
      hover: { kind: "none" },
    };
  }

  const metaItems = $derived.by(() => {
    const items: string[] = [];
    if (card.studio) items.push(card.studio.title);
    if (card.dates.length > 0) items.push(card.dates[0].value);
    const firstStat = card.stats[0] ?? card.counters[0];
    if (firstStat) items.push(`${firstStat.value} ${firstStat.label.toLowerCase()}`);
    return items;
  });

  function handleRatingClick(value: number) {
    if (!onRatingChange || ratingBusy || !card.rating) return;
    const nextValue = card.rating.value === value ? null : value;
    onRatingChange(nextValue);
  }
</script>

<article class="entity-detail" data-poster-size={posterSize} data-hero-mode={heroMode}>
  <!-- Hero -->
  <div class="hero" data-hero-mode={heroMode} data-no-blur={debugNoBlur || undefined}>

    {#snippet heroContent()}
      <div class="hero-content">
        {#if posterVisible}
          <div class="poster-frame">
            <img src={card.poster!.src} alt={card.poster!.alt} />
          </div>
        {/if}

        <div class="hero-text">
          <span class="kind-badge">{card.kindLabel}</span>
          <h1>{card.entity.title}</h1>

          {#if metaItems.length > 0}
            <div class="meta-row">
              {#each metaItems as item, i (i)}
                {#if i > 0}<span class="meta-sep"></span>{/if}
                <span class="meta-item" class:is-studio={i === 0 && card.studio != null}>{item}</span>
              {/each}
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

          {#if card.positions.length > 0}
            <div class="position-badges">
              {#each card.positions as pos (pos.code)}
                <span class="position-badge">{pos.label}</span>
              {/each}
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
        <div class="hero-bottom-fade"></div>
        {@render heroContent()}
      </div>
    {:else if heroMode === "poster-blur"}
      <div class="hero-backdrop poster-mode">
        <div class="hero-backdrop-img">
          <img src={card.poster!.src} alt="" aria-hidden="true" />
        </div>
        <div class="hero-backdrop-blur"></div>
        <div class="hero-backdrop-fade"></div>
      </div>
      {@render heroContent()}
    {:else}
      <div class="hero-gradient-bg" style:background-image={placeholderGradient(card.entity.title)}></div>
      {@render heroContent()}
    {/if}
  </div>

  <div class="detail-body">
    <!-- Flags row -->
    {#if card.flags.length > 0}
      <div class="flags-row">
        {#each card.flags as flag (flag.code)}
          <span class="flag-badge" class:active={flag.active} data-flag={flag.code}>
            {#if flag.code === "favorite"}
              <Heart class="h-3.5 w-3.5" />
            {:else if flag.code === "nsfw"}
              <ShieldAlert class="h-3.5 w-3.5" />
            {:else}
              <CheckCircle class="h-3.5 w-3.5" />
            {/if}
            {flag.label}
          </span>
        {/each}

        {#if card.classification}
          <span class="flag-badge classification">
            <Layers class="h-3.5 w-3.5" />
            {card.classification.value}
          </span>
        {/if}
      </div>
    {/if}

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

  <!-- Studio -->
  {#if card.studio}
    <section class="studio-section">
      <h2 class="credits-heading">Studio</h2>
      <div class="studio-row">
        <div class="studio-card">
          <EntityThumbnail card={creditToThumbnailCard(card.studio)} />
        </div>
      </div>
    </section>
  {/if}

  <!-- Credits (horizontal scroll of EntityThumbnails) -->
  {#if card.credits.length > 0}
    <section class="credits-section">
      <h2 class="credits-heading">Cast & Crew</h2>
      <div class="credits-scroll">
        {#each card.credits as credit (credit.id)}
          <div class="credit-card">
            <EntityThumbnail card={creditToThumbnailCard(credit)} />
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- Lower sections: collapsible metadata -->
  {#if sections.includes("stats") || sections.includes("progress") || sections.includes("dates") || sections.includes("technical") || sections.includes("markers") || sections.includes("subtitles") || sections.includes("links") || sections.includes("files") || sections.includes("fingerprints") || sections.includes("sources")}
    <div class="metadata-sections">
      <!-- Stats + Counters -->
      {#if card.stats.length > 0 || card.counters.length > 0}
        <section class="detail-section">
          <h2 class="section-label">
            <BarChart3 class="h-4 w-4" />
            Stats
          </h2>
          <div class="stat-grid">
            {#each card.stats as stat (stat.code)}
              <div class="stat-item">
                <span class="stat-value">{stat.value}</span>
                <span class="stat-label">{stat.label}</span>
              </div>
            {/each}
            {#each card.counters as counter (counter.code)}
              <div class="stat-item">
                <span class="stat-value">{counter.value}</span>
                <span class="stat-label">{counter.label}</span>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Progress -->
      {#if card.progress}
        <section class="detail-section">
          <h2 class="section-label">
            <BarChart3 class="h-4 w-4" />
            Progress
          </h2>
          <div class="progress-block">
            <div class="progress-bar">
              <div class="progress-fill" style:width={`${card.progress.percent}%`}></div>
            </div>
            <div class="progress-meta">
              <span>{card.progress.index} / {card.progress.total} {card.progress.unit}</span>
              <span>{card.progress.percent}%</span>
            </div>
            {#if card.progress.mode}
              <span class="progress-mode">{card.progress.mode}</span>
            {/if}
            {#if card.progress.completed}
              <span class="progress-completed">
                <CheckCircle class="h-3.5 w-3.5" />
                Completed
              </span>
            {/if}
          </div>
        </section>
      {/if}

      <!-- Dates -->
      {#if card.dates.length > 0}
        <section class="detail-section">
          <h2 class="section-label">
            <Calendar class="h-4 w-4" />
            Dates
          </h2>
          <div class="kv-list">
            {#each card.dates as date (date.code)}
              <div class="kv-row">
                <span class="kv-key">{date.label}</span>
                <span class="kv-value">{date.value}</span>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Technical -->
      {#if card.technical.length > 0}
        <section class="detail-section">
          <h2 class="section-label">
            <Hash class="h-4 w-4" />
            Technical
          </h2>
          <div class="kv-list">
            {#each card.technical as row (row.label)}
              <div class="kv-row">
                <span class="kv-key">{row.label}</span>
                <span class="kv-value mono">{row.value}</span>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Markers -->
      {#if card.markers.length > 0}
        <section class="detail-section">
          <h2 class="section-label">
            <Bookmark class="h-4 w-4" />
            Markers
          </h2>
          <div class="marker-list">
            {#each card.markers as marker (marker.id)}
              <div class="marker-row">
                <span class="marker-time mono">{marker.timestamp}</span>
                <span class="marker-title">{marker.title}</span>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Subtitles -->
      {#if card.subtitles.length > 0}
        <section class="detail-section">
          <h2 class="section-label">
            <Captions class="h-4 w-4" />
            Subtitles
          </h2>
          <div class="subtitle-list">
            {#each card.subtitles as sub (sub.id)}
              <div class="subtitle-row">
                <span class="subtitle-lang">{sub.language}</span>
                {#if sub.label}
                  <span class="subtitle-label">{sub.label}</span>
                {/if}
                <span class="subtitle-meta mono">{sub.format} · {sub.source}</span>
                {#if sub.isDefault}
                  <span class="subtitle-default">default</span>
                {/if}
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Links -->
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
                  {#if link.provider}
                    <Database class="h-3.5 w-3.5" />
                  {:else}
                    <Link class="h-3.5 w-3.5" />
                  {/if}
                  {link.label}
                </span>
              {/if}
            {/each}
          </div>
        </section>
      {/if}

      <!-- Files -->
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

      <!-- Fingerprints -->
      {#if card.fingerprints.length > 0}
        <section class="detail-section">
          <h2 class="section-label">
            <Fingerprint class="h-4 w-4" />
            Fingerprints
          </h2>
          <div class="kv-list">
            {#each card.fingerprints as fp (fp.algorithm)}
              <div class="kv-row">
                <span class="kv-key">{fp.algorithm}</span>
                <span class="kv-value mono">{fp.value}</span>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <!-- Sources -->
      {#if card.sources.length > 0}
        <section class="detail-section">
          <h2 class="section-label">
            <Database class="h-4 w-4" />
            Sources
          </h2>
          <div class="kv-list">
            {#each card.sources as src (src.code)}
              <div class="kv-row">
                <span class="kv-key">{src.code}</span>
                <span class="kv-value mono">{src.value}</span>
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
    mask-image: linear-gradient(to bottom, black 90%, transparent 100%);
    -webkit-mask-image: linear-gradient(to bottom, black 90%, transparent 100%);
  }

  .hero-banner img {
    width: 100%;
    height: auto;
    display: block;
    max-height: 22rem;
    object-fit: cover;
  }

  /* ── Lower zone: reflection bg + content ──────────────── */

  .hero-lower {
    position: relative;
    margin-top: -10%;
    overflow: hidden;
  }

  /* Reflection: absolute, fills the lower zone as its background */
  .hero-reflection {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 100%);
    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 100%);
  }

  .hero-reflection img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scaleY(-1) scale(1.12);
    filter: blur(32px) saturate(1.3) brightness(0.5);
  }

  .hero[data-no-blur] .hero-reflection {
    mask-image: none;
    -webkit-mask-image: none;
  }

  .hero[data-no-blur] .hero-reflection img {
    filter: none;
    transform: scaleY(-1);
  }

  /* Scrim + noise grain to break color banding */
  .hero-blur-overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: rgba(7, 8, 11, 0.3);
  }

  .hero-blur-overlay::after {
    content: '';
    position: absolute;
    inset: 0;
    opacity: 0.035;
    mix-blend-mode: overlay;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-size: 200px 200px;
    pointer-events: none;
  }

  .hero[data-no-blur] .hero-blur-overlay {
    background: none;
  }

  .hero[data-no-blur] .hero-blur-overlay::after {
    display: none;
  }

  /* Bottom fade to page bg */
  .hero-bottom-fade {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 40%;
    z-index: 2;
    background: linear-gradient(to top, var(--color-bg, #07080b) 0%, transparent 100%);
    pointer-events: none;
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
    backdrop-filter: blur(48px) saturate(1.5) brightness(0.55);
    -webkit-backdrop-filter: blur(48px) saturate(1.5) brightness(0.55);
    background: rgba(7, 8, 11, 0.2);
  }

  .hero[data-no-blur] .hero-backdrop-blur {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: none;
  }

  .hero-backdrop-fade {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 40%;
    background: linear-gradient(to top, var(--color-bg, #07080b) 0%, transparent 100%);
    pointer-events: none;
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

  .kind-badge {
    display: inline-block;
    width: fit-content;
    padding: 0.15rem 0.5rem;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--detail-accent);
    border: 1px solid var(--detail-accent-muted);
    background: rgba(196, 154, 90, 0.08);
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

  .position-badge {
    padding: 0.1rem 0.4rem;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.68rem;
    color: var(--detail-text-muted);
    border: 1px solid var(--detail-border);
    background: var(--detail-glass);
    backdrop-filter: blur(var(--detail-glass-blur));
  }

  /* ── Detail Body ────────────────────────────────────────── */

  .detail-body {
    display: grid;
    gap: 0;
    padding: 1rem 1.5rem 1.5rem;
  }

  /* ── Flags row ─────────────────────────────────────────── */

  .flags-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.35rem;
    padding-bottom: 0.85rem;
  }

  .flag-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.5rem;
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--detail-text-muted);
    border: 1px solid var(--detail-border);
    background: var(--detail-surface-raised);
  }

  .flag-badge.active {
    color: var(--detail-text);
    border-color: var(--detail-accent-muted);
  }

  .flag-badge.active[data-flag="favorite"] {
    color: #e06070;
    border-color: rgba(224, 96, 112, 0.4);
    box-shadow: 0 0 10px rgba(224, 96, 112, 0.15);
  }

  .flag-badge.active[data-flag="nsfw"] {
    color: #e06070;
    border-color: rgba(224, 96, 112, 0.4);
    box-shadow: 0 0 10px rgba(224, 96, 112, 0.15);
  }

  .flag-badge.active[data-flag="organized"] {
    color: #80b898;
    border-color: rgba(78, 138, 98, 0.4);
    box-shadow: 0 0 10px rgba(78, 138, 98, 0.15);
  }

  .flag-badge.classification {
    text-transform: capitalize;
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

  /* ── Studio row ─────────────────────────────────────────── */

  .studio-section {
    padding: 0 1.5rem 1rem;
  }

  .studio-row {
    display: flex;
  }

  .studio-card {
    width: 7rem;
  }

  /* ── Credits (horizontal scroll) ───────────────────────── */

  .credits-section {
    padding: 0 1.5rem 1.5rem;
  }

  .credits-heading {
    margin: 0 0 0.6rem;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--detail-accent);
  }

  .credits-scroll {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 0.5rem;
    scrollbar-width: thin;
    scrollbar-color: var(--detail-border) transparent;
  }

  .credits-scroll::-webkit-scrollbar {
    height: 4px;
  }

  .credits-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .credits-scroll::-webkit-scrollbar-thumb {
    background: var(--detail-border);
  }

  .credit-card {
    flex-shrink: 0;
    width: 6rem;
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

  /* ── Stat Grid ──────────────────────────────────────────── */

  .stat-grid {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
  }

  .stat-item {
    display: grid;
    gap: 0.15rem;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--detail-border);
    background: var(--detail-surface-raised);
  }

  .stat-value {
    font-family: var(--font-heading, Geist, sans-serif);
    font-size: 1.4rem;
    font-weight: 700;
    line-height: 1;
    color: var(--detail-text);
  }

  .stat-label {
    font-size: 0.68rem;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--detail-text-muted);
  }

  /* ── Progress ───────────────────────────────────────────── */

  .progress-block {
    display: grid;
    gap: 0.45rem;
  }

  .progress-bar {
    height: 6px;
    background: var(--detail-surface-raised);
    border: 1px solid var(--detail-border);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--detail-accent), #e0c48e);
    box-shadow: 0 0 12px var(--detail-accent-glow);
    transition: width 0.3s ease;
  }

  .progress-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.78rem;
    color: var(--detail-text-secondary);
  }

  .progress-mode {
    font-size: 0.68rem;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--detail-text-muted);
  }

  .progress-completed {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    width: fit-content;
    font-size: 0.72rem;
    color: #80b898;
  }

  /* ── Key-Value List ─────────────────────────────────────── */

  .kv-list {
    display: grid;
    gap: 0;
  }

  .kv-row {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    padding: 0.4rem 0;
    border-bottom: 1px solid color-mix(in srgb, var(--detail-border) 50%, transparent);
    font-size: 0.82rem;
  }

  .kv-row:last-child {
    border-bottom: none;
  }

  .kv-key {
    flex-shrink: 0;
    min-width: 6rem;
    color: var(--detail-text-muted);
  }

  .kv-value {
    color: var(--detail-text);
    word-break: break-all;
  }

  /* ── Markers ────────────────────────────────────────────── */

  .marker-list {
    display: grid;
    gap: 0;
  }

  .marker-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.45rem 0;
    border-bottom: 1px solid color-mix(in srgb, var(--detail-border) 50%, transparent);
    font-size: 0.82rem;
    cursor: default;
    transition: background 0.12s;
  }

  .marker-row:last-child {
    border-bottom: none;
  }

  .marker-row:hover {
    background: var(--detail-surface-raised);
  }

  .marker-time {
    flex-shrink: 0;
    min-width: 4rem;
    color: var(--detail-accent);
    font-weight: 500;
  }

  .marker-title {
    color: var(--detail-text);
  }

  /* ── Subtitles ──────────────────────────────────────────── */

  .subtitle-list {
    display: grid;
    gap: 0;
  }

  .subtitle-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.45rem 0;
    border-bottom: 1px solid color-mix(in srgb, var(--detail-border) 50%, transparent);
    font-size: 0.82rem;
  }

  .subtitle-row:last-child {
    border-bottom: none;
  }

  .subtitle-lang {
    min-width: 5rem;
    color: var(--detail-text);
  }

  .subtitle-label {
    color: var(--detail-text-secondary);
  }

  .subtitle-meta {
    color: var(--detail-text-muted);
    font-size: 0.72rem;
  }

  .subtitle-default {
    padding: 0.08rem 0.35rem;
    font-size: 0.62rem;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--detail-accent);
    border: 1px solid var(--detail-accent-muted);
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

    .studio-section {
      padding: 0 2rem 1rem;
    }

    .credits-section {
      padding: 0 2rem 2rem;
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
