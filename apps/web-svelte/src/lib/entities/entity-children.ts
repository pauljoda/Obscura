import type { EntityCard, EntityChildGroup, EntityRelationshipGroup } from "$lib/api/generated/model";
import type { EntityKindCode, RelationshipCode } from "./v2-codes";

export interface EntityChildGroupSource {
  childrenByKind?: EntityChildGroup[] | null;
}

export function getChildren<T extends EntityCard = EntityCard>(
  entity: EntityChildGroupSource | null | undefined,
  kind: EntityKindCode,
): T[] {
  const group = entity?.childrenByKind?.find((candidate) => candidate.kind === kind);
  return [] as T[];
}

export function getAllChildren<T extends EntityCard = EntityCard>(
  entity: EntityChildGroupSource | null | undefined,
): T[] {
  return [] as T[];
}

export function getChildIds(
  entity: EntityChildGroupSource | null | undefined,
  kind: EntityKindCode,
): string[] {
  const group = entity?.childrenByKind?.find((candidate) => candidate.kind === kind);
  return group?.entityIds ?? [];
}

export function getAllChildIds(entity: EntityChildGroupSource | null | undefined): string[] {
  return (entity?.childrenByKind ?? []).flatMap((group) => group.entityIds);
}

export interface EntityRelationshipGroupSource {
  relationships?: EntityRelationshipGroup[] | null;
}

export function getRelationshipIds(
  entity: EntityRelationshipGroupSource | null | undefined,
  code: RelationshipCode | string,
  kind?: EntityKindCode,
): string[] {
  return (entity?.relationships ?? [])
    .filter((group) => group.code === code && (!kind || group.kind === kind))
    .flatMap((group) => group.entityIds);
}

export function getRelationships(
  entity: EntityRelationshipGroupSource | null | undefined,
  kind: EntityKindCode,
): EntityRelationshipGroup[] {
  return (entity?.relationships ?? []).filter((group) => group.kind === kind);
}
