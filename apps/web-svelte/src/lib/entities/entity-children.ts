import type { EntityCard, EntityChildGroup } from "$lib/api/generated/model";
import type { EntityKindCode } from "./v2-codes";

export interface EntityChildGroupSource {
  childrenByKind?: EntityChildGroup[] | null;
}

export function getChildren<T extends EntityCard = EntityCard>(
  entity: EntityChildGroupSource | null | undefined,
  kind: EntityKindCode,
): T[] {
  const group = entity?.childrenByKind?.find((candidate) => candidate.kind === kind);
  return (group?.items ?? []) as T[];
}

export function getAllChildren<T extends EntityCard = EntityCard>(
  entity: EntityChildGroupSource | null | undefined,
): T[] {
  return (entity?.childrenByKind ?? []).flatMap((group) => group.items) as T[];
}
