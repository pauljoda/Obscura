"use client";

import { useEffect, useRef, useState } from "react";

interface LazyImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string;
  /** Extra margin around viewport to start loading before visible (default 300px) */
  rootMargin?: string;
}

/**
 * Image component that uses IntersectionObserver to preload images before
 * they enter the viewport, avoiding the browser's native `loading="lazy"`
 * behavior that pauses loads during active scrolling.
 */
export function LazyImage({
  src,
  rootMargin = "300px",
  ...props
}: LazyImageProps) {
  const ref = useRef<HTMLImageElement>(null);
  const [activeSrc, setActiveSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActiveSrc(src);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [src, rootMargin]);

  return (
    <img
      ref={ref}
      src={activeSrc}
      decoding="async"
      {...props}
    />
  );
}
