interface EntityLike {
  id: string;
}

interface MergeUniquePageInput<T extends EntityLike> {
  current: readonly T[];
  incoming: readonly T[];
  loadedStart: number;
  total: number;
}

interface MergeUniquePageResult<T extends EntityLike> {
  items: T[];
  total: number;
  added: number;
}

export function mergeUniquePage<T extends EntityLike>({
  current,
  incoming,
  loadedStart,
  total,
}: MergeUniquePageInput<T>): MergeUniquePageResult<T> {
  const existing = new Set(current.map((item) => item.id));
  const next = incoming.filter((item) => !existing.has(item.id));
  const items = [...current, ...next];

  return {
    items,
    total: next.length === 0 ? loadedStart + current.length : total,
    added: next.length,
  };
}
