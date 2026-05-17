using Obscura.Domain.Entities;

namespace Obscura.Infrastructure.Legacy;

/// <summary>
/// Provides gallery SQL fragments for the legacy non-video media preview import.
/// </summary>
public static partial class LegacyMediaImportSql
{
    private static readonly string GalleriesImport = $$"""
            IF to_regclass('public.galleries') IS NOT NULL THEN
                INSERT INTO v2.entities (id, kind_code, title, created_at, updated_at)
                SELECT id, '{{EntityKindRegistry.Gallery.Code}}', title, created_at, updated_at
                FROM public.galleries
                ON CONFLICT (id) DO UPDATE SET
                    kind_code = EXCLUDED.kind_code,
                    title = EXCLUDED.title,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_flags (entity_id, is_favorite, is_nsfw, is_organized, updated_at)
                SELECT id, false, is_nsfw, organized, updated_at
                FROM public.galleries
                ON CONFLICT (entity_id) DO UPDATE SET
                    is_favorite = EXCLUDED.is_favorite,
                    is_nsfw = EXCLUDED.is_nsfw,
                    is_organized = EXCLUDED.is_organized,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_ratings (entity_id, value, updated_at)
                SELECT id, LEAST(GREATEST(rating, 0), 5), updated_at
                FROM public.galleries
                WHERE rating IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                SELECT gen_random_uuid(), id, 'source', COALESCE(folder_path, zip_file_path), NULL, NULL, created_at, updated_at
                FROM public.galleries
                WHERE COALESCE(folder_path, zip_file_path) IS NOT NULL
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_descriptions (entity_id, value, updated_at)
                SELECT id, details, updated_at
                FROM public.galleries
                WHERE details IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_dates (entity_id, code, value, sortable_value, precision, updated_at)
                SELECT id, 'gallery', date, NULL, NULL, updated_at
                FROM public.galleries
                WHERE date IS NOT NULL
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    sortable_value = EXCLUDED.sortable_value,
                    precision = EXCLUDED.precision,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_sources (entity_id, code, value, updated_at)
                SELECT gallery.id, source.code, source.value, gallery.updated_at
                FROM public.galleries gallery
                CROSS JOIN LATERAL (VALUES
                    ('folder', gallery.folder_path),
                    ('zip', gallery.zip_file_path)
                ) AS source(code, value)
                WHERE source.value IS NOT NULL
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_stats (entity_id, code, value, updated_at)
                SELECT id, 'images', GREATEST(image_count, 0), updated_at
                FROM public.galleries
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.gallery_details (
                    entity_id,
                    gallery_type,
                    cover_image_entity_id
                )
                SELECT id, gallery_type, cover_image_id
                FROM public.galleries
                ON CONFLICT (entity_id) DO UPDATE SET
                    gallery_type = EXCLUDED.gallery_type,
                    cover_image_entity_id = EXCLUDED.cover_image_entity_id;

                INSERT INTO v2.entity_relationship_links (entity_id, relationship_code, label, target_entity_id, target_kind_code, sort_order, created_at)
                SELECT id, 'studio', 'Studio', studio_id, '{{EntityKindRegistry.Studio.Code}}', 0, updated_at
                FROM public.galleries
                WHERE studio_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM v2.entities studio WHERE studio.id = studio_id AND studio.kind_code = '{{EntityKindRegistry.Studio.Code}}')
                ON CONFLICT (entity_id, relationship_code, target_entity_id) DO UPDATE SET
                    label = EXCLUDED.label,
                    target_kind_code = EXCLUDED.target_kind_code,
                    sort_order = EXCLUDED.sort_order;

                INSERT INTO v2.entity_child_links (parent_entity_id, child_entity_id, child_kind_code, sort_order, is_structural, source, created_at)
                SELECT parent_id, id, '{{EntityKindRegistry.Gallery.Code}}', 0, true, 'legacy-import', created_at
                FROM public.galleries
                WHERE parent_id IS NOT NULL
                ON CONFLICT (parent_entity_id, child_entity_id, child_kind_code) DO UPDATE SET
                    sort_order = EXCLUDED.sort_order,
                    is_structural = EXCLUDED.is_structural,
                    source = EXCLUDED.source;

                INSERT INTO v2.entity_urls (id, entity_id, url, label, sort_order, created_at)
                SELECT gen_random_uuid(), gallery.id, link.url, NULL, (link.sort_order - 1)::int, gallery.created_at
                FROM public.galleries gallery
                CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(gallery.urls, '[]'::jsonb)) WITH ORDINALITY AS link(url, sort_order)
                ON CONFLICT (entity_id, url) DO UPDATE SET
                    label = EXCLUDED.label,
                    sort_order = EXCLUDED.sort_order;
            END IF;
        """;

    private static readonly string GalleryTagsImport = $$"""
            IF to_regclass('public.gallery_tags') IS NOT NULL THEN
                INSERT INTO v2.entity_relationship_links (entity_id, relationship_code, label, target_entity_id, target_kind_code, sort_order, created_at)
                SELECT gallery_id, 'tags', 'Tags', tag_id, '{{EntityKindRegistry.Tag.Code}}', 0, now()
                FROM public.gallery_tags
                WHERE EXISTS (SELECT 1 FROM v2.entities tag WHERE tag.id = tag_id AND tag.kind_code = '{{EntityKindRegistry.Tag.Code}}')
                ON CONFLICT (entity_id, relationship_code, target_entity_id) DO NOTHING;
            END IF;
        """;

    private static readonly string GalleryPerformersImport = $$"""
            IF to_regclass('public.gallery_performers') IS NOT NULL THEN
                INSERT INTO v2.entity_relationship_links (entity_id, relationship_code, label, target_entity_id, target_kind_code, sort_order, metadata_json, created_at)
                SELECT gallery_id, 'cast', 'Cast', performer_id, '{{EntityKindRegistry.Person.Code}}', 0, jsonb_build_object('role', '{{EntityKindRegistry.Person.Code}}'), now()
                FROM public.gallery_performers
                WHERE EXISTS (SELECT 1 FROM v2.entities person WHERE person.id = performer_id AND person.kind_code = '{{EntityKindRegistry.Person.Code}}')
                ON CONFLICT (entity_id, relationship_code, target_entity_id) DO NOTHING;
            END IF;
        """;
}
