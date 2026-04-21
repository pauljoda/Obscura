<script lang="ts">
  import { Badge } from "@obscura/ui-svelte";
  import type { JobRun } from "$lib/api/types";
  import {
    displayDescribeTrigger,
    displayJobHeading,
    formatRelativeTime,
    formatStamp,
    jobBadgeVariant,
  } from "$lib/jobs/helpers";
  import ForceRebuildBadge from "./ForceRebuildBadge.svelte";

  interface Props {
    job: JobRun;
    nsfwMode: string;
  }

  let { job, nsfwMode }: Props = $props();
</script>

<div class="grid gap-3 px-4 py-3 md:grid-cols-[1.1fr_0.8fr_0.8fr]">
  <div class="min-w-0">
    <p class="truncate text-[0.84rem] font-medium text-text-primary">
      {displayJobHeading(job, nsfwMode)}
    </p>
    <p class="mt-1 truncate text-mono-sm text-text-disabled">
      {displayDescribeTrigger(job, nsfwMode)}
    </p>
  </div>
  <div class="flex items-center gap-2">
    <Badge variant={jobBadgeVariant(job)} class="text-[0.56rem]">
      {#snippet children()}{job.queueLabel}{/snippet}
    </Badge>
    <ForceRebuildBadge {job} />
  </div>
  <div class="text-right text-[0.72rem] text-text-muted">
    <div>{formatRelativeTime(job.finishedAt ?? job.updatedAt)}</div>
    <div class="mt-1 text-text-disabled">{formatStamp(job.finishedAt)}</div>
  </div>
</div>
