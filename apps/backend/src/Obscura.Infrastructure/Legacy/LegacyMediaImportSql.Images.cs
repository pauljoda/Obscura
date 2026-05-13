using Obscura.Domain.Entities;

namespace Obscura.Infrastructure.Legacy;

/// <summary>
/// Provides image SQL fragments for the legacy non-video media preview import.
/// </summary>
public static partial class LegacyMediaImportSql
{
    private static readonly string ImagesImport = $$"""
            IF to_regclass('public.images') IS NOT NULL THEN
                INSERT INTO v2.entities (id, kind_code, title, created_at, updated_at)
                SELECT id, '{{EntityKindRegistry.Image.Code}}', title, created_at, updated_at
                FROM public.images
                ON CONFLICT (id) DO UPDATE SET
                    kind_code = EXCLUDED.kind_code,
                    title = EXCLUDED.title,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_flags (entity_id, is_favorite, is_nsfw, is_organized, updated_at)
                SELECT id, false, is_nsfw, organized, updated_at
                FROM public.images
                ON CONFLICT (entity_id) DO UPDATE SET
                    is_favorite = EXCLUDED.is_favorite,
                    is_nsfw = EXCLUDED.is_nsfw,
                    is_organized = EXCLUDED.is_organized,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_ratings (entity_id, value, updated_at)
                SELECT id, LEAST(GREATEST(rating, 0), 5), updated_at
                FROM public.images
                WHERE rating IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                SELECT gen_random_uuid(), id, 'source', file_path, NULL, file_size::bigint, created_at, updated_at
                FROM public.images
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    size_bytes = EXCLUDED.size_bytes,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                SELECT gen_random_uuid(), id, 'thumbnail', COALESCE(thumbnail_path, file_path), NULL, NULL, created_at, updated_at
                FROM public.images
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_descriptions (entity_id, value, updated_at)
                SELECT id, details, updated_at
                FROM public.images
                WHERE details IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_dates (entity_id, code, value, sortable_value, precision, updated_at)
                SELECT id, 'captured', date, NULL, NULL, updated_at
                FROM public.images
                WHERE date IS NOT NULL
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    sortable_value = EXCLUDED.sortable_value,
                    precision = EXCLUDED.precision,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_technical (
                    entity_id,
                    duration_seconds,
                    width,
                    height,
                    frame_rate,
                    bit_rate,
                    sample_rate,
                    channels,
                    codec,
                    container,
                    format,
                    updated_at
                )
                SELECT id, NULL, width, height, NULL, NULL, NULL, NULL, NULL, NULL, format, updated_at
                FROM public.images
                WHERE width IS NOT NULL OR height IS NOT NULL OR format IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    duration_seconds = EXCLUDED.duration_seconds,
                    width = EXCLUDED.width,
                    height = EXCLUDED.height,
                    frame_rate = EXCLUDED.frame_rate,
                    bit_rate = EXCLUDED.bit_rate,
                    sample_rate = EXCLUDED.sample_rate,
                    channels = EXCLUDED.channels,
                    codec = EXCLUDED.codec,
                    container = EXCLUDED.container,
                    format = EXCLUDED.format,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_sources (entity_id, code, value, updated_at)
                SELECT id, 'file', file_path, updated_at
                FROM public.images
                WHERE file_path IS NOT NULL
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_positions (entity_id, code, value, label, updated_at)
                SELECT id, 'sort', sort_order, sort_order::text, updated_at
                FROM public.images
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    label = EXCLUDED.label,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_file_fingerprints (id, entity_id, entity_file_id, algorithm, value, created_at)
                SELECT gen_random_uuid(), image.id, NULL, hash.algorithm, hash.value, image.created_at
                FROM public.images image
                CROSS JOIN LATERAL (VALUES
                    ('md5', image.checksum_md5),
                    ('oshash', image.oshash)
                ) AS hash(algorithm, value)
                WHERE hash.value IS NOT NULL
                ON CONFLICT (entity_id, algorithm) DO UPDATE SET
                    value = EXCLUDED.value;

                INSERT INTO v2.image_details (
                    entity_id
                )
                SELECT id
                FROM public.images
                ON CONFLICT (entity_id) DO NOTHING;

                INSERT INTO v2.entity_studio_links (entity_id, studio_id, created_at)
                SELECT id, studio_id, updated_at
                FROM public.images
                WHERE studio_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM v2.entities studio WHERE studio.id = studio_id AND studio.kind_code = '{{EntityKindRegistry.Studio.Code}}')
                ON CONFLICT (entity_id) DO UPDATE SET
                    studio_id = EXCLUDED.studio_id;

                INSERT INTO v2.entity_hierarchy_links (parent_entity_id, child_entity_id, relationship, sort_order, created_at)
                SELECT gallery_id, id, '{{EntityRelationshipRegistry.Gallery.Code}}', sort_order, created_at
                FROM public.images
                WHERE gallery_id IS NOT NULL
                ON CONFLICT (parent_entity_id, child_entity_id, relationship) DO UPDATE SET
                    sort_order = EXCLUDED.sort_order;

                INSERT INTO v2.entity_urls (id, entity_id, url, label, sort_order, created_at)
                SELECT gen_random_uuid(), image.id, link.url, NULL, (link.sort_order - 1)::int, image.created_at
                FROM public.images image
                CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(image.urls, '[]'::jsonb)) WITH ORDINALITY AS link(url, sort_order)
                ON CONFLICT (entity_id, url) DO UPDATE SET
                    label = EXCLUDED.label,
                    sort_order = EXCLUDED.sort_order;
            END IF;
        """;

    private static readonly string ImageTagsImport = $$"""
            IF to_regclass('public.image_tags') IS NOT NULL THEN
                INSERT INTO v2.entity_tag_links (entity_id, tag_id, created_at)
                SELECT image_id, tag_id, now()
                FROM public.image_tags
                WHERE EXISTS (SELECT 1 FROM v2.entities tag WHERE tag.id = tag_id AND tag.kind_code = '{{EntityKindRegistry.Tag.Code}}')
                ON CONFLICT (entity_id, tag_id) DO NOTHING;
            END IF;
        """;

    private static readonly string ImagePerformersImport = $$"""
            IF to_regclass('public.image_performers') IS NOT NULL THEN
                INSERT INTO v2.entity_credit_links (entity_id, person_entity_id, role, character, sort_order, created_at)
                SELECT image_id, performer_id, '{{EntityKindRegistry.Person.Code}}', NULL, 0, now()
                FROM public.image_performers
                WHERE EXISTS (SELECT 1 FROM v2.entities person WHERE person.id = performer_id AND person.kind_code = '{{EntityKindRegistry.Person.Code}}')
                ON CONFLICT (entity_id, person_entity_id, role) DO NOTHING;
            END IF;
        """;
}
