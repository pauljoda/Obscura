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
  import type { EntityDetailCard, EntityDetailRating } from "$lib/entities/entity-detail";
  import { hasHero, hasPoster, presentSections } from "$lib/entities/entity-detail";
  import { placeholderGradient } from "$lib/entities/entity-thumbnail";

  interface Props {
    card: EntityDetailCard;
    onRatingChange?: (value: number | null) => void;
    ratingBusy?: boolean;
  }

  let { card, onRatingChange, ratingBusy = false }: Props = $props();

  const sections = $derived(presentSections(card));

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

<article class="entity-detail">
  <!-- Hero / Banner -->
  <div
    class="hero"
    class:has-image={hasHero(card)}
    style:background-image={hasHero(card)
      ? `url(${card.hero!.src})`
      : placeholderGradient(card.entity.title)}
  >
    <div class="hero-scrim"></div>

    <div class="hero-content">
      {#if hasPoster(card)}
        <div class="poster-frame">
          <img src={card.poster!.src} alt={card.poster!.alt} />
        </div>
      {/if}

      <div class="hero-text">
        <span class="kind-badge">{card.kindLabel}</span>
        <h1>{card.entity.title}</h1>

        {#if card.positions.length > 0}
          <div class="position-badges">
            {#each card.positions as pos (pos.code)}
              <span class="position-badge">{pos.label}</span>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>

  <div class="detail-body">
    <!-- Primary Row: Flags + Rating + Classification -->
    {#if sections.includes("flags") || sections.includes("rating") || sections.includes("classification")}
      <div class="primary-row">
        {#if card.flags.length > 0}
          <div class="flag-badges">
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
          </div>
        {/if}

        {#if card.classification}
          <span class="classification-badge">
            <Layers class="h-3.5 w-3.5" />
            {card.classification.value}
          </span>
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
                <Star class="h-4 w-4" />
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Description -->
    {#if renderedDescription}
      <section class="detail-section description-section">
        <div class="description-content markdown-body">
          {@html renderedDescription}
        </div>
      </section>
    {/if}

    <!-- Tags -->
    {#if card.tags.length > 0}
      <section class="detail-section">
        <h2 class="section-label">
          <Tag class="h-4 w-4" />
          Tags
        </h2>
        <div class="tag-chips">
          {#each card.tags as tag (tag)}
            <span class="tag-chip">{tag}</span>
          {/each}
        </div>
      </section>
    {/if}

    <!-- Studio + Credits -->
    {#if card.studio || card.credits.length > 0}
      <section class="detail-section">
        <h2 class="section-label">
          <User class="h-4 w-4" />
          Credits
        </h2>
        <div class="credits-grid">
          {#if card.studio}
            <div class="credit-item studio-credit">
              <Building2 class="h-4 w-4" />
              <div>
                <span class="credit-role">Studio</span>
                <span class="credit-name">{card.studio.title}</span>
              </div>
            </div>
          {/if}
          {#each card.credits as credit (credit.id)}
            <div class="credit-item">
              <User class="h-4 w-4" />
              <span class="credit-name">{credit.title}</span>
            </div>
          {/each}
        </div>
      </section>
    {/if}

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
    border: 1px solid var(--detail-border);
    background: var(--detail-surface);
  }

  /* ── Hero ────────────────────────────────────────────────── */

  .hero {
    position: relative;
    display: grid;
    min-height: 14rem;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    overflow: hidden;
  }

  .hero.has-image {
    min-height: 18rem;
  }

  .hero-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to top,
      rgba(7, 8, 11, 0.95) 0%,
      rgba(7, 8, 11, 0.6) 40%,
      rgba(7, 8, 11, 0.25) 100%
    );
  }

  .hero-content {
    position: relative;
    display: flex;
    align-items: end;
    gap: 1.25rem;
    padding: 1.5rem;
    z-index: 1;
    align-self: end;
  }

  .poster-frame {
    flex-shrink: 0;
    width: 7rem;
    border: 1px solid var(--detail-border);
    background: #050505;
    box-shadow:
      0 4px 24px rgba(0, 0, 0, 0.5),
      0 0 0 1px var(--detail-accent-muted);
    overflow: hidden;
  }

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

  /* ── Primary Row (flags, rating, classification) ────────── */

  .primary-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.6rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--detail-border);
    margin-bottom: 1rem;
  }

  .flag-badges {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
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

  .classification-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.5rem;
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--detail-text-muted);
    border: 1px solid var(--detail-border);
    background: var(--detail-surface-raised);
    text-transform: capitalize;
  }

  .rating-row {
    display: flex;
    gap: 0.2rem;
    margin-left: auto;
  }

  .rating-star {
    display: grid;
    height: 2rem;
    width: 2rem;
    place-items: center;
    padding: 0;
    border: 1px solid var(--detail-border);
    background: var(--detail-surface-raised);
    color: var(--detail-text-disabled);
    cursor: pointer;
    transition: color 0.15s, border-color 0.15s, box-shadow 0.15s;
  }

  .rating-star:hover:not(:disabled) {
    color: var(--detail-accent);
    border-color: var(--detail-accent-muted);
  }

  .rating-star.active {
    color: var(--detail-accent);
    border-color: var(--detail-accent);
    box-shadow: 0 0 16px var(--detail-accent-glow);
  }

  .rating-star:disabled {
    cursor: default;
    opacity: 0.7;
  }

  /* ── Sections ───────────────────────────────────────────── */

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

  /* ── Description (markdown) ─────────────────────────────── */

  .description-section {
    padding-top: 1rem;
  }

  .description-content {
    color: var(--detail-text-secondary);
    font-size: 0.88rem;
    line-height: 1.65;
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

  .tag-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .tag-chip {
    padding: 0.2rem 0.55rem;
    font-size: 0.75rem;
    color: var(--detail-text-secondary);
    border: 1px solid var(--detail-border);
    background: var(--detail-surface-raised);
    transition: border-color 0.15s, color 0.15s;
  }

  .tag-chip:hover {
    color: var(--detail-text);
    border-color: var(--detail-accent-muted);
  }

  /* ── Credits ────────────────────────────────────────────── */

  .credits-grid {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
  }

  .credit-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.65rem;
    border: 1px solid var(--detail-border);
    background: var(--detail-surface-raised);
    color: var(--detail-text-secondary);
    font-size: 0.82rem;
    transition: border-color 0.15s;
  }

  .credit-item:hover {
    border-color: var(--detail-accent-muted);
  }

  .studio-credit {
    border-color: var(--detail-accent-muted);
  }

  .credit-role {
    display: block;
    font-size: 0.65rem;
    font-family: var(--font-mono, "JetBrains Mono", monospace);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--detail-text-muted);
  }

  .credit-name {
    color: var(--detail-text);
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
    .hero.has-image {
      min-height: 22rem;
    }

    .hero-content {
      padding: 2rem;
    }

    .poster-frame {
      width: 9rem;
    }

    .detail-body {
      padding: 1.25rem 2rem 2rem;
    }
  }

  @media (min-width: 1024px) {
    .hero.has-image {
      min-height: 26rem;
    }

    .poster-frame {
      width: 11rem;
    }

    h1 {
      font-size: 2.2rem;
    }
  }
</style>
