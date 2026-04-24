<script lang="ts">
  import { cn } from "@obscura/ui-svelte";

  interface Props {
    checked: boolean;
    label: string;
    description: string;
    class?: string;
    onChange: (checked: boolean) => void;
  }

  let { checked, label, description, class: className, onChange }: Props = $props();
</script>

<button
  type="button"
  onclick={() => onChange(!checked)}
  class={cn(
    "surface-card no-lift flex h-full min-h-[104px] flex-col justify-between p-3.5 text-left transition-all duration-normal group",
    checked ? "border-border-accent/40 bg-surface-2/30" : "opacity-85 hover:opacity-100",
    className,
  )}
>
  <div class="flex items-start justify-between gap-3 mb-2 w-full">
    <p class={cn("text-sm font-medium transition-colors", checked ? "text-text-primary" : "text-text-secondary")}>
      {label}
    </p>
    <div
      class={cn(
        "relative w-9 h-5 border transition-colors duration-fast shrink-0",
        checked ? "border-border-accent bg-accent-950/30" : "border-border-default bg-surface-1 shadow-well",
      )}
    >
      <div
        class={cn(
          "absolute top-0.5 bottom-0.5 w-3.5 bg-surface-3 border border-border-subtle transition-all duration-fast flex items-center justify-center shadow-sm",
          checked ? "left-[1.1rem] border-border-accent" : "left-0.5",
        )}
      >
        <div class={cn("led led-sm", checked ? "led-active" : "led-idle")}></div>
      </div>
    </div>
  </div>
  <p class="text-[0.72rem] text-text-muted leading-relaxed">{description}</p>
</button>
