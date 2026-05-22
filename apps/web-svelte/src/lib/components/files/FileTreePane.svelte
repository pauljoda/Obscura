<script lang="ts">
  import { onMount } from "svelte";
  import type { ContextMenuItem, ContextMenuOpenContext, FileTree, FileTreeDirectoryHandle } from "@pierre/trees";
  import { Search } from "@lucide/svelte";
  import type { FileActionId } from "$lib/files/file-actions";
  import { fileContextActions } from "$lib/files/file-actions";
  import type { FileTreeNodeMeta } from "$lib/files/file-tree-state";
  import { unloadedExpandedDirectories } from "$lib/files/file-tree-state";

  interface Props {
    paths: string[];
    registry: Map<string, FileTreeNodeMeta>;
    loadedKeys: Set<string>;
    selectedPath: string | null;
    search: string;
    loading?: boolean;
    onSearch?: (value: string) => void;
    onSelect?: (treePath: string) => void;
    onExpand?: (meta: FileTreeNodeMeta) => void;
    onMove?: (sourceTreePath: string, targetDirectoryTreePath: string | null) => void;
    onAction?: (action: FileActionId, treePath: string) => void;
    onRename?: (treePath: string, newName: string) => void;
  }

  let {
    paths,
    registry,
    loadedKeys,
    selectedPath,
    search,
    loading = false,
    onSearch,
    onSelect,
    onExpand,
    onMove,
    onAction,
    onRename,
  }: Props = $props();

  let host: HTMLDivElement;
  let tree = $state<FileTree | null>(null);
  let unsubscribe: (() => void) | null = null;
  let removeTreeClickBridge: (() => void) | null = null;
  let suppressSelectionEvent = false;
  let lastPathsKey = "";

  function basename(path: string): string {
    return path.split("/").filter(Boolean).at(-1) ?? path;
  }

  function renderContextMenu(item: ContextMenuItem, context: ContextMenuOpenContext): HTMLElement {
    const menu = document.createElement("div");
    menu.className = "obscura-file-context-menu";
    menu.dataset.testid = "files-context-menu";

    for (const action of fileContextActions(item.kind)) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.dataset.action = action.id;
      if (action.destructive) button.dataset.destructive = "true";
      button.addEventListener("click", () => {
        if (action.id === "rename") {
          tree?.startRenaming(item.path);
        } else {
          onAction?.(action.id, item.path);
        }
        context.close();
      });
      menu.append(button);
    }

    return menu;
  }

  function checkLazyExpansion(): void {
    if (!tree) return;
    const targets = unloadedExpandedDirectories(paths, registry, loadedKeys, (treePath) => {
      const item = tree?.getItem(treePath);
      if (!item || !item.isDirectory()) return false;
      return (item as FileTreeDirectoryHandle).isExpanded();
    });
    for (const meta of targets) onExpand?.(meta);
  }

  function bridgeRowClick(event: MouseEvent): void {
    const row = event
      .composedPath()
      .find((target): target is HTMLElement =>
        target instanceof HTMLElement && target.matches("button[data-type='item']"),
      );
    const treePath = row?.dataset.itemPath;
    if (treePath) onSelect?.(treePath);
  }

  onMount(() => {
    void (async () => {
      const module = await import("@pierre/trees");
      tree = new module.FileTree({
        paths,
        initialExpansion: "closed",
        icons: { set: "complete", colored: true },
        search: true,
        initialSearchQuery: search || null,
        dragAndDrop: {
          canDrag: (draggedPaths) => draggedPaths.length === 1,
          canDrop: () => true,
          onDropComplete: (event) => onMove?.(event.draggedPaths[0], event.target.directoryPath),
        },
        renaming: {
          canRename: () => true,
          onRename: (event) => onRename?.(event.sourcePath, basename(event.destinationPath)),
        },
        composition: {
          contextMenu: {
            enabled: true,
            triggerMode: "both",
            buttonVisibility: "always",
            render: renderContextMenu,
          },
        },
        onSelectionChange: (selectedPaths) => {
          if (suppressSelectionEvent) return;
          const next = selectedPaths[0];
          if (next) onSelect?.(next);
        },
        unsafeCSS: `
        :host {
          --trees-fg-override: #ede7da;
          --trees-muted-fg-override: #9b9588;
          --trees-border-color-override: rgba(196, 154, 90, 0.2);
          --trees-selected-bg-override: rgba(196, 154, 90, 0.18);
          --trees-focus-ring-override: rgba(196, 154, 90, 0.58);
          background: rgba(18, 17, 16, 0.96) !important;
          color: #ede7da;
        }
        [data-file-tree-virtualized-wrapper],
        [data-file-tree-virtualized-root],
        [data-file-tree-virtualized-scroll],
        [data-file-tree-virtualized-list],
        [data-file-tree-virtualized-sticky],
        [data-truncate-marker] {
          background: rgba(18, 17, 16, 0.96) !important;
          color: #ede7da;
        }
        input[data-file-tree-search-input] {
          border: 1px solid rgba(196, 154, 90, 0.18);
          border-radius: 0;
          background: rgba(255, 255, 255, 0.035) !important;
          color: #ede7da;
          font-family: Inter, system-ui, sans-serif;
        }
        input[data-file-tree-search-input]::placeholder {
          color: #9b9588;
        }
        button[data-type='item'] {
          border-radius: 0;
          background: transparent !important;
          color: #ede7da;
          font-family: Inter, system-ui, sans-serif;
        }
        button[data-type='item'][data-item-selected] {
          box-shadow: inset 2px 0 0 #c49a5a, 0 0 18px rgba(196, 154, 90, 0.16);
        }
        .obscura-file-context-menu {
          display: grid;
          min-width: 10rem;
          border: 1px solid rgba(196, 154, 90, 0.3);
          background: rgba(20, 19, 18, 0.94);
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(18px);
        }
        .obscura-file-context-menu button {
          border: 0;
          border-radius: 0;
          background: transparent;
          color: #ede7da;
          padding: 0.58rem 0.75rem;
          text-align: left;
          font: 500 0.82rem Inter, system-ui, sans-serif;
        }
        .obscura-file-context-menu button:hover,
        .obscura-file-context-menu button:focus-visible {
          background: rgba(196, 154, 90, 0.18);
          outline: none;
        }
        .obscura-file-context-menu button[data-destructive='true'] {
          color: #f2a4a4;
        }
        `,
      });
      tree.render({ containerWrapper: host });
      host.addEventListener("click", bridgeRowClick);
      removeTreeClickBridge = () => host.removeEventListener("click", bridgeRowClick);
      unsubscribe = tree.subscribe(checkLazyExpansion);
      checkLazyExpansion();
      lastPathsKey = paths.join("\n");
    })();

    return () => {
      removeTreeClickBridge?.();
      unsubscribe?.();
      tree?.cleanUp();
    };
  });

  $effect(() => {
    if (!tree) return;
    const nextKey = paths.join("\n");
    if (nextKey !== lastPathsKey) {
      tree.resetPaths(paths, { initialExpandedPaths: paths.filter((path) => loadedKeys.has(`${registry.get(path)?.rootId}:${registry.get(path)?.path}`)) });
      lastPathsKey = nextKey;
      checkLazyExpansion();
    }
  });

  $effect(() => {
    if (!tree) return;
    tree.setSearch(search || null);
  });

  $effect(() => {
    if (!tree || !selectedPath) return;
    const item = tree.getItem(selectedPath);
    if (!item?.isSelected()) {
      suppressSelectionEvent = true;
      item?.select();
      queueMicrotask(() => {
        suppressSelectionEvent = false;
      });
    }
    tree.scrollToPath(selectedPath, { offset: "nearest", focus: false });
  });
