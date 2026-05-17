using Obscura.Domain.Entities;

namespace Obscura.Infrastructure.Legacy;

/// <summary>
/// Provides audio-library and audio-track SQL fragments for the legacy non-video media preview import.
/// </summary>
public static partial class LegacyMediaImportSql
{
    private static readonly string AudioLibrariesImport = $$"""
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

                INSERT INTO v2.audio_library_details (entity_id)
                SELECT id
                FROM public.audio_libraries
                ON CONFLICT (entity_id) DO NOTHING;

                INSERT INTO v2.entity_studio_links (entity_id, studio_id, created_at)
                SELECT id, studio_id, updated_at
                FROM public.audio_libraries
                WHERE studio_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM v2.entities studio WHERE studio.id = studio_id AND studio.kind_code = '{{EntityKindRegistry.Studio.Code}}')
                ON CONFLICT (entity_id) DO UPDATE SET
                    studio_id = EXCLUDED.studio_id;

                INSERT INTO v2.entity_child_links (parent_entity_id, child_entity_id, child_kind_code, sort_order, is_structural, source, created_at)
                SELECT parent_id, id, '{{EntityKindRegistry.AudioLibrary.Code}}', 0, true, 'legacy-import', created_at
                FROM public.audio_libraries
                WHERE parent_id IS NOT NULL
                ON CONFLICT (parent_entity_id, child_entity_id, child_kind_code) DO UPDATE SET
                    sort_order = EXCLUDED.sort_order,
                    is_structural = EXCLUDED.is_structural,
                    source = EXCLUDED.source;

                INSERT INTO v2.entity_urls (id, entity_id, url, label, sort_order, created_at)
                SELECT gen_random_uuid(), library.id, link.url, NULL, (link.sort_order - 1)::int, library.created_at
                FROM public.audio_libraries library
                CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(library.urls, '[]'::jsonb)) WITH ORDINALITY AS link(url, sort_order)
                ON CONFLICT (entity_id, url) DO UPDATE SET
                    label = EXCLUDED.label,
                    sort_order = EXCLUDED.sort_order;
            END IF;
        """;

    private static readonly string AudioTracksImport = $$"""
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
                    embedded_artist,
                    embedded_album
                )
                SELECT
                    id,
                    embedded_artist,
                    embedded_album
                FROM public.audio_tracks
                ON CONFLICT (entity_id) DO UPDATE SET
                    embedded_artist = EXCLUDED.embedded_artist,
                    embedded_album = EXCLUDED.embedded_album;

                INSERT INTO v2.entity_studio_links (entity_id, studio_id, created_at)
                SELECT id, studio_id, updated_at
                FROM public.audio_tracks
                WHERE studio_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM v2.entities studio WHERE studio.id = studio_id AND studio.kind_code = '{{EntityKindRegistry.Studio.Code}}')
                ON CONFLICT (entity_id) DO UPDATE SET
                    studio_id = EXCLUDED.studio_id;

                INSERT INTO v2.entity_child_links (parent_entity_id, child_entity_id, child_kind_code, sort_order, is_structural, source, created_at)
                SELECT library_id, id, '{{EntityKindRegistry.AudioTrack.Code}}', sort_order, true, 'legacy-import', created_at
                FROM public.audio_tracks
                WHERE library_id IS NOT NULL
                ON CONFLICT (parent_entity_id, child_entity_id, child_kind_code) DO UPDATE SET
                    sort_order = EXCLUDED.sort_order,
                    is_structural = EXCLUDED.is_structural,
                    source = EXCLUDED.source;

                INSERT INTO v2.entity_urls (id, entity_id, url, label, sort_order, created_at)
                SELECT gen_random_uuid(), track.id, link.url, NULL, (link.sort_order - 1)::int, track.created_at
                FROM public.audio_tracks track
                CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(track.urls, '[]'::jsonb)) WITH ORDINALITY AS link(url, sort_order)
                ON CONFLICT (entity_id, url) DO UPDATE SET
                    label = EXCLUDED.label,
                    sort_order = EXCLUDED.sort_order;
            END IF;
        """;

    private static readonly string ExternalIdsImport = $$"""
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
        """;

    private static readonly string AudioTrackMarkersImport = $$"""
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
        """;

    private static readonly string AudioLibraryTagsImport = $$"""
            IF to_regclass('public.audio_library_tags') IS NOT NULL THEN
                INSERT INTO v2.entity_tag_links (entity_id, tag_id, created_at)
                SELECT library_id, tag_id, now()
                FROM public.audio_library_tags
                WHERE EXISTS (SELECT 1 FROM v2.entities tag WHERE tag.id = tag_id AND tag.kind_code = '{{EntityKindRegistry.Tag.Code}}')
                ON CONFLICT (entity_id, tag_id) DO NOTHING;
            END IF;
        """;

    private static readonly string AudioTrackTagsImport = $$"""
            IF to_regclass('public.audio_track_tags') IS NOT NULL THEN
                INSERT INTO v2.entity_tag_links (entity_id, tag_id, created_at)
                SELECT track_id, tag_id, now()
                FROM public.audio_track_tags
                WHERE EXISTS (SELECT 1 FROM v2.entities tag WHERE tag.id = tag_id AND tag.kind_code = '{{EntityKindRegistry.Tag.Code}}')
                ON CONFLICT (entity_id, tag_id) DO NOTHING;
            END IF;
        """;

    private static readonly string AudioLibraryPerformersImport = $$"""
            IF to_regclass('public.audio_library_performers') IS NOT NULL THEN
                INSERT INTO v2.entity_credit_links (entity_id, person_entity_id, role, character, sort_order, created_at)
                SELECT library_id, performer_id, '{{EntityKindRegistry.Person.Code}}', NULL, 0, now()
                FROM public.audio_library_performers
                WHERE EXISTS (SELECT 1 FROM v2.entities person WHERE person.id = performer_id AND person.kind_code = '{{EntityKindRegistry.Person.Code}}')
                ON CONFLICT (entity_id, person_entity_id, role) DO NOTHING;
            END IF;
        """;

    private static readonly string AudioTrackPerformersImport = $$"""
            IF to_regclass('public.audio_track_performers') IS NOT NULL THEN
                INSERT INTO v2.entity_credit_links (entity_id, person_entity_id, role, character, sort_order, created_at)
                SELECT track_id, performer_id, '{{EntityKindRegistry.Person.Code}}', NULL, 0, now()
                FROM public.audio_track_performers
                WHERE EXISTS (SELECT 1 FROM v2.entities person WHERE person.id = performer_id AND person.kind_code = '{{EntityKindRegistry.Person.Code}}')
                ON CONFLICT (entity_id, person_entity_id, role) DO NOTHING;
            END IF;
        """;
}
