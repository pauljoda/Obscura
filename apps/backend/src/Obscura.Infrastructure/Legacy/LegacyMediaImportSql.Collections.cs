using Obscura.Domain.Entities;

namespace Obscura.Infrastructure.Legacy;

/// <summary>
/// Provides collection SQL fragments for the legacy non-video media preview import.
/// </summary>
public static partial class LegacyMediaImportSql
{
    private static readonly string CollectionsImport = $$"""
            IF to_regclass('public.collections') IS NOT NULL THEN
                INSERT INTO v2.entities (id, kind_code, title, created_at, updated_at)
                SELECT id, '{{EntityKindRegistry.Collection.Code}}', name, created_at, updated_at
                FROM public.collections
                ON CONFLICT (id) DO UPDATE SET
                    kind_code = EXCLUDED.kind_code,
                    title = EXCLUDED.title,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_flags (entity_id, is_favorite, is_nsfw, is_organized, updated_at)
                SELECT id, false, is_nsfw, true, updated_at
                FROM public.collections
                ON CONFLICT (entity_id) DO UPDATE SET
                    is_favorite = EXCLUDED.is_favorite,
                    is_nsfw = EXCLUDED.is_nsfw,
                    is_organized = EXCLUDED.is_organized,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_descriptions (entity_id, value, updated_at)
                SELECT id, description, updated_at
                FROM public.collections
                WHERE description IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_stats (entity_id, code, value, updated_at)
                SELECT id, 'items', GREATEST(item_count, 0), updated_at
                FROM public.collections
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.collection_details (
                    entity_id,
                    mode,
                    rule_tree_json,
                    cover_mode,
                    cover_item_entity_id,
                    slideshow_duration_seconds,
                    slideshow_auto_advance,
                    last_refreshed_at
                )
                SELECT
                    id,
                    mode,
                    rule_tree,
                    cover_mode,
                    cover_item_id,
                    slideshow_duration_seconds,
                    slideshow_auto_advance,
                    last_refreshed_at
                FROM public.collections
                ON CONFLICT (entity_id) DO UPDATE SET
                    mode = EXCLUDED.mode,
                    rule_tree_json = EXCLUDED.rule_tree_json,
                    cover_mode = EXCLUDED.cover_mode,
                    cover_item_entity_id = EXCLUDED.cover_item_entity_id,
                    slideshow_duration_seconds = EXCLUDED.slideshow_duration_seconds,
                    slideshow_auto_advance = EXCLUDED.slideshow_auto_advance,
                    last_refreshed_at = EXCLUDED.last_refreshed_at;
            END IF;
        """;

    private static readonly string CollectionItemsImport = $$"""
            IF to_regclass('public.collection_items') IS NOT NULL THEN
                INSERT INTO v2.entity_hierarchy_links (parent_entity_id, child_entity_id, relationship, sort_order, created_at)
                SELECT item.collection_id, item.entity_id, '{{EntityRelationshipRegistry.CollectionItem.Code}}', item.sort_order, item.added_at
                FROM public.collection_items item
                WHERE EXISTS (SELECT 1 FROM v2.entities collection WHERE collection.id = item.collection_id AND collection.kind_code = '{{EntityKindRegistry.Collection.Code}}')
                  AND EXISTS (SELECT 1 FROM v2.entities entity WHERE entity.id = item.entity_id)
                ON CONFLICT (parent_entity_id, child_entity_id, relationship) DO UPDATE SET
                    sort_order = EXCLUDED.sort_order;
            END IF;
        """;
}
