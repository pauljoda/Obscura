<script lang="ts">
  import { ChevronDown, Loader2 } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import type { NormalizedSeriesCandidate } from "@obscura/contracts";

  interface GalleryCandidate {
    externalIds: Record<string, string>;
    title: string;
    year?: number | null;
    overview?: string | null;
    posterUrl?: string | null;
    language?: string | null;
    contentRating?: string | null;
    source?: string | null;
    popularity?: number | null;
  }

  type Candidate = NormalizedSeriesCandidate | GalleryCandidate;

  interface Props {
    candidates: Candidate[];
    picked: string | null;
    rerunning: boolean;
    onPick: (externalId: string) => void;
  }

  let { candidates, picked, rerunning, onPick }: Props = $props();
  let selectedLanguage = $state<string | null>(null);

  function candidateId(c: Candidate): string {
    if (c.externalIds.tmdb) return c.externalIds.tmdb;
    if (c.externalIds.mangadex) {
      return [c.externalIds.mangadex, c.externalIds.mangadexChapter, c.externalIds.language]
        .filter(Boolean)
        .join(":");
    }
    return Object.values(c.externalIds)[0] ?? c.title + (c.year ?? "");
  }

  function candidateReviewKey(c: Candidate, index: number): string {
    return `${candidateId(c)}:${c.title}:${c.year ?? ""}:${index}`;
  }

  function candidateMeta(c: Candidate): string {
    const parts = [
      "language" in c ? c.language : null,
      "contentRating" in c ? c.contentRating : null,
      c.year ? String(c.year) : null,
    ].filter((part): part is string => Boolean(part));
    return parts.join(" · ");
  }

  function candidateLanguage(c: Candidate): string | null {
    return "language" in c ? c.language ?? null : null;
  }

  const LANGUAGE_FLAGS: Record<string, string> = {
    ar: "🇸🇦",
    cs: "🇨🇿",
    de: "🇩🇪",
    en: "🇬🇧",
    es: "🇪🇸",
    "es-la": "🌎",
    fr: "🇫🇷",
    hi: "🇮🇳",
    hu: "🇭🇺",
    id: "🇮🇩",
    it: "🇮🇹",
    ja: "🇯🇵",
    "ja-ro": "🇯🇵",
    ko: "🇰🇷",
    nl: "🇳🇱",
    pl: "🇵🇱",
    pt: "🇵🇹",
    "pt-br": "🇧🇷",
    ro: "🇷🇴",
    ru: "🇷🇺",
    th: "🇹🇭",
    tr: "🇹🇷",
    uk: "🇺🇦",
    vi: "🇻🇳",
    zh: "🇨🇳",
    "zh-hk": "🇭🇰",
    "zh-ro": "🇨🇳",
  };

  function languageLabel(language: string): string {
    return `${LANGUAGE_FLAGS[language.toLowerCase()] ?? "🌐"} ${language}`;
  }

  const languages = $derived(
    Array.from(
      new Set(
        candidates
          .map(candidateLanguage)
          .filter((language): language is string => Boolean(language)),
      ),
    ),
  );

  $effect(() => {
    if (languages.length === 0) {
      selectedLanguage = null;
      return;
    }
    if (selectedLanguage && languages.includes(selectedLanguage)) return;
    selectedLanguage = languages.includes("en") ? "en" : languages[0];
  });

  const visibleCandidates = $derived(
    selectedLanguage
      ? candidates.filter((candidate) => candidateLanguage(candidate) === selectedLanguage)
      : candidates,
  );
</script>

<div class="border-b border-border-accent/30 bg-surface-2/40 p-4">
  <div
    class="mb-2 flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.14em] text-text-muted"
  >
    Multiple matches — pick one
    {#if rerunning}
      <span class="flex items-center gap-1 text-text-accent">
        <Loader2 class="h-3 w-3 animate-spin" /> refetching…
      </span>
    {/if}
  </div>
  {#if languages.length > 1}
    <div class="mb-3 flex items-center gap-2">
      <span class="text-[0.6rem] uppercase tracking-[0.14em] text-text-disabled">Language</span>
      <div class="relative min-w-28">
        <select
          bind:value={selectedLanguage}
          disabled={rerunning}
          class="w-full appearance-none border border-white/10 bg-black/30 py-1 pl-3 pr-9 text-[0.68rem] text-text-primary focus:outline-none focus:border-border-accent disabled:opacity-50"
        >
          {#each languages as language (language)}
            <option value={language}>{languageLabel(language)}</option>
          {/each}
        </select>
        <ChevronDown
          class="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
        />
      </div>
    </div>
  {/if}
  <div class="grid grid-cols-2 gap-2 md:grid-cols-3">
    {#each visibleCandidates as c, index (candidateReviewKey(c, index))}
      {@const id = candidateId(c)}
      {@const isPicked = id === picked}
      <button
        type="button"
        onclick={() => onPick(id)}
        disabled={rerunning}
        class={cn(
          "surface-card no-lift flex gap-2 p-2 text-left transition-colors",
          isPicked && "border-border-accent",
          rerunning && "opacity-50 cursor-not-allowed",
        )}
      >
        {#if c.posterUrl}
          <img
            src={c.posterUrl}
            alt=""
            loading="lazy"
            class="h-16 w-12 flex-shrink-0 object-cover"
          />
        {/if}
        <div class="min-w-0 flex-1 space-y-0.5">
          <div class="truncate text-[0.72rem] font-medium">{c.title}</div>
          {#if candidateMeta(c)}
            <div class="text-[0.6rem] text-text-muted">{candidateMeta(c)}</div>
          {/if}
          {#if c.overview}
            <div class="line-clamp-2 text-[0.6rem] text-text-muted">{c.overview}</div>
          {/if}
        </div>
      </button>
    {/each}
  </div>
</div>
