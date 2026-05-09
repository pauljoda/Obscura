interface ScrubBounds {
  left: number;
  width: number;
}

export function scrubIndexFromClientX(
  clientX: number,
  bounds: ScrubBounds,
  previewCount: number,
) {
  if (previewCount <= 0 || bounds.width <= 0) return 0;
  const ratio = (clientX - bounds.left) / bounds.width;
  return Math.min(
    previewCount - 1,
    Math.max(0, Math.floor(ratio * previewCount)),
  );
}
