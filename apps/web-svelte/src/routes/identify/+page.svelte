<script lang="ts">
  import { ScanSearch } from "@lucide/svelte";
</script>

<svelte:head>
  <title>Identify · Obscura</title>
</svelte:head>

<section class="space-y-5">
  <div>
    <h1 class="flex items-center gap-2.5">
      <ScanSearch class="h-5 w-5 text-text-accent" />
      Identify
    </h1>
    <p class="mt-1 text-[0.78rem] text-text-muted">
      Provider identification is waiting on the .NET provider endpoints.
    </p>
  </div>

  <div class="surface-card-sharp p-5">
    <p class="max-w-2xl text-sm leading-6 text-text-muted">
      The old bulk identify surface depended on the removed v1 server. This route now stays on the v2 shell
      without loading deleted v1 modules.
    </p>
  </div>
</section>
