<script lang="ts">
  import type { Component } from "svelte";
  import { cn } from "@obscura/ui-svelte";
  import FormField from "./FormField.svelte";

  interface Props {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    icon?: Component;
    placeholder?: string;
    helper?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    type?: "text" | "email" | "url" | "search";
    autocomplete?: AutoFill;
    inputClass?: string;
  }

  let {
    value,
    onChange,
    label,
    icon,
    placeholder,
    helper,
    error,
    required = false,
    disabled = false,
    type = "text",
    autocomplete = undefined,
    inputClass = "",
  }: Props = $props();

  const id = `text-${Math.random().toString(36).slice(2, 9)}`;
</script>

<FormField {label} {icon} {helper} {error} {required} htmlFor={id}>
  <input
    {id}
    {type}
    {disabled}
    {placeholder}
    {autocomplete}
    {value}
    oninput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
    aria-invalid={error ? "true" : undefined}
    class={cn(
      "w-full border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-primary transition-colors",
      "placeholder:text-text-disabled",
      "focus:border-border-accent focus:outline-none focus:shadow-[var(--shadow-focus-accent)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      error && "border-error/60",
      inputClass,
    )}
  />
</FormField>
