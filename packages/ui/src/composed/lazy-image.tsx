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
 *
 * Observes a wrapper div rather than the img itself so that the observer
 * target always has dimensions (an img without src can collapse to 0×0).
 */
export function LazyImage({
  src,
  rootMargin = "300px",
  className,
  style,
  ...imgProps
}: LazyImageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={wrapperRef} className={className} style={style}>
      {visible && src && (
        <img
          src={src}
          decoding="async"
          className="h-full w-full object-cover"
          {...imgProps}
        />
      )}
    </div>
  );
}
