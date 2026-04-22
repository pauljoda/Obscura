<script lang="ts">
  import {
    ChevronRight,
    Database,
    Droplet,
    Eye,
    Film,
    Flame,
    HardDrive,
    Loader2,
    Package,
    ScanSearch,
    Settings as SettingsIcon,
    Shield,
  } from "@lucide/svelte";
  import { Button, StatusLed, cn } from "@obscura/ui-svelte";
  import {
    BACKGROUND_WORKER_CONCURRENCY_MAX,
    BACKGROUND_WORKER_CONCURRENCY_MIN,
    playbackModes,
    type PlaybackMode,
    type SubtitleAppearance,
    type SubtitleDisplayStyle,
  } from "@obscura/contracts";
  import type { LibraryRoot, LibrarySettings, StorageStats } from "$lib/api/types";
  import {
    fetchLibraryConfig,
    migrateVideoAssetStorage,
    updateLibrarySettings,
  } from "$lib/api/library";
  import { fetchInstalledScrapers } from "$lib/api/scrapers";
  import { useNsfw } from "$lib/stores/nsfw.svelte";
  import ToggleCard from "$lib/components/settings/ToggleCard.svelte";
  import NumberStepper from "$lib/components/settings/NumberStepper.svelte";
  import QualitySlider from "$lib/components/settings/QualitySlider.svelte";
  import StorageStat from "$lib/components/settings/StorageStat.svelte";
  import SubtitlesSection from "$lib/components/settings/SubtitlesSection.svelte";
  import DiagnosticsSection from "$lib/components/settings/DiagnosticsSection.svelte";
  import WatchedLibrariesSection from "$lib/components/settings/WatchedLibrariesSection.svelte";

  let { data } = $props();

  const nsfw = useNsfw();

  function normalizeSettings(s: LibrarySettings): LibrarySettings {
    return {
      ...s,
      thumbnailQuality: s.thumbnailQuality ?? 2,
      trickplayQuality: s.trickplayQuality ?? 2,
      backgroundWorkerConcurrency: s.backgroundWorkerConcurrency ?? 1,
      metadataStorageDedicated: s.metadataStorageDedicated ?? true,
      subtitlesAutoEnable: s.subtitlesAutoEnable ?? false,
      subtitlesPreferredLanguages: s.subtitlesPreferredLanguages ?? "en,eng",
      subtitleStyle: (s.subtitleStyle ?? "stylized") as SubtitleDisplayStyle,
      subtitleFontScale: s.subtitleFontScale ?? 1,
      subtitlePositionPercent: s.subtitlePositionPercent ?? 88,
      subtitleOpacity: s.subtitleOpacity ?? 1,
      defaultPlaybackMode: (s.defaultPlaybackMode ?? "direct") as PlaybackMode,
    };
  }

  const defaultSettings: LibrarySettings = {
    id: "pending",
    autoScanEnabled: false,
    scanIntervalMinutes: 60,
    autoGenerateMetadata: true,
    autoGenerateFingerprints: true,
    generatePhash: false,
    autoGeneratePreview: true,
    generateTrickplay: true,
    trickplayIntervalSeconds: 10,
    previewClipDurationSeconds: 8,
    thumbnailQuality: 2,
    trickplayQuality: 2,
    backgroundWorkerConcurrency: 1,
    nsfwLanAutoEnable: false,
    metadataStorageDedicated: true,
    subtitlesAutoEnable: false,
    subtitlesPreferredLanguages: "en,eng",
    subtitleStyle: "stylized",
    subtitleFontScale: 1,
    subtitlePositionPercent: 88,
    subtitleOpacity: 1,
    defaultPlaybackMode: "direct",
    createdAt: "",
    updatedAt: "",
  };

  let settings = $state<LibrarySettings>(defaultSettings);
  let roots = $state<LibraryRoot[]>([]);
  let storage = $state<StorageStats | null>(null);
  let scraperCount = $state(0);

  let savedMetadataStorageDedicated = $state(defaultSettings.metadataStorageDedicated);

  let message = $state<string | null>(null);
  let error = $state<string | null>(null);

  let metadataStorageDialogOpen = $state(false);
  let metadataStorageBusy = $state(false);

  $effect(() => {
    if (!data.config) {
      settings = defaultSettings;
      roots = [];
      storage = null;
      scraperCount = data.scraperCount ?? 0;
      savedMetadataStorageDedicated = defaultSettings.metadataStorageDedicated;
      return;
    }

    const normalized = normalizeSettings(data.config.settings);
    settings = normalized;
    roots = data.config.roots;
    storage = data.config.storage;
    scraperCount = data.scraperCount ?? 0;
    savedMetadataStorageDedicated = normalized.metadataStorageDedicated;
  });

  function flashMessage(m: string, ms = 2000) {
    message = m;
    setTimeout(() => {
      if (message === m) message = null;
    }, ms);
  }

  function setError(m: string | null) {
    error = m;
  }

  async function loadConfig() {
    try {
      const [response, scrapersResponse] = await Promise.all([
        fetchLibraryConfig(),
        fetchInstalledScrapers(),
      ]);
      const normalized = normalizeSettings(response.settings);
      settings = normalized;
      savedMetadataStorageDedicated = normalized.metadataStorageDedicated;
      roots = response.roots;
      storage = response.storage;
      scraperCount = scrapersResponse.packages.length;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    }
  }

  async function autoSaveSetting(patch: Partial<LibrarySettings>) {
    try {
      const updated = await updateLibrarySettings({ ...settings, ...patch });
      const normalized = normalizeSettings(updated);
      settings = normalized;
      savedMetadataStorageDedicated = normalized.metadataStorageDedicated;
      flashMessage("Setting saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save setting");
    }
  }

  function handleMetadataStorageToggle(checked: boolean) {
    if (checked === savedMetadataStorageDedicated) return;
    settings = { ...settings, metadataStorageDedicated: checked };
    metadataStorageDialogOpen = true;
  }

  function revertMetadataStorageToggle() {
    settings = { ...settings, metadataStorageDedicated: savedMetadataStorageDedicated };
  }

  function closeMetadataStorageDialogCancel() {
    metadataStorageDialogOpen = false;
    revertMetadataStorageToggle();
  }

  async function confirmMetadataStorageLeaveInPlace() {
    metadataStorageBusy = true;
    setError(null);
    try {
      const updated = await updateLibrarySettings({
        ...settings,
        metadataStorageDedicated: settings.metadataStorageDedicated,
      });
      const normalized = normalizeSettings(updated);
      settings = normalized;
      savedMetadataStorageDedicated = normalized.metadataStorageDedicated;
      metadataStorageDialogOpen = false;
      flashMessage("Setting saved.", 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save setting");
      closeMetadataStorageDialogCancel();
    } finally {
      metadataStorageBusy = false;
    }
  }

  async function confirmMetadataStorageMoveFiles() {
    metadataStorageBusy = true;
    setError(null);
    const targetDedicated = settings.metadataStorageDedicated;
    try {
      const updated = await updateLibrarySettings({
        ...settings,
        metadataStorageDedicated: targetDedicated,
      });
      const normalized = normalizeSettings(updated);
      settings = normalized;
      savedMetadataStorageDedicated = normalized.metadataStorageDedicated;
      await migrateVideoAssetStorage(targetDedicated, nsfw.mode);
      metadataStorageDialogOpen = false;
      flashMessage(
        "Setting saved. Moving files in the background — open Jobs to watch progress.",
        6000,
      );
    } catch (err) {
      let msg = err instanceof Error ? err.message : "Failed to save or queue file move";
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        /* keep msg */
      }
      setError(msg);
      closeMetadataStorageDialogCancel();
    } finally {
      metadataStorageBusy = false;
    }
  }

  $effect(() => {
    if (!metadataStorageDialogOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !metadataStorageBusy) {
        metadataStorageDialogOpen = false;
        revertMetadataStorageToggle();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });

  function formatBytes(bytes: number) {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
  }

  const totalBytes = $derived(storage?.totalBytes ?? 0);

  function commitSubtitleAppearance(next: SubtitleAppearance) {
    settings = {
      ...settings,
      subtitleStyle: next.style,
      subtitleFontScale: next.fontScale,
      subtitlePositionPercent: next.positionPercent,
      subtitleOpacity: next.opacity,
    };
    void autoSaveSetting({
      subtitleStyle: next.style,
      subtitleFontScale: next.fontScale,
      subtitlePositionPercent: next.positionPercent,
      subtitleOpacity: next.opacity,
    });
  }
</script>

<svelte:head>
  <title>Settings · Obscura</title>
</svelte:head>

<div class="space-y-6">
  <div>
    <h1 class="flex items-center gap-2.5">
      <SettingsIcon class="h-5 w-5 text-text-accent" />
      Settings
    </h1>
    <p class="mt-1 text-[0.78rem] text-text-muted">
      Configure libraries, generation pipeline, and scrapers
    </p>
  </div>

  {#if error}
    <div
      class="surface-card no-lift border-l-2 border-status-error px-3 py-2 text-sm text-status-error-text"
    >
      {error}
    </div>
  {/if}
  {#if message && !error}
    <div
      class="surface-card no-lift border-l-2 border-status-success px-3 py-2 text-sm text-status-success-text"
    >
      {message}
    </div>
  {/if}

  <WatchedLibrariesSection
    bind:roots
    onRootsChanged={loadConfig}
    onError={setError}
    onMessage={flashMessage}
  />

  <div class="border-t border-border-subtle"></div>

  <!-- ─── Content Visibility ──────────────────────────────────── -->
  <section class="space-y-3">
    <div class="flex items-center gap-2.5 px-1">
      <Eye class="h-4 w-4 text-text-accent" />
      <div>
        <h2 class="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">
          Content Visibility
        </h2>
        <p class="text-[0.68rem] text-text-muted">
          Control how adult content is displayed across the application
        </p>
      </div>
    </div>

    <div class="grid gap-2 md:grid-cols-2 md:items-stretch">
      <div class="surface-card no-lift flex h-full flex-col gap-3 p-3.5">
        <div>
          <div class="control-label">NSFW Content Mode</div>
          <p class="text-[0.68rem] text-text-muted">
            Stored per device. Does not affect stored data.
          </p>
        </div>

        <div
          class="flex bg-surface-1 p-1 border border-border-default shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]"
        >
          <button
            type="button"
            onclick={() => nsfw.setMode("off")}
            class={cn(
              "flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 transition-all duration-fast",
              nsfw.mode === "off"
                ? "bg-surface-3 border border-border-subtle shadow-card text-text-primary"
                : "text-text-muted hover:text-text-primary hover:bg-surface-2/50 border border-transparent",
            )}
          >
            <Shield class={cn("h-4 w-4", nsfw.mode === "off" && "text-info-text")} />
            <span class="text-[0.75rem] font-medium">Off (SFW)</span>
          </button>
          <button
            type="button"
            onclick={() => nsfw.setMode("blur")}
            class={cn(
              "flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 transition-all duration-fast",
              nsfw.mode === "blur"
                ? "bg-surface-3 border border-border-subtle shadow-card text-text-primary"
                : "text-text-muted hover:text-text-primary hover:bg-surface-2/50 border border-transparent",
            )}
          >
            <Droplet class={cn("h-4 w-4", nsfw.mode === "blur" && "text-warning-text")} />
            <span class="text-[0.75rem] font-medium">Blur</span>
          </button>
          <button
            type="button"
            onclick={() => nsfw.setMode("show")}
            class={cn(
              "flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 transition-all duration-fast",
              nsfw.mode === "show"
                ? "bg-surface-3 border border-border-accent shadow-[var(--shadow-glow-accent)] text-accent-400"
                : "text-text-muted hover:text-text-primary hover:bg-surface-2/50 border border-transparent",
            )}
          >
            <Flame class={cn("h-4 w-4", nsfw.mode === "show" && "text-accent-500")} />
            <span class="text-[0.75rem] font-medium">Show</span>
          </button>
        </div>

        <div
          class="text-[0.7rem] text-text-muted bg-surface-2/50 p-2.5 border border-border-subtle"
        >
          {#if nsfw.mode === "off"}
            Adult content is completely hidden from the interface.
          {:else if nsfw.mode === "blur"}
            Adult content is shown but thumbnails and text are obscured until hovered.
          {:else}
            All content is displayed normally without any obscuring.
          {/if}
        </div>
      </div>
      <ToggleCard
        class="h-full"
        label="Auto-enable on LAN"
        description="Automatically switch to Show mode when accessing from a local network."
        checked={settings.nsfwLanAutoEnable}
        onChange={(checked) => {
          settings = { ...settings, nsfwLanAutoEnable: checked };
          void autoSaveSetting({ nsfwLanAutoEnable: checked });
        }}
      />
    </div>
    <div class="surface-card no-lift p-3.5 bg-surface-1/50 border-l-2 border-l-border-accent">
      <p class="text-[0.65rem] text-text-muted leading-relaxed">
        <strong class="text-text-accent font-mono uppercase tracking-wider mr-2">
          Power-user tip:
        </strong>
        Quick toggle between full SFW and full NSFW (skips blur) with no toolbar button:
        <kbd class="kbd mx-0.5">⌘⇧Z</kbd>
        on Mac or <kbd class="kbd mx-0.5">Ctrl+Shift+Z</kbd> elsewhere. Global search also opens
        with <kbd class="kbd mx-0.5">⌘K</kbd> / <kbd class="kbd mx-0.5">Ctrl+K</kbd>.
        On mobile, press and hold the bottom bar
        <strong class="text-text-primary">More</strong>
        button for five seconds for the same SFW ↔ full NSFW toggle.
      </p>
    </div>
  </section>

  <div class="border-t border-border-subtle"></div>

  <!-- ─── Playback ──────────────────────────────────── -->
  <section class="space-y-3">
    <div class="flex items-center gap-2.5 px-1">
      <Film class="h-4 w-4 text-text-accent" />
      <div>
        <h2 class="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">
          Playback
        </h2>
        <p class="text-[0.68rem] text-text-muted">
          Defaults applied to the video player when a video loads
        </p>
      </div>
    </div>

    <div class="surface-card no-lift p-3.5 flex flex-col gap-3">
      <div>
        <div class="control-label">Default playback mode</div>
        <p class="text-[0.68rem] text-text-muted">
          Direct streams the source file (fastest seek, no transcode). Adaptive HLS uses the
          on-demand ffmpeg pipeline (supports bitrate switching and renditions). You can still
          override per-video in the quality menu.
        </p>
      </div>

      <div
        class="flex bg-surface-1 p-1 border border-border-default shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]"
      >
        {#each playbackModes as mode (mode)}
          {@const active = settings.defaultPlaybackMode === mode}
          <button
            type="button"
            onclick={() => {
              settings = { ...settings, defaultPlaybackMode: mode };
              void autoSaveSetting({ defaultPlaybackMode: mode });
            }}
            class={cn(
              "flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 transition-all duration-fast",
              active
                ? "bg-surface-3 border border-border-accent shadow-[var(--shadow-glow-accent)] text-accent-400"
                : "text-text-muted hover:text-text-primary hover:bg-surface-2/50 border border-transparent",
            )}
          >
            <span class="text-[0.75rem] font-medium uppercase tracking-wider">
              {mode === "direct" ? "Direct" : "Adaptive HLS"}
            </span>
          </button>
        {/each}
      </div>
    </div>
  </section>

  <div class="border-t border-border-subtle"></div>

  <SubtitlesSection
    {settings}
    onToggleAutoEnable={(checked) => {
      settings = { ...settings, subtitlesAutoEnable: checked };
      void autoSaveSetting({ subtitlesAutoEnable: checked });
    }}
    onLanguagesCommit={(value) => {
      settings = { ...settings, subtitlesPreferredLanguages: value };
      void autoSaveSetting({ subtitlesPreferredLanguages: value });
    }}
    onAppearanceCommit={commitSubtitleAppearance}
  />

  <div class="border-t border-border-subtle"></div>

  <!-- ─── Metadata Providers → Plugins link ──────────────────── -->
  <section class="space-y-3">
    <div class="flex items-center gap-2.5 px-1">
      <Database class="h-4 w-4 text-text-accent" />
      <div>
        <h2 class="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">
          Metadata Providers
        </h2>
        <p class="text-[0.68rem] text-text-muted">
          Manage identification plugins, scrapers, and StashBox endpoints
        </p>
      </div>
    </div>

    <a href="/plugins" class="group block">
      <div
        class={cn(
          "surface-card no-lift p-3.5 transition-all duration-normal",
          "hover:border-border-accent hover:shadow-[var(--shadow-glow-accent)]",
        )}
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <Package class="h-4 w-4 text-text-muted" />
            <div>
              <div class="flex items-center gap-2">
                <span
                  class="text-[0.82rem] font-medium transition-colors duration-fast group-hover:text-text-accent"
                >
                  Plugins
                </span>
                <span class="pill-accent px-1.5 py-0.5 text-[0.55rem]">{scraperCount}</span>
              </div>
              <p class="text-[0.65rem] text-text-disabled">
                Manage scrapers, StashBox endpoints, and identification plugins
              </p>
            </div>
          </div>
          <ChevronRight
            class="h-4 w-4 text-text-disabled transition-all duration-fast group-hover:translate-x-0.5 group-hover:text-text-accent"
          />
        </div>
      </div>
    </a>
  </section>

  <div class="border-t border-border-subtle"></div>

  <!-- ─── Generation Pipeline ──────────────────────────────────── -->
  <section class="space-y-3">
    <div class="flex items-center gap-2.5 px-1">
      <ScanSearch class="h-4 w-4 text-text-accent" />
      <div>
        <h2 class="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">
          Generation Pipeline
        </h2>
        <p class="text-[0.68rem] text-text-muted">
          Control automatic scanning and how new files are enriched
        </p>
      </div>
    </div>

    <div class="grid gap-2 md:grid-cols-2 md:items-stretch">
      <ToggleCard
        label="Automatic library scans"
        description="Queue scans on a recurring interval."
        checked={settings.autoScanEnabled}
        onChange={(checked) => {
          settings = { ...settings, autoScanEnabled: checked };
          void autoSaveSetting({ autoScanEnabled: checked });
        }}
      />
      <NumberStepper
        label="Scan Interval"
        description="Minutes between automatic scans."
        value={settings.scanIntervalMinutes}
        min={5}
        max={1440}
        step={5}
        onChange={(val) => {
          settings = { ...settings, scanIntervalMinutes: val };
          void autoSaveSetting({ scanIntervalMinutes: val });
        }}
      />

      <ToggleCard
        label="Technical metadata"
        description="ffprobe: runtime, resolution, codec, bitrate."
        checked={settings.autoGenerateMetadata}
        onChange={(checked) => {
          settings = { ...settings, autoGenerateMetadata: checked };
          void autoSaveSetting({ autoGenerateMetadata: checked });
        }}
      />
      <ToggleCard
        label="Fingerprints"
        description="MD5 and OpenSubtitles hashes for matching."
        checked={settings.autoGenerateFingerprints}
        onChange={(checked) => {
          settings = { ...settings, autoGenerateFingerprints: checked };
          void autoSaveSetting({ autoGenerateFingerprints: checked });
        }}
      />
      <ToggleCard
        label="Perceptual hash (pHash)"
        description="Stash-compatible video phash via the bundled helper. CPU-heavy (25 ffmpeg frame extractions per video) but required to contribute fingerprints back to StashDB / ThePornDB."
        checked={settings.generatePhash}
        onChange={(checked) => {
          settings = { ...settings, generatePhash: checked };
          void autoSaveSetting({ generatePhash: checked });
        }}
      />
      <ToggleCard
        label="Preview assets"
        description="Thumbnails and short preview clips."
        checked={settings.autoGeneratePreview}
        onChange={(checked) => {
          settings = { ...settings, autoGeneratePreview: checked };
          void autoSaveSetting({ autoGeneratePreview: checked });
        }}
      />
      <ToggleCard
        label="Trickplay strips"
        description="Sprite sheets for player scrub previews."
        checked={settings.generateTrickplay}
        onChange={(checked) => {
          settings = { ...settings, generateTrickplay: checked };
          void autoSaveSetting({ generateTrickplay: checked });
        }}
      />
      <ToggleCard
        label="Store video previews in dedicated cache directory"
        description="When on, thumbnails, preview clips, sprites, and trickplay data live under the app data volume (OBSCURA_CACHE_DIR, e.g. /data/cache). When off, those files are written next to each video. Video .nfo files always stay beside the media file."
        checked={settings.metadataStorageDedicated}
        onChange={handleMetadataStorageToggle}
      />

      <div class="md:col-span-2">
        <NumberStepper
          label="Background job concurrency"
          description="Parallel jobs per queue in the worker. Higher uses more CPU, disk I/O, and RAM. Applies within about 15 seconds after save."
          value={settings.backgroundWorkerConcurrency}
          min={BACKGROUND_WORKER_CONCURRENCY_MIN}
          max={BACKGROUND_WORKER_CONCURRENCY_MAX}
          step={1}
          onChange={(val) => {
            settings = { ...settings, backgroundWorkerConcurrency: val };
            void autoSaveSetting({ backgroundWorkerConcurrency: val });
          }}
        />
      </div>
      <NumberStepper
        label="Trickplay Interval"
        description="Seconds between sprite sheet frames."
        value={settings.trickplayIntervalSeconds}
        min={1}
        max={60}
        step={1}
        onChange={(val) => {
          settings = { ...settings, trickplayIntervalSeconds: val };
          void autoSaveSetting({ trickplayIntervalSeconds: val });
        }}
      />
      <NumberStepper
        label="Preview Clip Length"
        description="Duration of the generated preview video."
        value={settings.previewClipDurationSeconds}
        min={2}
        max={60}
        step={1}
        onChange={(val) => {
          settings = { ...settings, previewClipDurationSeconds: val };
          void autoSaveSetting({ previewClipDurationSeconds: val });
        }}
      />

      <QualitySlider
        label="Thumbnail Quality"
        value={settings.thumbnailQuality}
        onCommit={(value) => {
          settings = { ...settings, thumbnailQuality: value };
          void autoSaveSetting({ thumbnailQuality: value });
        }}
      />
      <QualitySlider
        label="Trickplay Quality"
        value={settings.trickplayQuality}
        onCommit={(value) => {
          settings = { ...settings, trickplayQuality: value };
          void autoSaveSetting({ trickplayQuality: value });
        }}
      />
    </div>
  </section>

  <div class="border-t border-border-subtle"></div>

  <!-- ─── Generated Storage ──────────────────────────────────── -->
  <section class="space-y-3">
    <div class="flex items-center gap-2.5 px-1">
      <HardDrive class="h-4 w-4 text-text-accent" />
      <div>
        <h2 class="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase">
          Generated Storage
        </h2>
        <p class="text-[0.68rem] text-text-muted">Disk usage for rendered assets</p>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
      <StorageStat
        label="Thumbnails"
        value={formatBytes(storage?.thumbnailsBytes ?? 0)}
        gradientClass="gradient-thumb-1"
      />
      <StorageStat
        label="Preview clips"
        value={formatBytes(storage?.previewsBytes ?? 0)}
        gradientClass="gradient-thumb-2"
      />
      <StorageStat
        label="Trickplay sprites"
        value={formatBytes(storage?.trickplayBytes ?? 0)}
        gradientClass="gradient-thumb-3"
      />
      <StorageStat label="Total" value={formatBytes(totalBytes)} accent />
    </div>
  </section>

  <div class="border-t border-border-subtle"></div>

  <DiagnosticsSection />
</div>

{#if metadataStorageDialogOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute inset-0 bg-black/80 backdrop-blur-sm"
      onclick={metadataStorageBusy ? undefined : closeMetadataStorageDialogCancel}
      aria-hidden="true"
    ></div>
    <div
      class="relative surface-elevated border border-border-subtle w-full max-w-md mx-4 p-6 space-y-4"
    >
      <h3 class="text-base font-heading font-semibold text-text-primary">
        Relocate existing video assets?
      </h3>
      <p class="text-[0.78rem] text-text-muted leading-relaxed">
        You changed where new thumbnails, preview clips, sprites, and trickplay files are
        stored. Move files that are already on disk to the new location, or leave them — the
        app will keep reading from either place until you rebuild previews or move later from
        Jobs.
      </p>
      <div class="flex flex-col gap-2">
        <Button
          type="button"
          variant="primary"
          disabled={metadataStorageBusy}
          onclick={() => void confirmMetadataStorageMoveFiles()}
          class="w-full gap-2 px-3.5 py-2.5 text-[0.8rem]"
        >
          {#if metadataStorageBusy}
            <StatusLed status="accent" size="sm" pulse />
            <Loader2
              class="h-4 w-4 animate-spin text-accent-300 drop-shadow-[0_0_6px_rgba(199,155,92,0.35)]"
            />
          {/if}
          Move existing files
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={metadataStorageBusy}
          onclick={() => void confirmMetadataStorageLeaveInPlace()}
          class="no-lift w-full border-border-subtle bg-surface-2/40 px-3.5 py-2.5 text-[0.8rem] text-text-secondary hover:border-border-accent/25"
        >
          Leave files in place
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={metadataStorageBusy}
          onclick={closeMetadataStorageDialogCancel}
          class="h-auto w-full px-3.5 py-2 text-[0.75rem]"
        >
          Cancel
        </Button>
      </div>
    </div>
  </div>
{/if}
