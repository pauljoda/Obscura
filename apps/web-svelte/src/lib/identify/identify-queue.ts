export function filterIdentifyQueueItems<T extends { organized?: boolean }>(
  items: T[],
  showAll: boolean,
): T[] {
  return showAll ? items : items.filter((item) => !item.organized);
}
