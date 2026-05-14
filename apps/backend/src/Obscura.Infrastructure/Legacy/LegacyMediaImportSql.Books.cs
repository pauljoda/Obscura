using Obscura.Domain.Entities;

namespace Obscura.Infrastructure.Legacy;

/// <summary>
/// Provides book and reading-progress SQL fragments for the legacy non-video media preview import.
/// </summary>
public static partial class LegacyMediaImportSql
{
    private static readonly string BooksImport = $$"""
            IF to_regclass('public.books') IS NOT NULL THEN
                INSERT INTO v2.entities (id, kind_code, title, created_at, updated_at)
                SELECT id, '{{EntityKindRegistry.Book.Code}}', title, created_at, updated_at
                FROM public.books
                ON CONFLICT (id) DO UPDATE SET
                    kind_code = EXCLUDED.kind_code,
                    title = EXCLUDED.title,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_flags (entity_id, is_favorite, is_nsfw, is_organized, updated_at)
                SELECT id, false, is_nsfw, organized, updated_at
                FROM public.books
                ON CONFLICT (entity_id) DO UPDATE SET
                    is_favorite = EXCLUDED.is_favorite,
                    is_nsfw = EXCLUDED.is_nsfw,
                    is_organized = EXCLUDED.is_organized,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_ratings (entity_id, value, updated_at)
                SELECT id, LEAST(GREATEST(rating, 0), 5), updated_at
                FROM public.books
                WHERE rating IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                SELECT gen_random_uuid(), id, 'source', folder_path, NULL, NULL, created_at, updated_at
                FROM public.books
                WHERE folder_path IS NOT NULL
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                SELECT gen_random_uuid(), id, 'thumbnail', cover_image_path, NULL, NULL, created_at, updated_at
                FROM public.books
                WHERE cover_image_path IS NOT NULL
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_descriptions (entity_id, value, updated_at)
                SELECT id, details, updated_at
                FROM public.books
                WHERE details IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_dates (entity_id, code, value, sortable_value, precision, updated_at)
                SELECT id, 'book', date, NULL, NULL, updated_at
                FROM public.books
                WHERE date IS NOT NULL
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    sortable_value = EXCLUDED.sortable_value,
                    precision = EXCLUDED.precision,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_sources (entity_id, code, value, updated_at)
                SELECT book.id, source.code, source.value, book.updated_at
                FROM public.books book
                CROSS JOIN LATERAL (VALUES
                    ('library-root', book.library_root_id::text),
                    ('folder', book.folder_path),
                    ('relative', book.relative_path)
                ) AS source(code, value)
                WHERE source.value IS NOT NULL
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_stats (entity_id, code, value, updated_at)
                SELECT book.id, stat.code, GREATEST(stat.value, 0), book.updated_at
                FROM public.books book
                CROSS JOIN LATERAL (VALUES
                    ('pages', book.page_count),
                    ('chapters', book.chapter_count)
                ) AS stat(code, value)
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.book_details (
                    entity_id,
                    book_type,
                    cover_page_entity_id
                )
                SELECT
                    id,
                    book_type,
                    CASE WHEN EXISTS (SELECT 1 FROM v2.entities pg WHERE pg.id = cover_page_id) THEN cover_page_id END
                FROM public.books
                ON CONFLICT (entity_id) DO UPDATE SET
                    book_type = EXCLUDED.book_type,
                    cover_page_entity_id = EXCLUDED.cover_page_entity_id;

                INSERT INTO v2.entity_studio_links (entity_id, studio_id, created_at)
                SELECT id, studio_id, updated_at
                FROM public.books
                WHERE studio_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM v2.entities studio WHERE studio.id = studio_id AND studio.kind_code = '{{EntityKindRegistry.Studio.Code}}')
                ON CONFLICT (entity_id) DO UPDATE SET
                    studio_id = EXCLUDED.studio_id;

                INSERT INTO v2.entity_urls (id, entity_id, url, label, sort_order, created_at)
                SELECT gen_random_uuid(), book.id, link.url, NULL, (link.sort_order - 1)::int, book.created_at
                FROM public.books book
                CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(book.urls, '[]'::jsonb)) WITH ORDINALITY AS link(url, sort_order)
                ON CONFLICT (entity_id, url) DO UPDATE SET
                    label = EXCLUDED.label,
                    sort_order = EXCLUDED.sort_order;

                INSERT INTO v2.entity_external_ids (id, entity_id, provider, value, url, created_at, updated_at)
                SELECT gen_random_uuid(), book.id, external.key, external.value, NULL, book.created_at, book.updated_at
                FROM public.books book
                CROSS JOIN LATERAL jsonb_each_text(COALESCE(book.external_ids, '{}'::jsonb)) AS external(key, value)
                ON CONFLICT (entity_id, provider) DO UPDATE SET
                    value = EXCLUDED.value,
                    url = EXCLUDED.url,
                    updated_at = EXCLUDED.updated_at;
            END IF;
        """;

    private static readonly string BookReadProgressImport = $$"""
            IF to_regclass('public.book_read_progress') IS NOT NULL THEN
                INSERT INTO v2.entity_progress (
                    entity_id,
                    current_entity_id,
                    unit,
                    index,
                    total,
                    mode,
                    completed_at,
                    updated_at
                )
                SELECT
                    book_id,
                    CASE WHEN EXISTS (SELECT 1 FROM v2.entities ch WHERE ch.id = chapter_id) THEN chapter_id END,
                    'page', page_index, page_count, reader_mode, completed_at, updated_at
                FROM public.book_read_progress
                WHERE EXISTS (SELECT 1 FROM v2.entities entity WHERE entity.id = book_id AND entity.kind_code = '{{EntityKindRegistry.Book.Code}}')
                ON CONFLICT (entity_id) DO UPDATE SET
                    current_entity_id = EXCLUDED.current_entity_id,
                    unit = EXCLUDED.unit,
                    index = EXCLUDED.index,
                    total = EXCLUDED.total,
                    mode = EXCLUDED.mode,
                    completed_at = EXCLUDED.completed_at,
                    updated_at = EXCLUDED.updated_at;
            END IF;
        """;

    private static readonly string BookTagsImport = $$"""
            IF to_regclass('public.book_tags') IS NOT NULL THEN
                INSERT INTO v2.entity_tag_links (entity_id, tag_id, created_at)
                SELECT book_id, tag_id, now()
                FROM public.book_tags
                WHERE EXISTS (SELECT 1 FROM v2.entities tag WHERE tag.id = tag_id AND tag.kind_code = '{{EntityKindRegistry.Tag.Code}}')
                ON CONFLICT (entity_id, tag_id) DO NOTHING;
            END IF;
        """;

    private static readonly string BookPerformersImport = $$"""
            IF to_regclass('public.book_performers') IS NOT NULL THEN
                INSERT INTO v2.entity_credit_links (entity_id, person_entity_id, role, character, sort_order, created_at)
                SELECT book_id, performer_id, '{{EntityKindRegistry.Person.Code}}', NULL, 0, now()
                FROM public.book_performers
                WHERE EXISTS (SELECT 1 FROM v2.entities person WHERE person.id = performer_id AND person.kind_code = '{{EntityKindRegistry.Person.Code}}')
                ON CONFLICT (entity_id, person_entity_id, role) DO NOTHING;
            END IF;
        """;
}
