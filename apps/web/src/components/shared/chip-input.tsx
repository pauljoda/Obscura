"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from "react";
import { X } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";

export interface ChipInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  suggestions: { name: string; count?: number }[];
  placeholder?: string;
  newItems?: Set<string>;
}

export function ChipInput({
  values,
  onChange,
  suggestions,
  placeholder,
  newItems,
}: ChipInputProps) {
  const [input, setInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Show all non-selected suggestions on focus, filter when typing
  const available = suggestions.filter(
    (s) => !values.some((v) => v.toLowerCase() === s.name.toLowerCase())
  );
  const filtered = input.trim()
    ? available.filter((s) =>
        s.name.toLowerCase().includes(input.toLowerCase())
      )
    : available;

  // Show "Add X" option when typing something not in suggestions
  const inputTrimmed = input.trim();
  const showAddOption =
    inputTrimmed &&
    !suggestions.some(
      (s) => s.name.toLowerCase() === inputTrimmed.toLowerCase()
    ) &&
    !values.some((v) => v.toLowerCase() === inputTrimmed.toLowerCase());

  const addValue = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (
        trimmed &&
        !values.some((v) => v.toLowerCase() === trimmed.toLowerCase())
      ) {
        onChange([...values, trimmed]);
      }
      setInput("");
      setShowDropdown(false);
      setActiveIndex(-1);
      inputRef.current?.focus();
    },
    [values, onChange]
  );

  const removeValue = useCallback(
    (idx: number) => {
      onChange(values.filter((_, i) => i !== idx));
    },
    [values, onChange]
  );

  // Total items in dropdown: filtered suggestions + optional "Add" item
  const displayItems = filtered.slice(0, 12);
  const totalDropdownItems = displayItems.length + (showAddOption ? 1 : 0);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < displayItems.length) {
        addValue(displayItems[activeIndex].name);
      } else if (activeIndex === displayItems.length && showAddOption) {
        addValue(inputTrimmed);
      } else if (inputTrimmed) {
        addValue(inputTrimmed);
      }
    } else if (e.key === "Backspace" && !input && values.length > 0) {
      removeValue(values.length - 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, totalDropdownItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const isNewItem = (name: string) =>
    newItems?.has(name.toLowerCase()) ?? false;

  return (
    <div className="relative" ref={containerRef}>
      <div
        className="chip-input-container"
        onClick={() => inputRef.current?.focus()}
      >
        {values.map((v, i) => (
          <span
            key={v}
            className={cn(
              "chip-removable",
              isNewItem(v) && "chip-removable-new"
            )}
          >
            {v}
            <button
              type="button"
              className="chip-remove-btn"
              onClick={(e) => {
                e.stopPropagation();
                removeValue(i);
              }}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setShowDropdown(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder={values.length === 0 ? placeholder : ""}
        />
      </div>

      {showDropdown && totalDropdownItems > 0 && (
        <div className="autocomplete-dropdown">
          {displayItems.map((s, i) => (
            <div
              key={s.name}
              className={cn(
                "autocomplete-item",
                i === activeIndex && "autocomplete-item-active"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                addValue(s.name);
              }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              {s.name}
              {s.count != null && (
                <span className="autocomplete-item-count">{s.count}</span>
              )}
            </div>
          ))}
          {showAddOption && (
            <div
              className={cn(
                "autocomplete-item border-t border-border-subtle text-text-accent",
                activeIndex === displayItems.length && "autocomplete-item-active"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                addValue(inputTrimmed);
              }}
              onMouseEnter={() => setActiveIndex(displayItems.length)}
            >
              + Add &ldquo;{inputTrimmed}&rdquo;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
