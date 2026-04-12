export function isHierarchyNodeVisible(
  nsfwMode: string | undefined,
  isNsfw: boolean,
  visibleSfwCount?: number | null,
): boolean {
  if (nsfwMode !== "off") return true;
  if (isNsfw) return false;
  if (typeof visibleSfwCount === "number") return visibleSfwCount > 0;
  return true;
}
