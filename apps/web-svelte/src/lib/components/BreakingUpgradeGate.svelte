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

  type State = "ready" | "accepting" | "restarting";
  let phase: State = $state("ready");
  let error: string | null = $state(null);

  const GITHUB_URL = "https://github.com/pauljoda/obscura";

  async function handleAccept() {
    phase = "accepting";
    error = null;
    try {
      await acceptBreakingGate();
      phase = "restarting";
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const s = await fetchSystemStatus();
          if (!s.awaitingBreakingConsent) {
            window.location.reload();
            return;
          }
        } catch {
          // API still restarting
        }
      }
      error = "Upgrade took longer than expected. Refresh the page in a minute.";
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
        This upgrade includes a one-time breaking change: the
        <strong>Scenes</strong> section has been replaced with a richer
        <strong>Videos</strong> model (series, seasons, episodes, and movies).
      </p>
      <p class="leading-relaxed mb-4">
        Your video files on disk are untouched. The old
        <code class="px-1 mx-1 bg-white/5 font-mono">scenes</code> database rows
        (including custom metadata, tags, and markers) will be dropped — after
        continuing, rescan your library roots to rebuild the new video entries.
      </p>
      <p class="leading-relaxed mb-6 opacity-80">
        Future updates are unlikely to require this kind of break.
      </p>
      {#if error}
        <div class="text-error-text mb-4">{error}</div>
      {/if}
      <div class="flex gap-3 flex-wrap">
        <button
          type="button"
          onclick={handleAccept}
          disabled={phase === "accepting" || phase === "restarting"}
          class="px-4 py-2 border border-border-accent bg-gradient-to-r from-accent-900 to-accent-800 text-accent-100 font-medium disabled:opacity-40 transition-all duration-fast"
        >
          {#if phase === "accepting"}
            Applying…
          {:else if phase === "restarting"}
            Restarting API…
          {:else}
            Continue &amp; rebuild library
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
