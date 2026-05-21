interface ContainedScrollHeightInput {
  bottomPadding?: number;
  minHeight?: number;
  top: number;
  viewportHeight: number;
}

interface WheelScrollInput {
  clientHeight: number;
  deltaY: number;
  scrollHeight: number;
  scrollTop: number;
}

export function computeContainedScrollHeight({
  bottomPadding = 24,
  minHeight = 320,
  top,
  viewportHeight,
}: ContainedScrollHeightInput): string {
  const available = Math.floor(viewportHeight - top - bottomPadding);
  return `${Math.max(minHeight, available)}px`;
}

export function shouldContainWheelScroll({
  clientHeight,
  deltaY,
  scrollHeight,
  scrollTop,
}: WheelScrollInput): boolean {
  if (scrollHeight <= clientHeight) return false;
  const atTop = scrollTop <= 0;
  const atBottom = Math.ceil(scrollTop + clientHeight) >= scrollHeight;
  return (deltaY < 0 && atTop) || (deltaY > 0 && atBottom);
}
