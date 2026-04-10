"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";

export interface StarRatingPickerProps {
  value: number | null;
  onChange?: (value: number | null) => void;
  readOnly?: boolean;
}

export function StarRatingPicker({
  value,
  onChange,
  readOnly,
}: StarRatingPickerProps) {
  const stars = value ? Math.round(value / 20) : 0;
  const [hovered, setHovered] = useState(0);

  if (readOnly) {
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "h-4 w-4",
              i < stars
                ? "fill-accent-500 text-accent-500"
                : "text-text-disabled"
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className="star-rating-picker"
      onMouseLeave={() => setHovered(0)}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const starIdx = i + 1;
        const active = hovered > 0 ? starIdx <= hovered : starIdx <= stars;
        return (
          <button
            key={i}
            type="button"
            onMouseEnter={() => setHovered(starIdx)}
            onClick={() => {
              const newVal = starIdx === stars ? null : starIdx * 20;
              onChange?.(newVal);
            }}
          >
            <Star
              className={cn(
                "h-5 w-5 transition-colors duration-fast",
                active
                  ? "fill-accent-500 text-accent-500"
                  : "text-text-disabled hover:text-accent-800"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
