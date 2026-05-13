<script lang="ts">
  import { onMount } from "svelte";
  import {
    Check,
    X,
    Loader2,
    ScanSearch,
    Play,
    Square,
    Users,
  } from "@lucide/svelte";
  import { Checkbox, cn } from "@obscura/ui-svelte";
  import {
    fetchAllPerformers,
    scrapePerformerApi,
    applyPerformerScrape,
  } from "$lib/v1/api/entities-v1";
  import { fetchInstalledScrapers } from "$lib/v1/api/scrapers-v1";
  import type {
    PerformerItem,
    ScraperPackage,
    NormalizedPerformerScrapeResult,
  } from "$lib/v1/api/types-v1";
  import { entityTerms } from "$lib/terminology";
  import ProviderSelector from "$lib/components/ProviderSelector.svelte";
  import EntityThumbnail from "$lib/v1/components/thumbnails/EntityThumbnailV1.svelte";

  interface PerformerRow {
    performer: PerformerItem;
    status:
      | "pending"
      | "scraping"
      | "found"
      | "no-result"
      | "error"
      | "accepted"
      | "rejected";
    result?: NormalizedPerformerScrapeResult;
    error?: string;
  }

  let rows = $state<PerformerRow[]>([]);
  let scrapers = $state<ScraperPackage[]>([]);
  let selectedScraperId = $state<string | null>(null);
  let loading = $state(true);
  let running = $state(false);
  let aborted = $state(false);
  let autoAccept = $state(false);

  async function loadData() {
    loading = true;
    try {
      const [perfRes, scrapersRes] = await Promise.all([
        fetchAllPerformers({ sort: "name", order: "asc" }),
        fetchInstalledScrapers(),
      ]);
      const sparse = perfRes.performers.filter((p) => !p.imagePath || !p.gender);
      rows = sparse.map((performer) => ({ performer, status: "pending" }));
      const perfScrapers = scrapersRes.packages.filter((pkg) => {
        const caps = pkg.capabilities as Record<string, boolean> | null;
        return (
          pkg.enabled &&
          caps &&
          (caps.performerByURL || caps.performerByName || caps.performerByFragment)
        );
      });
      scrapers = perfScrapers;
      if (!selectedScraperId && perfScrapers.length > 0) {
        selectedScraperId = perfScrapers[0].id;
      }
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadData();
  });

  function setRowStatus(index: number, patch: Partial<PerformerRow>): void {
    rows = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
  }

  async function runBulkScrape() {
    if (!selectedScraperId) return;
    running = true;
    aborted = false;
    rows = rows.map((r) =>
      r.status === "accepted" || r.status === "rejected"
        ? r
        : { ...r, status: "pending" },
    );

    for (let i = 0; i < rows.length; i++) {
      if (aborted) break;
      const row = rows[i];
      if (row.status === "accepted" || row.status === "rejected") continue;
      setRowStatus(i, { status: "scraping" });
      try {
        const res = await scrapePerformerApi(selectedScraperId, row.performer.id);
        const result = res.result ?? res.results?.[0] ?? null;
        if (result) {
          if (autoAccept) {
            const allFields = Object.entries(result)
              .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0))
              .map(([k]) => k);
            try {
              await applyPerformerScrape(
                row.performer.id,
                result as unknown as Record<string, unknown>,
                allFields,
              );
              setRowStatus(i, { status: "accepted", result });
            } catch {
              setRowStatus(i, { status: "found", result });
            }
          } else {
            setRowStatus(i, { status: "found", result });
          }
        } else {
          setRowStatus(i, { status: "no-result" });
        }
      } catch (err) {
        setRowStatus(i, { status: "error", error: String(err) });
      }
    }

    running = false;
  }

  async function acceptRow(index: number) {
    const row = rows[index];
    if (!row.result) return;
    const allFields = Object.entries(row.result)
      .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && v.length === 0))
      .map(([k]) => k);
    try {
      await applyPerformerScrape(
        row.performer.id,
        row.result as unknown as Record<string, unknown>,
        allFields,
      );
      setRowStatus(index, { status: "accepted" });
    } catch (err) {
      console.error(err);
    }
  }

  function rejectRow(index: number) {
    setRowStatus(index, { status: "rejected" });
  }

  function acceptAll() {
    rows.forEach((row, i) => {
      if (row.status === "found" && row.result) void acceptRow(i);
    });
  }

  const processed = $derived(rows.filter((r) => r.status !== "pending").length);
  const found = $derived(rows.filter((r) => r.status === "found").length);
  const accepted = $derived(rows.filter((r) => r.status === "accepted").length);
  const progress = $derived(rows.length > 0 ? Math.round((processed / rows.length) * 100) : 0);
</script>

<svelte:head>
  <title>Bulk {entityTerms.performer} Scrape — Obscura</title>
</svelte:head>

