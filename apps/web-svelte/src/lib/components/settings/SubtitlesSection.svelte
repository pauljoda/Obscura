<script lang="ts">
  import { Captions } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";
  import {
    defaultSubtitleAppearance,
    subtitleDisplayStyles,
    type SubtitleAppearance,
    type SubtitleDisplayStyle,
  } from "@obscura/contracts";
  import type { LibrarySettings } from "$lib/api/types";
  import SubtitleCaptionOverlay from "$lib/components/SubtitleCaptionOverlay.svelte";
  import ToggleCard from "./ToggleCard.svelte";

  interface Props {
    settings: LibrarySettings;
    onToggleAutoEnable: (checked: boolean) => void;
    onLanguagesCommit: (value: string) => void;
    onAppearanceCommit: (next: SubtitleAppearance) => void;
  }

  let { settings, onToggleAutoEnable, onLanguagesCommit, onAppearanceCommit }: Props = $props();

  const STYLE_LABELS: Record<SubtitleDisplayStyle, string> = {
    stylized: "Stylized",
    classic: "Classic",
    outline: "Outline",
  };

  const STYLE_DESCRIPTIONS: Record<SubtitleDisplayStyle, string> = {
    stylized: "Dark Room brass-edged plate",
    classic: "Flat black box, plain white text",
    outline: "White text with black stroke, no box",
  };

  const appearance = $derived<SubtitleAppearance>({
    style: (settings.subtitleStyle ?? defaultSubtitleAppearance.style) as SubtitleDisplayStyle,
    fontScale: settings.subtitleFontScale ?? defaultSubtitleAppearance.fontScale,
    positionPercent:
      settings.subtitlePositionPercent ?? defaultSubtitleAppearance.positionPercent,
    opacity: settings.subtitleOpacity ?? defaultSubtitleAppearance.opacity,
  });

  let langDraft = $state(settings.subtitlesPreferredLanguages ?? "en,eng");

  $effect(() => {
    langDraft = settings.subtitlesPreferredLanguages ?? "en,eng";
  });

  function commitLang(el: HTMLInputElement) {
    const next = langDraft.trim();
    if (next !== (settings.subtitlesPreferredLanguages ?? "")) {
      onLanguagesCommit(next);
    }
  }
</script>

