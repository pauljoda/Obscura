<script lang="ts">
  import { Film, Images, Users, Activity } from "@lucide/svelte";
  import { page } from "$app/state";
  import { cn } from "@obscura/ui-svelte";
  import MobileMoreSheet from "./MobileMoreSheet.svelte";
  import MobileMoreNavButton from "./MobileMoreNavButton.svelte";

  const primaryTabs = [
    { label: "Videos", href: "/videos", icon: Film },
    { label: "Galleries", href: "/galleries", icon: Images },
    { label: "Actors", href: "/performers", icon: Users },
    { label: "Jobs", href: "/jobs", icon: Activity },
  ];

  const moreRoutes = ["/", "/search", "/images", "/studios", "/tags", "/collections", "/identify", "/settings"];

  const pathname = $derived(page.url.pathname);
  let sheetOpen = $state(false);
  const isMoreActive = $derived(
    sheetOpen ||
      moreRoutes.some((route) => pathname === route || (route !== "/" && pathname.startsWith(route + "/"))),
  );
</script>

<nav
  class="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t border-border-subtle bg-surface-1 md:hidden"
>
  {#each primaryTabs as tab (tab.href)}
    {@const active = pathname === tab.href || pathname.startsWith(tab.href + "/")}
    {@const Icon = tab.icon}
    <a
      href={tab.href}
      class={cn(
        "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[0.65rem] transition-colors duration-fast",
        active ? "text-text-accent" : "text-text-disabled hover:text-text-muted",
      )}
    >
      <Icon class="h-5 w-5" />
      <span>{tab.label}</span>
    </a>
  {/each}

  <MobileMoreNavButton
    {isMoreActive}
    {sheetOpen}
    onToggleSheet={() => (sheetOpen = !sheetOpen)}
  />
</nav>

<MobileMoreSheet open={sheetOpen} onClose={() => (sheetOpen = false)} />
