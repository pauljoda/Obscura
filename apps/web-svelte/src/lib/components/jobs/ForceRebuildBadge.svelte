<script lang="ts">
  import { Badge } from "@obscura/ui-svelte";
  import type { JobRun } from "$lib/v1/api/types-v1";
  import { isForceRebuildJob } from "$lib/jobs/helpers";

  interface Props {
    job: JobRun;
  }

  let { job }: Props = $props();
</script>

{#if isForceRebuildJob(job)}
  <Badge variant="error" class="text-[0.56rem]">
    {#snippet children()}Force rebuild{/snippet}
  </Badge>
{/if}
