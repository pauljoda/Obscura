<script lang="ts">
  import { Activity, Clock } from "@lucide/svelte";
  import { Badge, StatusLed, type LedStatus } from "@obscura/ui-svelte";

  let { data } = $props();

  const d = data.dashboard;

  function jobStatus(status: string): LedStatus {
    switch (status) {
      case "completed":
      case "succeeded":
        return "active";
      case "failed":
      case "errored":
        return "error";
      case "running":
      case "active":
        return "accent";
      case "queued":
      case "pending":
        return "info";
      default:
        return "idle";
    }
  }

  function statusVariant(status: string): "success" | "warning" | "error" | "info" | "default" {
    if (status === "completed" || status === "succeeded") return "success";
    if (status === "failed" || status === "errored") return "error";
    if (status === "running" || status === "active") return "info";
    if (status === "queued" || status === "pending") return "warning";
    return "default";
  }
</script>

<svelte:head>
  <title>Jobs — Obscura</title>
</svelte:head>

<div class="space-y-6">
  <header>
    <p class="text-kicker text-text-muted">Operate</p>
    <h1 class="text-h1 text-text-primary">Jobs</h1>
    {#if d?.lastScanAt}
      <p class="text-body-sm text-text-muted mt-1">
        Last scan: {new Date(d.lastScanAt).toLocaleString()}
      </p>
    {/if}
  </header>

  {#if !d}
    <div class="surface-panel p-8 text-center">
      <Activity class="h-10 w-10 mx-auto mb-3 text-text-disabled" />
      <p class="text-body text-text-muted">Job dashboard unavailable.</p>
    </div>
  {:else}
    {#if d.queues?.length}
      <section class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {#each d.queues as q}
          <div class="surface-panel p-4 space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <span class="text-label text-text-muted truncate">{q.label ?? q.queueName}</span>
              <StatusLed status={(q.active ?? 0) > 0 ? "accent" : "idle"} />
            </div>
            <dl class="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[0.7rem] text-text-secondary">
              <dt class="text-text-muted">Active:</dt><dd>{q.active ?? 0}</dd>
              <dt class="text-text-muted">Queued:</dt><dd>{q.queued ?? q.pending ?? 0}</dd>
              <dt class="text-text-muted">Failed:</dt><dd>{q.failed ?? 0}</dd>
              <dt class="text-text-muted">Complete:</dt><dd>{q.completed ?? 0}</dd>
            </dl>
          </div>
        {/each}
      </section>
    {/if}

    {#each ["activeJobs", "failedJobs", "recentJobs"] as key}
      {@const rows = d[key as "activeJobs" | "failedJobs" | "recentJobs"] ?? []}
      {#if rows.length > 0}
        <section class="space-y-2">
          <h2 class="text-label text-text-muted capitalize">
            {key.replace("Jobs", "")} jobs ({rows.length})
          </h2>
          <ul class="surface-panel divide-y divide-border-subtle">
            {#each rows as j (j.id)}
              <li class="flex items-center gap-3 px-4 py-2 text-body-sm">
                <StatusLed status={jobStatus(j.status)} />
                <span class="font-mono text-text-muted text-[0.7rem] w-24 truncate" title={j.queueLabel}>
                  {j.queueLabel ?? j.queueName}
                </span>
                <span class="flex-1 min-w-0 truncate text-text-primary">
                  {j.targetLabel ?? j.targetType ?? "—"}
                </span>
                <Badge variant={statusVariant(j.status)}>{j.status}</Badge>
                {#if j.progress > 0 && j.progress < 1}
                  <span class="text-text-disabled font-mono w-12 text-right">{Math.round(j.progress * 100)}%</span>
                {/if}
                <span class="text-text-disabled text-[0.7rem] font-mono flex items-center gap-1 w-32 justify-end">
                  <Clock class="h-3 w-3" />
                  {j.finishedAt ? new Date(j.finishedAt).toLocaleTimeString() : j.startedAt ? new Date(j.startedAt).toLocaleTimeString() : "—"}
                </span>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/each}
  {/if}
</div>
