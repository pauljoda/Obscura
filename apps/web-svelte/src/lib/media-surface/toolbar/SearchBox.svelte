<script lang="ts">
  import { Search as SearchIcon } from "@lucide/svelte";
  import { cn } from "@obscura/ui-svelte";

  interface Props {
    value: string;
    placeholder?: string;
    /** Optional debounce in ms — emits `onChange` only after the user pauses typing. */
    debounceMs?: number;
    onChange: (next: string) => void;
    /** When set, restricts which class string gets applied so the box can render
     *  inline (sm:flex-1) or full-width (mobile own-row). */
    variant?: "inline" | "block";
  }

  let {
    value,
    placeholder = "Search...",
    debounceMs = 0,
    onChange,
    variant = "inline",
  }: Props = $props();

  let timer: ReturnType<typeof setTimeout> | null = null;

  function emit(next: string) {
    if (debounceMs <= 0) {
      onChange(next);
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onChange(next);
    }, debounceMs);
  }

  function onInput(event: Event) {
    emit((event.currentTarget as HTMLInputElement).value);
  }
</script>

<div class={cn("relative", variant === "inline" && "flex-1 min-w-0")}>
  <SearchIcon
    class="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-disabled"
  />
  <input
    type="text"
    {placeholder}
    {value}
    oninput={onInput}
    class={cn(
      "w-full pl-7 pr-3 py-1.5 text-[0.78rem] text-text-primary",
      "placeholder:text-text-disabled",
      "focus:outline-none transition-colors duration-fast",
      variant === "block"
        ? "bg-surface-2 border border-border-subtle focus:border-accent-500"
        : "bg-transparent",
    )}
  />
</div>
