<script lang="ts">
  import { onMount } from "svelte";
  import {
    Play,
    Film,
    Layers,
    Image as ImageIcon,
    Music,
    FolderOpen,
    Users,
    Building2,
  } from "@lucide/svelte";
  import { cn, MediaCard, type PerformerRef } from "@obscura/ui-svelte";
  import { toApiUrl } from "$lib/api/core";
  import { VIDEO_CARD_GRADIENTS } from "$lib/dashboard-utils";
  import NsfwBlur from "$lib/components/NsfwBlur.svelte";
  import NsfwShowModeChip from "$lib/components/NsfwShowModeChip.svelte";
  import { useNsfw } from "$lib/stores/nsfw.svelte";

  let { data } = $props();
  const nsfw = useNsfw();

  const featuredVideos = $derived(
    data.featuredVideos.filter((v) => nsfw.mode === "show" || !v.isNsfw),
  );
  const recentVideos = $derived(
    data.recentVideos.filter((v) => nsfw.mode === "show" || !v.isNsfw),
  );
  const galleries = $derived(
    data.galleries.filter((g) => nsfw.mode === "show" || !g.isNsfw),
  );
  const images = $derived(
    data.images.filter((i) => nsfw.mode === "show" || !i.isNsfw),
  );
  const audioLibraries = $derived(
    data.audioLibraries.filter((a) => nsfw.mode === "show" || !a.isNsfw),
  );
  const series = $derived(data.series.filter((s) => nsfw.mode === "show" || !s.isNsfw));
  const performers = $derived(
    data.performers.filter((p) => nsfw.mode === "show" || !p.isNsfw),
  );
  const studios = $derived(
    data.studios.filter((s) => nsfw.mode === "show" || !s.isNsfw),
  );

  const hasAnyContent = $derived(
    featuredVideos.length > 0 ||
      recentVideos.length > 0 ||
      galleries.length > 0 ||
      images.length > 0 ||
      audioLibraries.length > 0 ||
      series.length > 0 ||
      performers.length > 0 ||
      studios.length > 0,
  );

  let currentIndex = $state(0);

  onMount(() => {
    if (featuredVideos.length <= 1) return;
    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % featuredVideos.length;
    }, 8000);
    return () => clearInterval(interval);
  });
</script>

<svelte:head>
  <title>Dashboard — Obscura</title>
</svelte:head>

