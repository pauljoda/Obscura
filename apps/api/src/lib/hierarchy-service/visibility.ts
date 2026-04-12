export function isHierarchyNodeVisible(
  nsfwMode: string | undefined,
  isNsfw: boolean,
  visibleSfwCount?: number | null,
  totalCount?: number | null,
): boolean {
  if (typeof totalCount === "number" && totalCount === 0) return false;
  if (nsfwMode !== "off") return true;
  if (isNsfw) return false;
  if (typeof visibleSfwCount === "number") return visibleSfwCount > 0;
  return true;
}
