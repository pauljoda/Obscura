<script lang="ts">
  import "../app.css";

  import { cn } from "@obscura/ui-svelte";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import CanvasHeader from "$lib/components/CanvasHeader.svelte";
  import MobileNav from "$lib/components/MobileNav.svelte";
  import BreakingUpgradeGate from "$lib/components/BreakingUpgradeGate.svelte";
  import CommandPalette from "$lib/components/CommandPalette.svelte";
  import PlaylistController from "$lib/components/PlaylistController.svelte";

  import { provideNsfw } from "$lib/stores/nsfw.svelte";
  import { provideAppChrome } from "$lib/stores/app-chrome.svelte";
  import { provideSearch } from "$lib/stores/search.svelte";
  import { providePlaylist } from "$lib/stores/playlist.svelte";

  let { data, children: pageContent } = $props();

  // Wire all context providers once at the root. The stores themselves
  // attach keyboard listeners (Cmd+K, ⌘⇧Z) via $effect.root on client boot.
  provideNsfw(() => ({
    initialMode: data.initialNsfwMode,
    lanAutoEnable: data.lanAutoEnable,
  }));
  const chrome = provideAppChrome(() => data.initialCollapsed);
  provideSearch();
  const playlist = providePlaylist();

  $effect(() => {
    void playlist.hydrate();
  });
</script>

<BreakingUpgradeGate awaitingConsent={data.awaitingBreakingConsent}>
  {#snippet children()}
    <div class="flex min-h-dvh">
      <!-- Desktop sidebar -->
      <div class="hidden md:block">
        <Sidebar collapsed={chrome.sidebarCollapsed} onToggle={() => chrome.toggleSidebar()} />
      </div>

      <main
        class={cn(
          "flex flex-1 flex-col transition-[margin-left] duration-moderate",
          playlist.isActive ? "pb-28 md:pb-14" : "pb-14 md:pb-0",
          "h-dvh overflow-y-auto",
          chrome.sidebarCollapsed ? "md:ml-14" : "md:ml-60",
        )}
        style:transition-timing-function="var(--ease-mechanical)"
      >
        <CanvasHeader />
        <div class="flex-1 p-5">
          {@render pageContent()}
        </div>
      </main>

      <MobileNav />
      <CommandPalette />
      <PlaylistController />
    </div>
  {/snippet}
</BreakingUpgradeGate>
