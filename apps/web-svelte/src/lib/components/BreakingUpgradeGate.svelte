<script lang="ts">
  import type { Snippet } from "svelte";
  import {
    acceptBreakingGate,
    fetchSystemStatus,
  } from "$lib/v1/api/system-v1";

  interface Props {
    /** From +layout.server.ts — server-side probe of system status. */
    awaitingConsent: boolean;
    children: Snippet;
  }

  let { awaitingConsent, children }: Props = $props();

  type State = "ready" | "preparing" | "entering";
  let phase: State = $state("ready");
  let error: string | null = $state(null);

  const GITHUB_URL = "https://github.com/pauljoda/obscura";

  async function handleAccept() {
    phase = "preparing";
    error = null;
    try {
      await acceptBreakingGate();
      phase = "entering";
      const s = await fetchSystemStatus();
      if (!s.awaitingBreakingConsent) {
        window.location.reload();
        return;
      }
      error = "Upgrade consent is still required. Refresh the page and try again.";
    } catch (err) {
      phase = "ready";
      error = err instanceof Error ? err.message : String(err);
    }
  }
</script>

{#if !awaitingConsent}
  {@render children()}
{:else}
  <div class="fixed inset-0 flex items-center justify-center bg-bg text-text-primary p-8 overflow-auto z-[9999]">
    <div class="max-w-[38rem] w-full">
      <div class="font-heading text-2xl font-semibold mb-4 text-accent-500">
        Thank you for being an early supporter of Obscura.
      </div>
      <p class="leading-relaxed mb-4">
        This upgrade moves Obscura to the new v2 global entity model. Videos,
        images, galleries, books, audio, people, studios, tags, and collections
        now share one metadata foundation instead of each library type carrying
        its own isolated shape.
      </p>
      <p class="leading-relaxed mb-4">
        Your media files on disk are untouched. Before continuing, Obscura will
        create a database backup and migrate your existing metadata into the new
        schema. Thumbnails, previews, trickplay sprites, technical metadata,
        fingerprints, playback history, and all relationships will be preserved
        so you don't need a full rescan.
      </p>
      <p class="leading-relaxed mb-6 opacity-80">
        This is a one-time early-access migration gate for the v2 upgrade.
      </p>
      {#if error}
        <div class="text-error-text mb-4">{error}</div>
      {/if}
      <div class="flex gap-3 flex-wrap">
        <button
          type="button"
          onclick={handleAccept}
          disabled={phase === "preparing" || phase === "entering"}
          class="px-4 py-2 border border-border-accent bg-gradient-to-r from-accent-900 to-accent-800 text-accent-100 font-medium disabled:opacity-40 transition-all duration-fast"
        >
          {#if phase === "preparing"}
            Backing up &amp; migrating data…
          {:else if phase === "entering"}
            Entering app…
          {:else}
            Continue with v2 upgrade
          {/if}
        </button>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          class="px-4 py-2 border border-border-subtle text-text-muted hover:text-text-primary transition-colors duration-fast"
        >
          Read on GitHub
        </a>
      </div>
    </div>
  </div>
{/if}