</script>

<section class="files-tree-pane" aria-label="Directory tree">
  <div class="tree-toolbar">
    <Search class="h-4 w-4" />
    <input
      type="search"
      placeholder="Filter loaded files"
      value={search}
      oninput={(event) => onSearch?.(event.currentTarget.value)}
    />
  </div>
  <div class="tree-host" bind:this={host} aria-busy={loading}></div>
</section>

<style>
  .files-tree-pane {
    display: grid;
    min-height: 0;
    grid-template-rows: auto 1fr;
    border-right: 1px solid rgba(196, 154, 90, 0.18);
    background: rgba(18, 17, 16, 0.9);
  }

  .tree-toolbar {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    border-bottom: 1px solid rgba(196, 154, 90, 0.16);
    padding: 0.75rem;
    color: var(--color-text-muted);
  }

  .tree-toolbar input {
    min-width: 0;
    width: 100%;
    border: 1px solid rgba(196, 154, 90, 0.18);
    border-radius: 0;
    background: rgba(255, 255, 255, 0.035);
    color: var(--color-text-primary);
    padding: 0.48rem 0.6rem;
    font-size: 0.82rem;
    outline: none;
  }

  .tree-toolbar input:focus {
    border-color: rgba(196, 154, 90, 0.6);
    box-shadow: 0 0 18px rgba(196, 154, 90, 0.15);
  }

  .tree-host {
    min-height: 0;
    height: 100%;
  }
</style>
