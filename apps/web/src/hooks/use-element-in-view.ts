"use client";

import { useEffect, useState, type RefObject } from "react";

interface UseElementInViewOptions {
  rootMargin?: string;
  threshold?: number;
}

export function useElementInView<T extends Element>(
  ref: RefObject<T | null>,
  options?: UseElementInViewOptions
) {
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(Boolean(entry?.isIntersecting));
      },
      {
        rootMargin: options?.rootMargin ?? "200px",
        threshold: options?.threshold ?? 0.01,
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, options?.rootMargin, options?.threshold]);

  return isInView;
}