{#if loading}
  <div class="surface-well p-12 flex items-center justify-center">
    <Loader2 class="h-6 w-6 text-text-disabled animate-spin" />
  </div>
{:else}
  <div class="space-y-4">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="flex items-center gap-2 text-lg font-heading font-semibold">
          <ScanSearch class="h-5 w-5 text-text-accent" />
          Bulk {entityTerms.performer} scrape
        </h2>
        <p class="text-text-muted text-[0.78rem] mt-1">
          Scrape metadata for performers missing images or gender info
        </p>
      </div>
      <span class="text-mono-sm text-text-disabled">
        {rows.length} performer{rows.length !== 1 ? "s" : ""}
      </span>
    </div>

    <div class="surface-well p-3 flex items-center gap-3 flex-wrap relative z-20">
      <ProviderSelector
        value={selectedScraperId ?? ""}
        onChange={(v) => (selectedScraperId = v)}
        disabled={running}
        class="flex-1 min-w-[200px]"
        groups={[{ options: scrapers.map((s) => ({ value: s.id, label: s.name })) }]}
      />

      <label class="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
        <Checkbox
          checked={autoAccept}
          disabled={running}
          onchange={(e: Event) => (autoAccept = (e.currentTarget as HTMLInputElement).checked)}
        />
        Auto-accept
      </label>

      {#if !running}
        <button
          type="button"
          onclick={() => void runBulkScrape()}
          disabled={!selectedScraperId || rows.length === 0}
          class={cn(
            "flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium transition-all duration-fast",
            "bg-accent-950 text-text-accent border border-border-accent",
            "hover:bg-accent-900 disabled:opacity-50",
          )}
        >
          <Play class="h-3 w-3" />
          Start
        </button>
      {:else}
        <button
          type="button"
          onclick={() => (aborted = true)}
          class="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-status-error border border-status-error/30 hover:bg-status-error/10 transition-all duration-fast"
        >
          <Square class="h-3 w-3" />
          Stop
        </button>
      {/if}

      {#if found > 0 && !running}
        <button
          type="button"
          onclick={acceptAll}
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs text-status-success border border-status-success/30 hover:bg-status-success/10 transition-all duration-fast"
        >
          <Check class="h-3 w-3" />
          Accept All ({found})
        </button>
      {/if}
    </div>

    {#if running}
      <div class="surface-well p-2">
        <div class="h-1.5 bg-surface-3 overflow-hidden">
          <div class="h-full bg-accent-500 transition-all duration-300" style={`width: ${progress}%`}></div>
        </div>
        <div class="flex justify-between mt-1.5 text-[0.65rem] text-text-disabled font-mono">
          <span>{processed} / {rows.length}</span>
          <span>{accepted} accepted</span>
        </div>
      </div>
    {/if}

    {#if rows.length === 0}
      <div class="surface-well p-12 text-center">
        <Users class="h-10 w-10 text-text-disabled mx-auto mb-3" />
        <p class="text-text-muted text-sm">All performers have complete metadata.</p>
      </div>
    {:else}
      <div class="space-y-1">
        {#each rows as row, i (row.performer.id)}
          <div
            class={cn(
              "surface-well flex items-center gap-3 px-3 py-2.5 transition-colors duration-fast",
              row.status === "accepted" && "opacity-60",
              row.status === "rejected" && "opacity-40",
            )}
          >
            <div class="flex-shrink-0 h-10 w-8 overflow-hidden bg-surface-3">
              <EntityThumbnail
                kind="performer"
                performer={row.performer}
                compact
                showChips={false}
                class="h-full w-full"
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm text-text-primary truncate">{row.performer.name}</div>
              {#if row.result && row.status === "found"}
                <div class="text-[0.65rem] text-text-muted truncate mt-0.5">
                  {[row.result.gender, row.result.country, row.result.birthdate].filter(Boolean).join(" | ")}
                </div>
              {/if}
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              {#if row.status === "pending"}
                <span class="text-[0.65rem] text-text-disabled">Pending</span>
              {:else if row.status === "scraping"}
                <Loader2 class="h-3.5 w-3.5 text-text-accent animate-spin" />
              {:else if row.status === "found"}
                <button
                  type="button"
                  onclick={() => void acceptRow(i)}
                  class="flex items-center gap-1 px-2 py-1 text-[0.65rem] text-status-success border border-status-success/30 hover:bg-status-success/10 transition-colors"
                >
                  <Check class="h-2.5 w-2.5" />
                  Accept
                </button>
                <button
                  type="button"
                  onclick={() => rejectRow(i)}
                  aria-label="Reject"
                  class="flex items-center gap-1 px-2 py-1 text-[0.65rem] text-text-muted hover:text-status-error transition-colors"
                >
                  <X class="h-2.5 w-2.5" />
                </button>
              {:else if row.status === "no-result"}
                <span class="text-[0.65rem] text-text-disabled">No result</span>
              {:else if row.status === "error"}
                <span class="text-[0.65rem] text-status-error">Error</span>
              {:else if row.status === "accepted"}
                <span class="flex items-center gap-1 text-[0.65rem] text-status-success">
                  <Check class="h-2.5 w-2.5" />
                  Applied
                </span>
              {:else if row.status === "rejected"}
                <span class="text-[0.65rem] text-text-disabled">Skipped</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}
