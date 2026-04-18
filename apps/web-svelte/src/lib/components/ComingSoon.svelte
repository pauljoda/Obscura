<script lang="ts">
  import { Construction } from "@lucide/svelte";

  interface Props {
    route: string;
    issue?: string;
  }

  let { route, issue }: Props = $props();
</script>

<div class="surface-panel p-8 flex flex-col items-center text-center gap-3 max-w-xl mx-auto">
  <Construction class="h-10 w-10 text-accent-500" />
  <h2 class="text-h2 text-text-primary">Coming soon to the SvelteKit port</h2>
  <p class="text-body text-text-muted">
    The <code class="text-accent-300">{route}</code> route is scaffolded. Its deep port —
    the full component tree, filter UI, and interactions — is tracked in Linear
    {#if issue}
      as <strong>{issue}</strong>.
    {:else}
      on the <em>Web Port</em> project.
    {/if}
  </p>
  <p class="text-body-sm text-text-disabled">
    Until then the Next.js app on port 8008 handles these routes at parity.
  </p>
</div>
