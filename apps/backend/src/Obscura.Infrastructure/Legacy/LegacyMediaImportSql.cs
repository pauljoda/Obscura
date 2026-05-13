using Obscura.Domain.Entities;

namespace Obscura.Infrastructure.Legacy;

public static class LegacyMediaImportSql
{
    public static readonly string Import = $$"""
        DO $$
        BEGIN
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

                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                SELECT gen_random_uuid(), id, 'thumbnail', cover_image_path, NULL, NULL, created_at, updated_at
                FROM public.collections
                WHERE cover_image_path IS NOT NULL
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
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
                    description,
                    mode,
                    rule_tree_json,
                    item_count,
                    cover_mode,
                    cover_image_path,
                    cover_item_entity_id,
                    slideshow_duration_seconds,
                    slideshow_auto_advance,
                    last_refreshed_at
                )
                SELECT
                    id,
                    description,
                    mode,
                    rule_tree::text,
                    item_count,
                    cover_mode,
                    cover_image_path,
                    cover_item_id,
                    slideshow_duration_seconds,
                    slideshow_auto_advance,
                    last_refreshed_at
                FROM public.collections
                ON CONFLICT (entity_id) DO UPDATE SET
                    description = EXCLUDED.description,
                    mode = EXCLUDED.mode,
                    rule_tree_json = EXCLUDED.rule_tree_json,
                    item_count = EXCLUDED.item_count,
                    cover_mode = EXCLUDED.cover_mode,
                    cover_image_path = EXCLUDED.cover_image_path,
                    cover_item_entity_id = EXCLUDED.cover_item_entity_id,
                    slideshow_duration_seconds = EXCLUDED.slideshow_duration_seconds,
                    slideshow_auto_advance = EXCLUDED.slideshow_auto_advance,
                    last_refreshed_at = EXCLUDED.last_refreshed_at;
            END IF;

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
                    details,
                    date,
                    gallery_type,
                    folder_path,
                    zip_file_path,
                    cover_image_entity_id,
                    image_count
                )
                SELECT id, details, date, gallery_type, folder_path, zip_file_path, cover_image_id, image_count
                FROM public.galleries
                ON CONFLICT (entity_id) DO UPDATE SET
                    details = EXCLUDED.details,
                    date = EXCLUDED.date,
                    gallery_type = EXCLUDED.gallery_type,
                    folder_path = EXCLUDED.folder_path,
                    zip_file_path = EXCLUDED.zip_file_path,
                    cover_image_entity_id = EXCLUDED.cover_image_entity_id,
                    image_count = EXCLUDED.image_count;

                INSERT INTO v2.entity_studio_links (entity_id, studio_id, created_at)
                SELECT id, studio_id, updated_at
                FROM public.galleries
                WHERE studio_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM v2.entities studio WHERE studio.id = studio_id AND studio.kind_code = '{{EntityKindRegistry.Studio.Code}}')
                ON CONFLICT (entity_id) DO UPDATE SET
                    studio_id = EXCLUDED.studio_id;

                INSERT INTO v2.entity_hierarchy_links (parent_entity_id, child_entity_id, relationship, sort_order, created_at)
                SELECT parent_id, id, '{{EntityRelationshipRegistry.Gallery.Code}}', 0, created_at
                FROM public.galleries
                WHERE parent_id IS NOT NULL
                ON CONFLICT (parent_entity_id, child_entity_id, relationship) DO UPDATE SET
                    sort_order = EXCLUDED.sort_order;

                INSERT INTO v2.entity_urls (id, entity_id, url, label, sort_order, created_at)
                SELECT gen_random_uuid(), gallery.id, link.url, NULL, (link.sort_order - 1)::int, gallery.created_at
                FROM public.galleries gallery
                CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(gallery.urls, '[]'::jsonb)) WITH ORDINALITY AS link(url, sort_order)
                ON CONFLICT (entity_id, url) DO UPDATE SET
                    label = EXCLUDED.label,
                    sort_order = EXCLUDED.sort_order;
            END IF;

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
                    entity_id,
                    details,
                    date,
                    file_path,
                    file_size_bytes,
                    width,
                    height,
                    format,
                    sort_order
                )
                SELECT id, details, date, file_path, file_size::bigint, width, height, format, sort_order
                FROM public.images
                ON CONFLICT (entity_id) DO UPDATE SET
                    details = EXCLUDED.details,
                    date = EXCLUDED.date,
                    file_path = EXCLUDED.file_path,
                    file_size_bytes = EXCLUDED.file_size_bytes,
                    width = EXCLUDED.width,
                    height = EXCLUDED.height,
                    format = EXCLUDED.format,
                    sort_order = EXCLUDED.sort_order;

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
                    library_root_id,
                    book_type,
                    sort_title,
                    summary,
                    date,
                    folder_path,
                    relative_path,
                    cover_page_entity_id,
                    cover_image_path,
                    page_count,
                    chapter_count
                )
                SELECT
                    id,
                    library_root_id,
                    book_type,
                    sort_title,
                    details,
                    date,
                    folder_path,
                    relative_path,
                    cover_page_id,
                    cover_image_path,
                    page_count,
                    chapter_count
                FROM public.books
                ON CONFLICT (entity_id) DO UPDATE SET
                    library_root_id = EXCLUDED.library_root_id,
                    book_type = EXCLUDED.book_type,
                    sort_title = EXCLUDED.sort_title,
                    summary = EXCLUDED.summary,
                    date = EXCLUDED.date,
                    folder_path = EXCLUDED.folder_path,
                    relative_path = EXCLUDED.relative_path,
                    cover_page_entity_id = EXCLUDED.cover_page_entity_id,
                    cover_image_path = EXCLUDED.cover_image_path,
                    page_count = EXCLUDED.page_count,
                    chapter_count = EXCLUDED.chapter_count;

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

            IF to_regclass('public.book_read_progress') IS NOT NULL THEN
                INSERT INTO v2.book_read_progress (
                    book_entity_id,
                    chapter_entity_id,
                    page_index,
                    page_count,
                    reader_mode,
                    completed_at,
                    updated_at
                )
                SELECT book_id, chapter_id, page_index, page_count, reader_mode, completed_at, updated_at
                FROM public.book_read_progress
                WHERE EXISTS (SELECT 1 FROM v2.entities entity WHERE entity.id = book_id AND entity.kind_code = '{{EntityKindRegistry.Book.Code}}')
                ON CONFLICT (book_entity_id) DO UPDATE SET
                    chapter_entity_id = EXCLUDED.chapter_entity_id,
                    page_index = EXCLUDED.page_index,
                    page_count = EXCLUDED.page_count,
                    reader_mode = EXCLUDED.reader_mode,
                    completed_at = EXCLUDED.completed_at,
                    updated_at = EXCLUDED.updated_at;

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
                SELECT book_id, chapter_id, 'page', page_index, page_count, reader_mode, completed_at, updated_at
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

            IF to_regclass('public.audio_libraries') IS NOT NULL THEN
                INSERT INTO v2.entities (id, kind_code, title, created_at, updated_at)
                SELECT id, '{{EntityKindRegistry.AudioLibrary.Code}}', title, created_at, updated_at
                FROM public.audio_libraries
                ON CONFLICT (id) DO UPDATE SET
                    kind_code = EXCLUDED.kind_code,
                    title = EXCLUDED.title,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_flags (entity_id, is_favorite, is_nsfw, is_organized, updated_at)
                SELECT id, false, is_nsfw, organized, updated_at
                FROM public.audio_libraries
                ON CONFLICT (entity_id) DO UPDATE SET
                    is_favorite = EXCLUDED.is_favorite,
                    is_nsfw = EXCLUDED.is_nsfw,
                    is_organized = EXCLUDED.is_organized,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_ratings (entity_id, value, updated_at)
                SELECT id, LEAST(GREATEST(rating, 0), 5), updated_at
                FROM public.audio_libraries
                WHERE rating IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                SELECT gen_random_uuid(), id, 'source', folder_path, NULL, NULL, created_at, updated_at
                FROM public.audio_libraries
                WHERE folder_path IS NOT NULL
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                SELECT gen_random_uuid(), id, 'cover', COALESCE(cover_image_path, icon_path), NULL, NULL, created_at, updated_at
                FROM public.audio_libraries
                WHERE COALESCE(cover_image_path, icon_path) IS NOT NULL
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_descriptions (entity_id, value, updated_at)
                SELECT id, details, updated_at
                FROM public.audio_libraries
                WHERE details IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_dates (entity_id, code, value, sortable_value, precision, updated_at)
                SELECT id, 'audio-library', date, NULL, NULL, updated_at
                FROM public.audio_libraries
                WHERE date IS NOT NULL
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    sortable_value = EXCLUDED.sortable_value,
                    precision = EXCLUDED.precision,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_sources (entity_id, code, value, updated_at)
                SELECT id, 'folder', folder_path, updated_at
                FROM public.audio_libraries
                WHERE folder_path IS NOT NULL
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_stats (entity_id, code, value, updated_at)
                SELECT id, 'tracks', GREATEST(track_count, 0), updated_at
                FROM public.audio_libraries
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.audio_library_details (
                    entity_id,
                    details,
                    date,
                    folder_path,
                    parent_library_entity_id,
                    track_count
                )
                SELECT id, details, date, folder_path, parent_id, track_count
                FROM public.audio_libraries
                ON CONFLICT (entity_id) DO UPDATE SET
                    details = EXCLUDED.details,
                    date = EXCLUDED.date,
                    folder_path = EXCLUDED.folder_path,
                    parent_library_entity_id = EXCLUDED.parent_library_entity_id,
                    track_count = EXCLUDED.track_count;

                INSERT INTO v2.entity_studio_links (entity_id, studio_id, created_at)
                SELECT id, studio_id, updated_at
                FROM public.audio_libraries
                WHERE studio_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM v2.entities studio WHERE studio.id = studio_id AND studio.kind_code = '{{EntityKindRegistry.Studio.Code}}')
                ON CONFLICT (entity_id) DO UPDATE SET
                    studio_id = EXCLUDED.studio_id;

                INSERT INTO v2.entity_hierarchy_links (parent_entity_id, child_entity_id, relationship, sort_order, created_at)
                SELECT parent_id, id, '{{EntityRelationshipRegistry.AudioLibrary.Code}}', 0, created_at
                FROM public.audio_libraries
                WHERE parent_id IS NOT NULL
                ON CONFLICT (parent_entity_id, child_entity_id, relationship) DO UPDATE SET
                    sort_order = EXCLUDED.sort_order;

                INSERT INTO v2.entity_urls (id, entity_id, url, label, sort_order, created_at)
                SELECT gen_random_uuid(), library.id, link.url, NULL, (link.sort_order - 1)::int, library.created_at
                FROM public.audio_libraries library
                CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(library.urls, '[]'::jsonb)) WITH ORDINALITY AS link(url, sort_order)
                ON CONFLICT (entity_id, url) DO UPDATE SET
                    label = EXCLUDED.label,
                    sort_order = EXCLUDED.sort_order;
            END IF;

            IF to_regclass('public.audio_tracks') IS NOT NULL THEN
                INSERT INTO v2.entities (id, kind_code, title, created_at, updated_at)
                SELECT id, '{{EntityKindRegistry.AudioTrack.Code}}', title, created_at, updated_at
                FROM public.audio_tracks
                ON CONFLICT (id) DO UPDATE SET
                    kind_code = EXCLUDED.kind_code,
                    title = EXCLUDED.title,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_flags (entity_id, is_favorite, is_nsfw, is_organized, updated_at)
                SELECT id, false, is_nsfw, organized, updated_at
                FROM public.audio_tracks
                ON CONFLICT (entity_id) DO UPDATE SET
                    is_favorite = EXCLUDED.is_favorite,
                    is_nsfw = EXCLUDED.is_nsfw,
                    is_organized = EXCLUDED.is_organized,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_ratings (entity_id, value, updated_at)
                SELECT id, LEAST(GREATEST(rating, 0), 5), updated_at
                FROM public.audio_tracks
                WHERE rating IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                SELECT gen_random_uuid(), id, 'source', file_path, NULL, file_size::bigint, created_at, updated_at
                FROM public.audio_tracks
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    size_bytes = EXCLUDED.size_bytes,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                SELECT gen_random_uuid(), id, 'waveform', waveform_path, 'application/json', NULL, created_at, updated_at
                FROM public.audio_tracks
                WHERE waveform_path IS NOT NULL
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    mime_type = EXCLUDED.mime_type,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_descriptions (entity_id, value, updated_at)
                SELECT id, details, updated_at
                FROM public.audio_tracks
                WHERE details IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_dates (entity_id, code, value, sortable_value, precision, updated_at)
                SELECT id, 'audio-track', date, NULL, NULL, updated_at
                FROM public.audio_tracks
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
                SELECT id, duration, NULL, NULL, NULL, bit_rate, sample_rate, channels, codec, container, NULL, updated_at
                FROM public.audio_tracks
                WHERE duration IS NOT NULL
                   OR bit_rate IS NOT NULL
                   OR sample_rate IS NOT NULL
                   OR channels IS NOT NULL
                   OR codec IS NOT NULL
                   OR container IS NOT NULL
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
                FROM public.audio_tracks
                WHERE file_path IS NOT NULL
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_positions (entity_id, code, value, label, updated_at)
                SELECT id, 'track', track_number, track_number::text, updated_at
                FROM public.audio_tracks
                WHERE track_number IS NOT NULL
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    label = EXCLUDED.label,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_file_fingerprints (id, entity_id, entity_file_id, algorithm, value, created_at)
                SELECT gen_random_uuid(), track.id, NULL, hash.algorithm, hash.value, track.created_at
                FROM public.audio_tracks track
                CROSS JOIN LATERAL (VALUES
                    ('md5', track.checksum_md5),
                    ('oshash', track.oshash)
                ) AS hash(algorithm, value)
                WHERE hash.value IS NOT NULL
                ON CONFLICT (entity_id, algorithm) DO UPDATE SET
                    value = EXCLUDED.value;

                INSERT INTO v2.entity_playback (entity_id, play_count, play_duration_seconds, resume_seconds, last_played_at, completed_at, updated_at)
                SELECT id, play_count, play_duration, resume_time, last_played_at, NULL, updated_at
                FROM public.audio_tracks
                WHERE play_count > 0 OR play_duration > 0 OR resume_time > 0 OR last_played_at IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    play_count = EXCLUDED.play_count,
                    play_duration_seconds = EXCLUDED.play_duration_seconds,
                    resume_seconds = EXCLUDED.resume_seconds,
                    last_played_at = EXCLUDED.last_played_at,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.audio_track_details (
                    entity_id,
                    details,
                    date,
                    duration_seconds,
                    bit_rate,
                    sample_rate,
                    channels,
                    codec,
                    container,
                    embedded_artist,
                    embedded_album,
                    track_number,
                    waveform_path
                )
                SELECT
                    id,
                    details,
                    date,
                    duration,
                    bit_rate,
                    sample_rate,
                    channels,
                    codec,
                    container,
                    embedded_artist,
                    embedded_album,
                    track_number,
                    waveform_path
                FROM public.audio_tracks
                ON CONFLICT (entity_id) DO UPDATE SET
                    details = EXCLUDED.details,
                    date = EXCLUDED.date,
                    duration_seconds = EXCLUDED.duration_seconds,
                    bit_rate = EXCLUDED.bit_rate,
                    sample_rate = EXCLUDED.sample_rate,
                    channels = EXCLUDED.channels,
                    codec = EXCLUDED.codec,
                    container = EXCLUDED.container,
                    embedded_artist = EXCLUDED.embedded_artist,
                    embedded_album = EXCLUDED.embedded_album,
                    track_number = EXCLUDED.track_number,
                    waveform_path = EXCLUDED.waveform_path;

                INSERT INTO v2.entity_studio_links (entity_id, studio_id, created_at)
                SELECT id, studio_id, updated_at
                FROM public.audio_tracks
                WHERE studio_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM v2.entities studio WHERE studio.id = studio_id AND studio.kind_code = '{{EntityKindRegistry.Studio.Code}}')
                ON CONFLICT (entity_id) DO UPDATE SET
                    studio_id = EXCLUDED.studio_id;

                INSERT INTO v2.entity_hierarchy_links (parent_entity_id, child_entity_id, relationship, sort_order, created_at)
                SELECT library_id, id, '{{EntityRelationshipRegistry.AudioLibrary.Code}}', sort_order, created_at
                FROM public.audio_tracks
                WHERE library_id IS NOT NULL
                ON CONFLICT (parent_entity_id, child_entity_id, relationship) DO UPDATE SET
                    sort_order = EXCLUDED.sort_order;

                INSERT INTO v2.entity_urls (id, entity_id, url, label, sort_order, created_at)
                SELECT gen_random_uuid(), track.id, link.url, NULL, (link.sort_order - 1)::int, track.created_at
                FROM public.audio_tracks track
                CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(track.urls, '[]'::jsonb)) WITH ORDINALITY AS link(url, sort_order)
                ON CONFLICT (entity_id, url) DO UPDATE SET
                    label = EXCLUDED.label,
                    sort_order = EXCLUDED.sort_order;
            END IF;

            IF to_regclass('public.external_ids') IS NOT NULL THEN
                INSERT INTO v2.entity_external_ids (id, entity_id, provider, value, url, created_at, updated_at)
                SELECT gen_random_uuid(), external.entity_id, external.provider, external.external_id, external.external_url, external.created_at, external.created_at
                FROM public.external_ids external
                WHERE EXISTS (SELECT 1 FROM v2.entities entity WHERE entity.id = external.entity_id)
                ON CONFLICT (entity_id, provider) DO UPDATE SET
                    value = EXCLUDED.value,
                    url = EXCLUDED.url,
                    updated_at = EXCLUDED.updated_at;
            END IF;

            IF to_regclass('public.collection_items') IS NOT NULL THEN
                INSERT INTO v2.entity_hierarchy_links (parent_entity_id, child_entity_id, relationship, sort_order, created_at)
                SELECT item.collection_id, item.entity_id, '{{EntityRelationshipRegistry.CollectionItem.Code}}', item.sort_order, item.added_at
                FROM public.collection_items item
                WHERE EXISTS (SELECT 1 FROM v2.entities collection WHERE collection.id = item.collection_id AND collection.kind_code = '{{EntityKindRegistry.Collection.Code}}')
                  AND EXISTS (SELECT 1 FROM v2.entities entity WHERE entity.id = item.entity_id)
                ON CONFLICT (parent_entity_id, child_entity_id, relationship) DO UPDATE SET
                    sort_order = EXCLUDED.sort_order;
            END IF;

            IF to_regclass('public.audio_track_markers') IS NOT NULL THEN
                INSERT INTO v2.entity_markers (id, entity_id, title, seconds, end_seconds, created_at, updated_at)
                SELECT marker.id, marker.track_id, marker.title, marker.seconds, marker.end_seconds, marker.created_at, marker.updated_at
                FROM public.audio_track_markers marker
                WHERE EXISTS (SELECT 1 FROM v2.entities entity WHERE entity.id = marker.track_id AND entity.kind_code = '{{EntityKindRegistry.AudioTrack.Code}}')
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    seconds = EXCLUDED.seconds,
                    end_seconds = EXCLUDED.end_seconds,
                    updated_at = EXCLUDED.updated_at;
            END IF;

            IF to_regclass('public.gallery_tags') IS NOT NULL THEN
                INSERT INTO v2.entity_tag_links (entity_id, tag_id, created_at)
                SELECT gallery_id, tag_id, now()
                FROM public.gallery_tags
                WHERE EXISTS (SELECT 1 FROM v2.entities tag WHERE tag.id = tag_id AND tag.kind_code = '{{EntityKindRegistry.Tag.Code}}')
                ON CONFLICT (entity_id, tag_id) DO NOTHING;
            END IF;

            IF to_regclass('public.image_tags') IS NOT NULL THEN
                INSERT INTO v2.entity_tag_links (entity_id, tag_id, created_at)
                SELECT image_id, tag_id, now()
                FROM public.image_tags
                WHERE EXISTS (SELECT 1 FROM v2.entities tag WHERE tag.id = tag_id AND tag.kind_code = '{{EntityKindRegistry.Tag.Code}}')
                ON CONFLICT (entity_id, tag_id) DO NOTHING;
            END IF;

            IF to_regclass('public.book_tags') IS NOT NULL THEN
                INSERT INTO v2.entity_tag_links (entity_id, tag_id, created_at)
                SELECT book_id, tag_id, now()
                FROM public.book_tags
                WHERE EXISTS (SELECT 1 FROM v2.entities tag WHERE tag.id = tag_id AND tag.kind_code = '{{EntityKindRegistry.Tag.Code}}')
                ON CONFLICT (entity_id, tag_id) DO NOTHING;
            END IF;

            IF to_regclass('public.audio_library_tags') IS NOT NULL THEN
                INSERT INTO v2.entity_tag_links (entity_id, tag_id, created_at)
                SELECT library_id, tag_id, now()
                FROM public.audio_library_tags
                WHERE EXISTS (SELECT 1 FROM v2.entities tag WHERE tag.id = tag_id AND tag.kind_code = '{{EntityKindRegistry.Tag.Code}}')
                ON CONFLICT (entity_id, tag_id) DO NOTHING;
            END IF;

            IF to_regclass('public.audio_track_tags') IS NOT NULL THEN
                INSERT INTO v2.entity_tag_links (entity_id, tag_id, created_at)
                SELECT track_id, tag_id, now()
                FROM public.audio_track_tags
                WHERE EXISTS (SELECT 1 FROM v2.entities tag WHERE tag.id = tag_id AND tag.kind_code = '{{EntityKindRegistry.Tag.Code}}')
                ON CONFLICT (entity_id, tag_id) DO NOTHING;
            END IF;

            IF to_regclass('public.gallery_performers') IS NOT NULL THEN
                INSERT INTO v2.entity_credit_links (entity_id, person_entity_id, role, character, sort_order, created_at)
                SELECT gallery_id, performer_id, '{{EntityKindRegistry.Person.Code}}', NULL, 0, now()
                FROM public.gallery_performers
                WHERE EXISTS (SELECT 1 FROM v2.entities person WHERE person.id = performer_id AND person.kind_code = '{{EntityKindRegistry.Person.Code}}')
                ON CONFLICT (entity_id, person_entity_id, role) DO NOTHING;
            END IF;

            IF to_regclass('public.image_performers') IS NOT NULL THEN
                INSERT INTO v2.entity_credit_links (entity_id, person_entity_id, role, character, sort_order, created_at)
                SELECT image_id, performer_id, '{{EntityKindRegistry.Person.Code}}', NULL, 0, now()
                FROM public.image_performers
                WHERE EXISTS (SELECT 1 FROM v2.entities person WHERE person.id = performer_id AND person.kind_code = '{{EntityKindRegistry.Person.Code}}')
                ON CONFLICT (entity_id, person_entity_id, role) DO NOTHING;
            END IF;

            IF to_regclass('public.book_performers') IS NOT NULL THEN
                INSERT INTO v2.entity_credit_links (entity_id, person_entity_id, role, character, sort_order, created_at)
                SELECT book_id, performer_id, '{{EntityKindRegistry.Person.Code}}', NULL, 0, now()
                FROM public.book_performers
                WHERE EXISTS (SELECT 1 FROM v2.entities person WHERE person.id = performer_id AND person.kind_code = '{{EntityKindRegistry.Person.Code}}')
                ON CONFLICT (entity_id, person_entity_id, role) DO NOTHING;
            END IF;

            IF to_regclass('public.audio_library_performers') IS NOT NULL THEN
                INSERT INTO v2.entity_credit_links (entity_id, person_entity_id, role, character, sort_order, created_at)
                SELECT library_id, performer_id, '{{EntityKindRegistry.Person.Code}}', NULL, 0, now()
                FROM public.audio_library_performers
                WHERE EXISTS (SELECT 1 FROM v2.entities person WHERE person.id = performer_id AND person.kind_code = '{{EntityKindRegistry.Person.Code}}')
                ON CONFLICT (entity_id, person_entity_id, role) DO NOTHING;
            END IF;

            IF to_regclass('public.audio_track_performers') IS NOT NULL THEN
                INSERT INTO v2.entity_credit_links (entity_id, person_entity_id, role, character, sort_order, created_at)
                SELECT track_id, performer_id, '{{EntityKindRegistry.Person.Code}}', NULL, 0, now()
                FROM public.audio_track_performers
                WHERE EXISTS (SELECT 1 FROM v2.entities person WHERE person.id = performer_id AND person.kind_code = '{{EntityKindRegistry.Person.Code}}')
                ON CONFLICT (entity_id, person_entity_id, role) DO NOTHING;
            END IF;
        END $$;
        """;

    public static readonly string Counts = $$"""
        SELECT
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = '{{EntityKindRegistry.Image.Code}}') AS images_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = '{{EntityKindRegistry.Gallery.Code}}') AS galleries_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = '{{EntityKindRegistry.Book.Code}}') AS books_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = '{{EntityKindRegistry.AudioLibrary.Code}}') AS audio_libraries_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = '{{EntityKindRegistry.AudioTrack.Code}}') AS audio_tracks_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = '{{EntityKindRegistry.Collection.Code}}') AS collections_imported,
            ((SELECT COUNT(*)::int FROM v2.entity_hierarchy_links WHERE relationship IN ('{{EntityRelationshipRegistry.Gallery.Code}}', '{{EntityRelationshipRegistry.AudioLibrary.Code}}')) +
             (SELECT COUNT(*)::int FROM v2.entity_hierarchy_links WHERE relationship = '{{EntityRelationshipRegistry.CollectionItem.Code}}') +
             (SELECT COUNT(*)::int FROM v2.entity_credit_links) +
             (SELECT COUNT(*)::int FROM v2.entity_studio_links) +
             (SELECT COUNT(*)::int FROM v2.entity_markers)) AS links_imported;
        """;
}
