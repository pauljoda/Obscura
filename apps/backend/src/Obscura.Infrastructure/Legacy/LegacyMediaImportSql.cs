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

                INSERT INTO v2.entity_studio_links (entity_id, studio_id, created_at)
                SELECT id, studio_id, updated_at
                FROM public.galleries
                WHERE studio_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM v2.entities studio WHERE studio.id = studio_id AND studio.kind_code = '{{EntityKindRegistry.Studio.Code}}')
                ON CONFLICT (entity_id) DO UPDATE SET
                    studio_id = EXCLUDED.studio_id;

                INSERT INTO v2.entity_hierarchy_links (parent_entity_id, child_entity_id, relationship, sort_order, created_at)
                SELECT parent_id, id, '{{EntityRelationshipRegistry.NestedGallery.Code}}', 0, created_at
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

                INSERT INTO v2.entity_studio_links (entity_id, studio_id, created_at)
                SELECT id, studio_id, updated_at
                FROM public.images
                WHERE studio_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM v2.entities studio WHERE studio.id = studio_id AND studio.kind_code = '{{EntityKindRegistry.Studio.Code}}')
                ON CONFLICT (entity_id) DO UPDATE SET
                    studio_id = EXCLUDED.studio_id;

                INSERT INTO v2.entity_hierarchy_links (parent_entity_id, child_entity_id, relationship, sort_order, created_at)
                SELECT gallery_id, id, '{{EntityRelationshipRegistry.GalleryImage.Code}}', sort_order, created_at
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
                SELECT gen_random_uuid(), id, 'thumbnail', COALESCE(cover_image_path, icon_path), NULL, NULL, created_at, updated_at
                FROM public.audio_libraries
                WHERE COALESCE(cover_image_path, icon_path) IS NOT NULL
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_studio_links (entity_id, studio_id, created_at)
                SELECT id, studio_id, updated_at
                FROM public.audio_libraries
                WHERE studio_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM v2.entities studio WHERE studio.id = studio_id AND studio.kind_code = '{{EntityKindRegistry.Studio.Code}}')
                ON CONFLICT (entity_id) DO UPDATE SET
                    studio_id = EXCLUDED.studio_id;

                INSERT INTO v2.entity_hierarchy_links (parent_entity_id, child_entity_id, relationship, sort_order, created_at)
                SELECT parent_id, id, '{{EntityRelationshipRegistry.NestedAudioLibrary.Code}}', 0, created_at
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

                INSERT INTO v2.entity_studio_links (entity_id, studio_id, created_at)
                SELECT id, studio_id, updated_at
                FROM public.audio_tracks
                WHERE studio_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM v2.entities studio WHERE studio.id = studio_id AND studio.kind_code = '{{EntityKindRegistry.Studio.Code}}')
                ON CONFLICT (entity_id) DO UPDATE SET
                    studio_id = EXCLUDED.studio_id;

                INSERT INTO v2.entity_hierarchy_links (parent_entity_id, child_entity_id, relationship, sort_order, created_at)
                SELECT library_id, id, '{{EntityRelationshipRegistry.AudioTrack.Code}}', sort_order, created_at
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
            ((SELECT COUNT(*)::int FROM v2.entity_hierarchy_links WHERE relationship IN ('{{EntityRelationshipRegistry.NestedGallery.Code}}', '{{EntityRelationshipRegistry.GalleryImage.Code}}', '{{EntityRelationshipRegistry.NestedAudioLibrary.Code}}', '{{EntityRelationshipRegistry.AudioTrack.Code}}')) +
             (SELECT COUNT(*)::int FROM v2.entity_hierarchy_links WHERE relationship = '{{EntityRelationshipRegistry.CollectionItem.Code}}') +
             (SELECT COUNT(*)::int FROM v2.entity_credit_links) +
             (SELECT COUNT(*)::int FROM v2.entity_studio_links) +
             (SELECT COUNT(*)::int FROM v2.entity_markers)) AS links_imported;
        """;
}