<section class="space-y-3">
  <div class="flex items-center gap-2.5 px-1">
    <Captions class="h-4 w-4 text-text-accent" />
    <div>
      <h2
        class="text-sm font-semibold tracking-wide font-heading text-text-primary uppercase"
      >
        Subtitles
      </h2>
      <p class="text-[0.68rem] text-text-muted">
        Defaults applied to the video player when a video has subtitle tracks
      </p>
    </div>
  </div>

  <div class="grid gap-2 md:grid-cols-2">
    <ToggleCard
      label="Auto-enable on load"
      description="Turn on subtitles automatically when a video has a track matching your preferred languages."
      checked={settings.subtitlesAutoEnable ?? false}
      onChange={onToggleAutoEnable}
    />
    <div class="surface-card no-lift p-3.5 flex flex-col justify-between min-h-[100px]">
      <div>
        <label class="control-label" for="subtitle-lang-input">Preferred languages</label>
        <p class="text-[0.68rem] text-text-muted mt-1">
          Comma-separated priority list (e.g. <code class="text-text-accent">en,eng,en-US</code>). First match
          wins.
        </p>
      </div>
      <input
        id="subtitle-lang-input"
        type="text"
        bind:value={langDraft}
        onblur={(e) => commitLang(e.currentTarget)}
        onkeydown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
        class="mt-3 border border-border-default bg-surface-1 px-2.5 py-1.5 text-[0.82rem] text-text-primary focus:border-border-accent focus:outline-none"
        placeholder="en,eng"
      />
    </div>
  </div>

  <div class="grid gap-2 md:grid-cols-2">
    <div class="surface-card no-lift p-3.5 space-y-3">
      <div>
        <label class="control-label">Display style</label>
        <p class="text-[0.68rem] text-text-muted mt-1">
          The preview on the right updates live as you change these.
        </p>
      </div>
      <div class="flex flex-col gap-1.5">
        {#each subtitleDisplayStyles as style (style)}
          {@const isActive = appearance.style === style}
          <button
            type="button"
            onclick={() => onAppearanceCommit({ ...appearance, style })}
            class={cn(
              "flex w-full items-start justify-between gap-2 border px-2.5 py-2 text-left transition-colors duration-fast",
              isActive
                ? "border-border-accent bg-accent-950/30 text-text-primary"
                : "border-border-default text-text-secondary hover:border-border-accent/60",
            )}
          >
            <div>
              <div class="text-[0.8rem] font-medium">{STYLE_LABELS[style]}</div>
              <div class="text-[0.65rem] text-text-muted">
                {STYLE_DESCRIPTIONS[style]}
              </div>
            </div>
            {#if isActive}
              <span
                class="text-[0.58rem] uppercase tracking-[0.16em] text-text-accent"
              >
                On
              </span>
            {/if}
          </button>
        {/each}
      </div>

      <div class="space-y-2 pt-1">
        <div class="flex items-center justify-between">
          <span class="text-[0.7rem] text-text-muted uppercase tracking-[0.14em]">Text size</span>
          <span class="text-mono-sm text-text-accent">
            {appearance.fontScale.toFixed(2)}x
          </span>
        </div>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.05"
          value={appearance.fontScale}
          oninput={(e) =>
            onAppearanceCommit({
              ...appearance,
              fontScale: Number((e.currentTarget as HTMLInputElement).value),
            })}
          class="w-full accent-accent-500"
          aria-label="Subtitle text size"
        />
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-[0.7rem] text-text-muted uppercase tracking-[0.14em]"
            >Vertical position</span
          >
          <span class="text-mono-sm text-text-accent">
            {Math.round(appearance.positionPercent)}%
          </span>
        </div>
        <input
          type="range"
          min="10"
          max="98"
          step="1"
          value={appearance.positionPercent}
          oninput={(e) =>
            onAppearanceCommit({
              ...appearance,
              positionPercent: Number((e.currentTarget as HTMLInputElement).value),
            })}
          class="w-full accent-accent-500"
          aria-label="Subtitle vertical position"
        />
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-[0.7rem] text-text-muted uppercase tracking-[0.14em]"
            >Transparency</span
          >
          <span class="text-mono-sm text-text-accent">
            {Math.round(appearance.opacity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0.2"
          max="1"
          step="0.05"
          value={appearance.opacity}
          oninput={(e) =>
            onAppearanceCommit({
              ...appearance,
              opacity: Number((e.currentTarget as HTMLInputElement).value),
            })}
          class="w-full accent-accent-500"
          aria-label="Subtitle transparency"
        />
      </div>
    </div>

    <div class="surface-card no-lift p-3.5 flex flex-col">
      <div>
        <label class="control-label">Preview</label>
        <p class="text-[0.68rem] text-text-muted mt-1">
          Shows how captions will render on top of a video.
        </p>
      </div>
      <div
        class="relative mt-3 aspect-video w-full overflow-hidden border border-border-subtle bg-black"
      >
        <div
          class="absolute inset-0 bg-[linear-gradient(135deg,#1a1f2b_0%,#0e1118_45%,#2a1f14_100%)]"
        ></div>
        <div
          class="absolute inset-0 opacity-[0.08]"
          style:background-image="repeating-linear-gradient(90deg, rgba(255,255,255,0.6) 0, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 32px), repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 32px)"
        ></div>
        <div
          class="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/80 to-transparent"
        ></div>
        <SubtitleCaptionOverlay
          text="This is how your subtitles will look."
          {appearance}
          alwaysVisible
        />
      </div>
    </div>
  </div>
</section>
