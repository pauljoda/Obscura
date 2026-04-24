<script lang="ts">
  import { useNsfw } from "$lib/stores/nsfw.svelte";
  import { cn } from "@obscura/ui-svelte";
  import { garbleTagLabelText } from "$lib/nsfw-tags";

  interface Props {
    isNsfw: boolean;
    text: string;
    class?: string;
  }

  let { isNsfw, text, class: className }: Props = $props();
  const nsfw = useNsfw();
  const tagIsNsfw = $derived(isNsfw === true);
</script>

{#if !tagIsNsfw || nsfw.mode === "show"}
  <span class={className}>{text}</span>
{:else if nsfw.mode === "blur"}
  <span
    class={cn("group/nsfw-tag inline max-w-full align-baseline", className)}
    title="NSFW — hover to reveal"
  >
    <span
      aria-hidden="true"
      class="inline blur-[2.5px] contrast-[0.85] transition-[filter] duration-200 group-hover/nsfw-tag:hidden"
    >
      {garbleTagLabelText(text)}
    </span>
    <span class="hidden group-hover/nsfw-tag:inline">{text}</span>
  </span>
{/if}
