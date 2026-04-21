<script lang="ts">
  import { PanelLeftClose, PanelLeftOpen } from "@lucide/svelte";
  import { page } from "$app/state";
  import { appShellSections, cn } from "@obscura/ui-svelte";
  import { appShellNavIconMap } from "./app-shell-nav-icon-map";
  import LogoMark from "./LogoMark.svelte";
  import ChangelogDialog from "./ChangelogDialog.svelte";
  import { APP_VERSION } from "$lib/version";

  interface Props {
    collapsed: boolean;
    onToggle: () => void;
  }

  let { collapsed, onToggle }: Props = $props();
  let hovered = $state(false);
  const isExpanded = $derived(!collapsed || hovered);
  const pathname = $derived(page.url.pathname);

  function isActive(href: string): boolean {
    return pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
  }
</script>

<aside
  onmouseenter={() => (hovered = true)}
  onmouseleave={() => (hovered = false)}
  class={cn(
    "fixed left-0 top-0 z-40 flex h-dvh flex-col bg-surface-1 border-r border-border-subtle transition-[width] duration-moderate overflow-hidden",
    isExpanded ? "w-60" : "w-14",
  )}
  style:transition-timing-function="var(--ease-mechanical)"
>
  <!-- Logo + collapse toggle -->
  <div class="flex h-14 items-center justify-between px-3 border-b border-border-subtle shrink-0">
    <a
      href="/"
      aria-label="Dashboard"
      class="shrink-0 flex items-center h-full"
    >
      <div class="w-8 flex items-center justify-center shrink-0">
        <LogoMark size={24} />
      </div>
      <div
        class={cn(
          "overflow-hidden transition-[max-width,opacity] duration-moderate flex items-center",
          isExpanded ? "max-w-[160px] opacity-100 ml-2" : "max-w-0 opacity-0 ml-0",
        )}
      >
        <span class="font-heading font-bold tracking-[0.18em] text-text-primary text-lg">OBSCURA</span>
      </div>
    </a>
    <div
      class={cn(
        "shrink-0 overflow-hidden transition-[max-width,opacity] duration-moderate flex items-center justify-end",
        isExpanded ? "max-w-[32px] opacity-100" : "max-w-0 opacity-0",
      )}
    >
      <button
        onclick={onToggle}
        class="flex h-8 w-8 items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors duration-fast"
        aria-label={collapsed ? "Pin sidebar open" : "Collapse sidebar"}
      >
        {#if collapsed}
          <PanelLeftOpen class="h-4 w-4" />
        {:else}
          <PanelLeftClose class="h-4 w-4" />
        {/if}
      </button>
    </div>
  </div>

  <!-- Navigation sections -->
  <nav class="flex-1 overflow-y-auto overflow-x-hidden py-3 scrollbar-hidden">
    {#each appShellSections as section (section.id)}
      <div class="mb-4">
        <div
          class={cn(
            "px-4 pb-1.5 text-kicker whitespace-nowrap transition-[max-height,opacity] duration-moderate overflow-hidden",
            isExpanded ? "max-h-8 opacity-100" : "max-h-0 opacity-0",
          )}
        >
          {section.kicker}
        </div>
        <div
          class={cn(
            "mx-auto mb-1 w-6 separator transition-[max-height,opacity] duration-moderate overflow-hidden",
            !isExpanded ? "max-h-2 opacity-100" : "max-h-0 opacity-0",
          )}
        ></div>
        <ul class="space-y-0.5 px-2">
          {#each section.items as item (item.href)}
            {@const Icon = appShellNavIconMap[item.icon]}
            {@const active = isActive(item.href)}
            <li>
              <a
                href={item.href}
                class={cn(
                  "group relative flex items-center px-2.5 py-2 text-sm transition-colors duration-fast whitespace-nowrap",
                  active
                    ? "bg-accent-950 text-glow-accent"
                    : "text-text-muted hover:text-text-primary hover:bg-surface-2",
                )}
                title={!isExpanded ? item.label : undefined}
              >
                {#if active}
                  <span class="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-accent-500 shadow-[var(--shadow-glow-accent)]"></span>
                {/if}
                <div class="w-5 flex items-center justify-center shrink-0">
                  {#if Icon}
                    <Icon
                      class={cn(
                        "h-4 w-4",
                        active
                          ? "text-accent-300 drop-shadow-[0_0_8px_rgba(199,155,92,0.5)]"
                          : "text-text-muted group-hover:text-text-primary",
                      )}
                    />
                  {/if}
                </div>
                <div
                  class={cn(
                    "overflow-hidden transition-[max-width,opacity] duration-moderate",
                    isExpanded ? "max-w-[160px] opacity-100 ml-3" : "max-w-0 opacity-0 ml-0",
                  )}
                >
                  {item.label}
                </div>
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </nav>

  <!-- Version indicator -->
  <div class="border-t border-border-subtle px-3 py-3 shrink-0">
    <ChangelogDialog version={APP_VERSION}>
      {#snippet children()}
        <div class="flex items-center group overflow-hidden whitespace-nowrap h-5">
          <div class="w-8 flex items-center justify-center shrink-0">
            <span class="led led-sm led-idle"></span>
          </div>
          <div
            class={cn(
              "overflow-hidden transition-[max-width,opacity] duration-moderate",
              isExpanded ? "max-w-[160px] opacity-100 ml-1" : "max-w-0 opacity-0 ml-0",
            )}
          >
            <span class="text-mono-sm text-text-disabled transition-colors group-hover:text-text-accent">
              v{APP_VERSION}
            </span>
          </div>
        </div>
      {/snippet}
    </ChangelogDialog>
  </div>
</aside>
