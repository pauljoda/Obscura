<script lang="ts">
  import { onMount, tick } from "svelte";
  import { cn } from "@obscura/ui-svelte";

  interface Props {
    class?: string;
    text: string;
    title?: string;
  }

  let { class: className = "", text, title }: Props = $props();

  let shell: HTMLSpanElement | null = $state(null);
  let track: HTMLSpanElement | null = $state(null);
  let overflowing = $state(false);
  let travel = $state(0);

  const duration = $derived(`${Math.max(5, Math.min(14, travel / 18 + 5))}s`);
  const displayTitle = $derived(title ?? text);

  function measure() {
    if (!shell || !track) return;
    const nextTravel = Math.max(0, Math.ceil(track.scrollWidth - shell.clientWidth));
    travel = nextTravel;
    overflowing = nextTravel > 1;
  }

  onMount(() => {
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    if (shell) observer.observe(shell);
    if (track) observer.observe(track);
    return () => observer.disconnect();
  });

  $effect(() => {
    text;
    void tick().then(measure);
  });
</script>

<span
  bind:this={shell}
  class={cn("ticker-shell", overflowing && "is-overflowing", className)}
  title={displayTitle}
  style:--ticker-travel={`${travel}px`}
  style:--ticker-duration={duration}
>
  <span bind:this={track} class="ticker-track">{text}</span>
</span>

<style>
  .ticker-shell {
    display: block;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
  }

  .ticker-track {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: bottom;
    white-space: nowrap;
  }

  .ticker-shell.is-overflowing .ticker-track {
    max-width: none;
  }

  .ticker-shell.is-overflowing:is(:hover, :focus-visible, :focus-within) .ticker-track {
    animation: overflow-ticker var(--ticker-duration, 7s) linear infinite alternate;
  }

  @keyframes overflow-ticker {
    0%, 12% {
      transform: translateX(0);
    }

    88%, 100% {
      transform: translateX(calc(-1 * var(--ticker-travel, 0px)));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ticker-shell.is-overflowing:is(:hover, :focus-visible, :focus-within) .ticker-track {
      animation: none;
    }
  }
</style>