{#if !hasAnyContent}
  <div class="min-h-[80vh] flex flex-col items-center justify-center text-center p-8">
    <div
      class="w-24 h-24 mb-8 text-accent-500/20 flex items-center justify-center rounded-full bg-surface-2 border border-border-subtle"
    >
      <Film class="w-10 h-10" />
    </div>
    <h1 class="text-3xl font-bold text-text-primary mb-4">Your library is empty</h1>
    <p class="text-text-muted max-w-md mb-8">
      It looks like you haven't added any media yet, or your current filters are hiding everything.
      Head over to Settings to configure your library roots and start scanning.
    </p>
    <a
      href="/settings"
      class="bg-accent-500 hover:bg-accent-400 text-accent-950 px-6 py-2.5 font-semibold transition-all duration-normal hover:shadow-[0_0_16px_rgba(196,154,90,0.3)]"
    >
      Configure library
    </a>
  </div>
{:else}
  <div class="min-h-screen bg-bg text-text-primary pb-24 -m-5">
    <!-- Hero -->
    {#if featuredVideos.length > 0}
      <div
        class="relative w-full h-[70vh] min-h-[500px] max-h-[800px] overflow-hidden bg-surface-1"
      >
        {#each featuredVideos as video, index (video.id)}
          {@const isActive = index === currentIndex}
          {@const heroThumb = toApiUrl(video.cardThumbnailPath) ?? toApiUrl(video.thumbnailPath)}
          <div
            class={cn(
              "absolute inset-0 transition-opacity duration-[1500ms] ease-in-out",
              isActive ? "opacity-100 z-10" : "opacity-0 z-0",
            )}
          >
            {#if heroThumb}
              <img
                src={heroThumb}
                alt={video.title}
                class={cn(
                  "w-full h-full object-cover transform-gpu transition-transform duration-[10000ms] ease-out",
                  isActive ? "scale-105" : "scale-100",
                )}
              />
            {/if}
          </div>
        {/each}

        <!-- Cinematic gradient overlay -->
        <div class="absolute inset-0 z-20 bg-gradient-to-t from-bg via-bg/60 to-transparent"></div>
        <div class="absolute inset-0 z-20 bg-gradient-to-r from-bg via-bg/40 to-transparent"></div>

        <!-- Hero content -->
        <div class="absolute bottom-0 left-0 w-full p-8 md:p-16 z-30 flex flex-col justify-end">
          <div class="max-w-3xl grid" style:grid-template-areas="'stack'">
            {#each featuredVideos as video, index (video.id)}
              {@const isActive = index === currentIndex}
              <div
                style:grid-area="stack"
                class={cn(
                  "transition-all duration-normal flex flex-col justify-end",
                  isActive
                    ? "opacity-100 translate-y-0 pointer-events-auto z-10"
                    : "opacity-0 translate-y-4 pointer-events-none z-0",
                )}
              >
                <div
                  class="flex items-center gap-3 text-accent-500 font-mono text-sm tracking-widest uppercase mb-4"
                >
                  <span class="flex items-center gap-1">
                    <Film class="w-4 h-4" />
                    Featured
                  </span>
                  {#if video.isNsfw}
                    <span class="text-text-muted">•</span>
                    <NsfwShowModeChip isNsfw={video.isNsfw} />
                  {/if}
                  {#if video.durationFormatted}
                    <span class="text-text-muted">•</span>
                    <span>{video.durationFormatted}</span>
                  {/if}
                  {#if video.resolution}
                    <span class="text-text-muted">•</span>
                    <span>{video.resolution}</span>
                  {/if}
                </div>
                <h1
                  class="text-4xl md:text-6xl font-bold tracking-tight text-white drop-shadow-lg line-clamp-2"
                >
                  {video.title}
                </h1>
                <div class="pt-6 flex items-center gap-4">
                  <a
                    href={`/videos/${video.id}`}
                    class="flex items-center gap-2 bg-accent-500 hover:bg-accent-400 text-accent-950 px-8 py-3 font-semibold transition-all duration-normal hover:shadow-[0_0_24px_rgba(196,154,90,0.4)]"
                  >
                    <Play class="w-5 h-5 fill-current" />
                    Play now
                  </a>
                </div>
              </div>
            {/each}
          </div>

          {#if featuredVideos.length > 1}
            <div class="absolute bottom-8 right-8 md:bottom-16 md:right-16 flex items-center gap-1">
              {#each featuredVideos as _, index}
                <button
                  type="button"
                  onclick={() => (currentIndex = index)}
                  class="p-2 group"
                  aria-label={`Go to slide ${index + 1}`}
                >
                  <div
                    class={cn(
                      "h-1 transition-all duration-normal",
                      index === currentIndex
                        ? "w-8 bg-accent-500 shadow-[0_0_8px_rgba(196,154,90,0.6)]"
                        : "w-4 bg-white/30 group-hover:bg-white/50",
                    )}
                  ></div>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Horizontal rows -->
    <div class="space-y-12 mt-12 px-4 md:px-8">
      {#if recentVideos.length > 0}
        <section>
          <h2 class="text-xl font-semibold mb-6 flex items-center gap-2">
            <Film class="w-5 h-5 text-accent-500" />
            Recent Videos
          </h2>
          <div class="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hidden">
            {#each recentVideos as video, i (video.id)}
              {@const cardPerformers = (video.performers ?? []).map((p) => ({
                name: p.name,
                imagePath: p.imagePath ? toApiUrl(p.imagePath) ?? null : null,
              })) as PerformerRef[]}
              <div class="flex-none w-72 md:w-80 snap-start">
                <a href={`/videos/${video.id}`} class="block">
                  <NsfwBlur isNsfw={video.isNsfw} class="block">
                    <MediaCard
                      title={video.title}
                      thumbnail={toApiUrl(video.thumbnailPath)}
                      cardThumbnail={toApiUrl(video.cardThumbnailPath)}
                      gradientClass={VIDEO_CARD_GRADIENTS[i % VIDEO_CARD_GRADIENTS.length]}
                      duration={video.durationFormatted ?? undefined}
                      resolution={video.resolution ?? undefined}
                      codec={video.codec ?? undefined}
                      hasSubtitles={video.hasSubtitles}
                      fileSize={video.fileSizeFormatted ?? undefined}
                      performers={cardPerformers.length > 0 ? cardPerformers : undefined}
                      tags={(video.tags ?? []).map((t) => t.name)}
                      rating={video.rating ?? undefined}
                      views={video.playCount}
                    />
                  </NsfwBlur>
                </a>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      {#if galleries.length > 0}
        <section>
          <h2 class="text-xl font-semibold mb-6 flex items-center gap-2">
            <Layers class="w-5 h-5 text-accent-500" />
            Recent Galleries
          </h2>
          <div class="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hidden">
            {#each galleries as g (g.id)}
              <div class="flex-none w-48 md:w-56 snap-start">
                <a
                  href={`/galleries/${g.id}`}
                  class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
                >
                  <NsfwBlur isNsfw={g.isNsfw} class="block">
                    <div class="aspect-[3/4] bg-surface-1 relative">
                      {#if g.coverImagePath}
                        <img
                          src={toApiUrl(g.coverImagePath)}
                          alt={g.title}
                          loading="lazy"
                          class="h-full w-full object-cover"
                        />
                      {:else}
                        <div class="flex h-full items-center justify-center">
                          <Layers class="h-8 w-8 text-text-disabled" />
                        </div>
                      {/if}
                    </div>
                  </NsfwBlur>
                  <div class="p-2.5">
                    <h3 class="truncate text-sm font-medium">{g.title}</h3>
                    <p class="text-xs text-text-muted mt-0.5">
                      {g.imageCount} image{g.imageCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </a>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      {#if images.length > 0}
        <section>
          <h2 class="text-xl font-semibold mb-6 flex items-center gap-2">
            <ImageIcon class="w-5 h-5 text-accent-500" />
            Recent Images
          </h2>
          <div class="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hidden">
            {#each images as img (img.id)}
              <div class="flex-none w-64 md:w-72 snap-start">
                <a
                  href={`/images/${img.id}`}
                  class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
                >
                  <NsfwBlur isNsfw={img.isNsfw} class="block">
                    <div class="aspect-video bg-surface-1">
                      {#if img.previewPath || img.thumbnailPath}
                        <img
                          src={toApiUrl(img.previewPath ?? img.thumbnailPath)}
                          alt={img.title}
                          loading="lazy"
                          class="h-full w-full object-cover"
                        />
                      {/if}
                    </div>
                  </NsfwBlur>
                  <div class="p-2.5">
                    <h3 class="truncate text-sm font-medium">{img.title}</h3>
                  </div>
                </a>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      {#if audioLibraries.length > 0}
        <section>
          <h2 class="text-xl font-semibold mb-6 flex items-center gap-2">
            <Music class="w-5 h-5 text-accent-500" />
            Recent Audio
          </h2>
          <div class="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hidden">
            {#each audioLibraries as a, i (a.id)}
              {@const gradient = VIDEO_CARD_GRADIENTS[i % VIDEO_CARD_GRADIENTS.length]}
              <div class="flex-none w-48 md:w-56 snap-start">
                <a
                  href={`/audio/${a.id}`}
                  class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
                >
                  <NsfwBlur isNsfw={a.isNsfw} class="block relative">
                    <div class="aspect-square bg-surface-1 relative">
                      {#if a.coverImagePath}
                        <img
                          src={toApiUrl(a.coverImagePath)}
                          alt={a.title}
                          loading="lazy"
                          class="h-full w-full object-cover"
                        />
                      {:else}
                        <div class={cn("w-full h-full flex items-center justify-center", gradient)}>
                          <Music class="h-10 w-10 text-white/20" />
                        </div>
                      {/if}
                      <div class="pointer-events-none absolute bottom-1 right-1 z-10">
                        <NsfwShowModeChip isNsfw={a.isNsfw} />
                      </div>
                    </div>
                  </NsfwBlur>
                  <div class="p-2.5">
                    <h3 class="truncate text-sm font-medium">{a.title}</h3>
                    <p class="text-xs text-text-muted mt-0.5">
                      {a.trackCount} track{a.trackCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </a>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      {#if series.length > 0}
        <section>
          <h2 class="text-xl font-semibold mb-6 flex items-center gap-2">
            <FolderOpen class="w-5 h-5 text-accent-500" />
            Recent Series
          </h2>
          <div class="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hidden">
            {#each series as s (s.id)}
              <div class="flex-none w-64 md:w-72 snap-start">
                <a
                  href={`/videos?series=${s.id}`}
                  class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
                >
                  <NsfwBlur isNsfw={s.isNsfw} class="block">
                    <div class="aspect-video bg-surface-1">
                      {#if s.coverImagePath}
                        <img
                          src={toApiUrl(s.coverImagePath)}
                          alt={s.title}
                          loading="lazy"
                          class="h-full w-full object-cover"
                        />
                      {:else}
                        <div class="flex h-full items-center justify-center">
                          <FolderOpen class="h-8 w-8 text-text-disabled" />
                        </div>
                      {/if}
                    </div>
                  </NsfwBlur>
                  <div class="p-2.5">
                    <h3 class="truncate text-sm font-medium">{s.title}</h3>
                  </div>
                </a>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      {#if performers.length > 0}
        <section>
          <h2 class="text-xl font-semibold mb-6 flex items-center gap-2">
            <Users class="w-5 h-5 text-accent-500" />
            Recent Performers
          </h2>
          <div class="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hidden">
            {#each performers as p (p.id)}
              <div class="flex-none w-40 md:w-48 snap-start">
                <a
                  href={`/performers/${p.id}`}
                  class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
                >
                  <NsfwBlur isNsfw={p.isNsfw} class="block">
                    <div class="aspect-[3/4] bg-surface-1 relative">
                      {#if p.imagePath}
                        <img
                          src={toApiUrl(p.imagePath)}
                          alt={p.name}
                          loading="lazy"
                          class="h-full w-full object-cover"
                        />
                      {:else}
                        <div class="flex h-full items-center justify-center">
                          <Users class="h-8 w-8 text-text-disabled" />
                        </div>
                      {/if}
                    </div>
                  </NsfwBlur>
                  <div class="p-2">
                    <h3 class="truncate text-[0.8rem] font-medium">{p.name}</h3>
                    {#if p.videoCount > 0}
                      <p class="text-[0.65rem] text-text-disabled">
                        {p.videoCount} video{p.videoCount === 1 ? "" : "s"}
                      </p>
                    {/if}
                  </div>
                </a>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      {#if studios.length > 0}
        <section>
          <h2 class="text-xl font-semibold mb-6 flex items-center gap-2">
            <Building2 class="w-5 h-5 text-accent-500" />
            Studios
          </h2>
          <div class="flex gap-4 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hidden">
            {#each studios as s (s.id)}
              <div class="flex-none w-64 md:w-72 snap-start">
                <a
                  href={`/studios/${encodeURIComponent(s.name)}`}
                  class="surface-card-sharp overflow-hidden hover:border-border-accent transition-colors duration-fast block"
                >
                  <div class="aspect-[16/7] bg-surface-1">
                    {#if s.imagePath || s.imageUrl}
                      <img
                        src={toApiUrl(s.imagePath) ?? s.imageUrl ?? undefined}
                        alt={s.name}
                        loading="lazy"
                        class="h-full w-full object-cover"
                      />
                    {:else}
                      <div class="flex h-full items-center justify-center">
                        <Building2 class="h-8 w-8 text-text-disabled" />
                      </div>
                    {/if}
                  </div>
                  <div class="p-2.5">
                    <h3 class="truncate text-sm font-medium">{s.name}</h3>
                    {#if s.videoCount > 0}
                      <p class="text-xs text-text-muted">
                        {s.videoCount} video{s.videoCount === 1 ? "" : "s"}
                      </p>
                    {/if}
                  </div>
                </a>
              </div>
            {/each}
          </div>
        </section>
      {/if}
    </div>
  </div>
{/if}
