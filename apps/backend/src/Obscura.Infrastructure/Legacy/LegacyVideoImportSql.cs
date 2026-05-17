using Obscura.Domain.Entities;

namespace Obscura.Infrastructure.Legacy;

/// <summary>
/// Provides SQL used to preview-import legacy video, series, taxonomy, and relationship tables into the v2 entity model.
/// </summary>
public static class LegacyVideoImportSql
{
    /// <summary>
    /// PostgreSQL block that imports legacy video-oriented entities and their shared capabilities.
    /// </summary>
    public static readonly string Import = $$"""
        DO $$
        BEGIN
            IF to_regclass('public.tags') IS NOT NULL THEN
                INSERT INTO v2.entities (id, kind_code, title, created_at, updated_at)
                SELECT id, '{{EntityKindRegistry.Tag.Code}}', name, created_at, updated_at
                FROM public.tags
                ON CONFLICT (id) DO UPDATE SET
                    kind_code = EXCLUDED.kind_code,
                    title = EXCLUDED.title,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_flags (entity_id, is_favorite, is_nsfw, is_organized, updated_at)
                SELECT id, favorite, is_nsfw, true, updated_at
                FROM public.tags
                ON CONFLICT (entity_id) DO UPDATE SET
                    is_favorite = EXCLUDED.is_favorite,
                    is_nsfw = EXCLUDED.is_nsfw,
                    is_organized = EXCLUDED.is_organized,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_ratings (entity_id, value, updated_at)
                SELECT id, LEAST(GREATEST(rating, 0), 5), updated_at
                FROM public.tags
                WHERE rating IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

            END IF;

            IF to_regclass('public.studios') IS NOT NULL THEN
                INSERT INTO v2.entities (id, kind_code, title, created_at, updated_at)
                SELECT id, '{{EntityKindRegistry.Studio.Code}}', name, created_at, updated_at
                FROM public.studios
                ON CONFLICT (id) DO UPDATE SET
                    kind_code = EXCLUDED.kind_code,
                    title = EXCLUDED.title,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_flags (entity_id, is_favorite, is_nsfw, is_organized, updated_at)
                SELECT id, favorite, is_nsfw, true, updated_at
                FROM public.studios
                ON CONFLICT (entity_id) DO UPDATE SET
                    is_favorite = EXCLUDED.is_favorite,
                    is_nsfw = EXCLUDED.is_nsfw,
                    is_organized = EXCLUDED.is_organized,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_ratings (entity_id, value, updated_at)
                SELECT id, LEAST(GREATEST(rating, 0), 5), updated_at
                FROM public.studios
                WHERE rating IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

            END IF;

            IF to_regclass('public.performers') IS NOT NULL THEN
                INSERT INTO v2.entities (id, kind_code, title, created_at, updated_at)
                SELECT id, '{{EntityKindRegistry.Person.Code}}', name, created_at, updated_at
                FROM public.performers
                ON CONFLICT (id) DO UPDATE SET
                    kind_code = EXCLUDED.kind_code,
                    title = EXCLUDED.title,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_flags (entity_id, is_favorite, is_nsfw, is_organized, updated_at)
                SELECT id, favorite, is_nsfw, true, updated_at
                FROM public.performers
                ON CONFLICT (entity_id) DO UPDATE SET
                    is_favorite = EXCLUDED.is_favorite,
                    is_nsfw = EXCLUDED.is_nsfw,
                    is_organized = EXCLUDED.is_organized,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_ratings (entity_id, value, updated_at)
                SELECT id, LEAST(GREATEST(rating, 0), 5), updated_at
                FROM public.performers
                WHERE rating IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

            END IF;

            IF to_regclass('public.video_series') IS NOT NULL THEN
                INSERT INTO v2.entities (id, kind_code, title, created_at, updated_at)
                SELECT id, '{{EntityKindRegistry.VideoSeries.Code}}', COALESCE(custom_name, title), created_at, updated_at
                FROM public.video_series
                ON CONFLICT (id) DO UPDATE SET
                    kind_code = EXCLUDED.kind_code,
                    title = EXCLUDED.title,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_flags (entity_id, is_favorite, is_nsfw, is_organized, updated_at)
                SELECT id, false, is_nsfw, organized, updated_at
                FROM public.video_series
                ON CONFLICT (entity_id) DO UPDATE SET
                    is_favorite = EXCLUDED.is_favorite,
                    is_nsfw = EXCLUDED.is_nsfw,
                    is_organized = EXCLUDED.is_organized,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_ratings (entity_id, value, updated_at)
                SELECT id, LEAST(GREATEST(rating, 0), 5), updated_at
                FROM public.video_series
                WHERE rating IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_descriptions (entity_id, value, updated_at)
                SELECT id, overview, updated_at
                FROM public.video_series
                WHERE overview IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_dates (entity_id, code, value, sortable_value, precision, updated_at)
                SELECT series.id, date_value.code, date_value.value, NULL, NULL, series.updated_at
                FROM public.video_series series
                CROSS JOIN LATERAL (VALUES
                    ('first-air', series.first_air_date),
                    ('end-air', series.end_air_date)
                ) AS date_value(code, value)
                WHERE date_value.value IS NOT NULL
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    sortable_value = EXCLUDED.sortable_value,
                    precision = EXCLUDED.precision,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_sources (entity_id, code, value, updated_at)
                SELECT series.id, source.code, source.value, series.updated_at
                FROM public.video_series series
                CROSS JOIN LATERAL (VALUES
                    ('library-root', series.library_root_id::text),
                    ('folder', series.folder_path),
                    ('relative', series.relative_path)
                ) AS source(code, value)
                WHERE source.value IS NOT NULL
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at, source)
                SELECT gen_random_uuid(), series.id, artwork.role, artwork.path, NULL, NULL, series.created_at, series.updated_at, 'custom'
                FROM public.video_series series
                CROSS JOIN LATERAL (VALUES
                    ('{{EntityFileRole.Poster.ToCode()}}', series.poster_path),
                    ('{{EntityFileRole.Backdrop.ToCode()}}', series.backdrop_path),
                    ('{{EntityFileRole.Logo.ToCode()}}', series.logo_path)
                ) AS artwork(role, path)
                WHERE artwork.path IS NOT NULL
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    size_bytes = EXCLUDED.size_bytes,
                    source = EXCLUDED.source,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_classifications (entity_id, value, system, updated_at)
                SELECT id, content_rating, 'content-rating', updated_at
                FROM public.video_series
                WHERE content_rating IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    system = EXCLUDED.system,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_relationship_links (entity_id, relationship_code, label, target_entity_id, target_kind_code, sort_order, created_at)
                SELECT id, 'studio', 'Studio', studio_id, '{{EntityKindRegistry.Studio.Code}}', 0, updated_at
                FROM public.video_series
                WHERE studio_id IS NOT NULL
                ON CONFLICT (entity_id, relationship_code, target_entity_id) DO UPDATE SET
                    label = EXCLUDED.label,
                    target_kind_code = EXCLUDED.target_kind_code,
                    sort_order = EXCLUDED.sort_order;

                INSERT INTO v2.entity_external_ids (id, entity_id, provider, value, url, created_at, updated_at)
                SELECT gen_random_uuid(), series.id, external.key, external.value, NULL, series.created_at, series.updated_at
                FROM public.video_series series
                CROSS JOIN LATERAL jsonb_each_text(COALESCE(series.external_ids, '{}'::jsonb)) AS external(key, value)
                ON CONFLICT (entity_id, provider) DO UPDATE SET
                    value = EXCLUDED.value,
                    url = EXCLUDED.url,
                    updated_at = EXCLUDED.updated_at;
            END IF;

            IF to_regclass('public.video_movies') IS NOT NULL THEN
                INSERT INTO v2.entities (id, kind_code, title, created_at, updated_at)
                SELECT id, '{{EntityKindRegistry.Video.Code}}', title, created_at, updated_at
                FROM public.video_movies
                ON CONFLICT (id) DO UPDATE SET
                    kind_code = EXCLUDED.kind_code,
                    title = EXCLUDED.title,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.video_details (
                    entity_id,
                    subtitles_extracted_at
                )
                SELECT id, subtitles_extracted_at
                FROM public.video_movies
                ON CONFLICT (entity_id) DO UPDATE SET
                    subtitles_extracted_at = EXCLUDED.subtitles_extracted_at;

                INSERT INTO v2.entity_flags (entity_id, is_favorite, is_nsfw, is_organized, updated_at)
                SELECT id, false, is_nsfw, organized, updated_at
                FROM public.video_movies
                ON CONFLICT (entity_id) DO UPDATE SET
                    is_favorite = EXCLUDED.is_favorite,
                    is_nsfw = EXCLUDED.is_nsfw,
                    is_organized = EXCLUDED.is_organized,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_ratings (entity_id, value, updated_at)
                SELECT id, LEAST(GREATEST(rating, 0), 5), updated_at
                FROM public.video_movies
                WHERE rating IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                SELECT gen_random_uuid(), id, 'source', file_path, NULL, file_size::bigint, created_at, updated_at
                FROM public.video_movies
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    size_bytes = EXCLUDED.size_bytes,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_descriptions (entity_id, value, updated_at)
                SELECT id, overview, updated_at
                FROM public.video_movies
                WHERE overview IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_dates (entity_id, code, value, sortable_value, precision, updated_at)
                SELECT id, 'release', release_date, NULL, NULL, updated_at
                FROM public.video_movies
                WHERE release_date IS NOT NULL
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
                SELECT id, duration, width, height, frame_rate, bit_rate, NULL, NULL, codec, container, NULL, updated_at
                FROM public.video_movies
                WHERE duration IS NOT NULL
                   OR width IS NOT NULL
                   OR height IS NOT NULL
                   OR frame_rate IS NOT NULL
                   OR bit_rate IS NOT NULL
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
                SELECT movie.id, source.code, source.value, movie.updated_at
                FROM public.video_movies movie
                CROSS JOIN LATERAL (VALUES
                    ('library-root', movie.library_root_id::text),
                    ('file', movie.file_path)
                ) AS source(code, value)
                WHERE source.value IS NOT NULL
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_classifications (entity_id, value, system, updated_at)
                SELECT id, content_rating, 'content-rating', updated_at
                FROM public.video_movies
                WHERE content_rating IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    system = EXCLUDED.system,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_playback (entity_id, play_count, play_duration_seconds, resume_seconds, last_played_at, completed_at, updated_at)
                SELECT id, play_count, play_duration, resume_time, last_played_at, NULL, updated_at
                FROM public.video_movies
                WHERE play_count > 0 OR play_duration > 0 OR resume_time > 0 OR last_played_at IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    play_count = EXCLUDED.play_count,
                    play_duration_seconds = EXCLUDED.play_duration_seconds,
                    resume_seconds = EXCLUDED.resume_seconds,
                    last_played_at = EXCLUDED.last_played_at,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_counters (entity_id, code, value, updated_at)
                SELECT id, 'orgasm', GREATEST(orgasm_count, 0), updated_at
                FROM public.video_movies
                WHERE orgasm_count > 0
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_file_fingerprints (id, entity_id, entity_file_id, algorithm, value, created_at)
                SELECT gen_random_uuid(), movie.id, NULL, hash.algorithm, hash.value, movie.created_at
                FROM public.video_movies movie
                CROSS JOIN LATERAL (VALUES
                    ('md5', movie.checksum_md5),
                    ('oshash', movie.oshash),
                    ('phash', movie.phash)
                ) AS hash(algorithm, value)
                WHERE hash.value IS NOT NULL
                ON CONFLICT (entity_id, algorithm) DO UPDATE SET
                    value = EXCLUDED.value;

                INSERT INTO v2.entity_relationship_links (entity_id, relationship_code, label, target_entity_id, target_kind_code, sort_order, created_at)
                SELECT id, 'studio', 'Studio', studio_id, '{{EntityKindRegistry.Studio.Code}}', 0, updated_at
                FROM public.video_movies
                WHERE studio_id IS NOT NULL
                ON CONFLICT (entity_id, relationship_code, target_entity_id) DO UPDATE SET
                    label = EXCLUDED.label,
                    target_kind_code = EXCLUDED.target_kind_code,
                    sort_order = EXCLUDED.sort_order;

                INSERT INTO v2.entity_urls (id, entity_id, url, label, sort_order, created_at)
                SELECT gen_random_uuid(), id, url, NULL, 0, created_at
                FROM public.video_movies
                WHERE url IS NOT NULL
                ON CONFLICT (entity_id, url) DO UPDATE SET
                    label = EXCLUDED.label,
                    sort_order = EXCLUDED.sort_order;

                INSERT INTO v2.entity_external_ids (id, entity_id, provider, value, url, created_at, updated_at)
                SELECT gen_random_uuid(), movie.id, external.key, external.value, NULL, movie.created_at, movie.updated_at
                FROM public.video_movies movie
                CROSS JOIN LATERAL jsonb_each_text(COALESCE(movie.external_ids, '{}'::jsonb)) AS external(key, value)
                ON CONFLICT (entity_id, provider) DO UPDATE SET
                    value = EXCLUDED.value,
                    url = EXCLUDED.url,
                    updated_at = EXCLUDED.updated_at;
            END IF;

            IF to_regclass('public.video_episodes') IS NOT NULL THEN
                INSERT INTO v2.entities (id, kind_code, title, created_at, updated_at)
                SELECT
                    id,
                    '{{EntityKindRegistry.Video.Code}}',
                    COALESCE(title, 'Episode ' || COALESCE(episode_number::text, absolute_episode_number::text), regexp_replace(file_path, '^.*/', '')),
                    created_at,
                    updated_at
                FROM public.video_episodes
                ON CONFLICT (id) DO UPDATE SET
                    kind_code = EXCLUDED.kind_code,
                    title = EXCLUDED.title,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.video_details (
                    entity_id,
                    subtitles_extracted_at
                )
                SELECT id, subtitles_extracted_at
                FROM public.video_episodes
                ON CONFLICT (entity_id) DO UPDATE SET
                    subtitles_extracted_at = EXCLUDED.subtitles_extracted_at;

                INSERT INTO v2.entity_flags (entity_id, is_favorite, is_nsfw, is_organized, updated_at)
                SELECT id, false, is_nsfw, organized, updated_at
                FROM public.video_episodes
                ON CONFLICT (entity_id) DO UPDATE SET
                    is_favorite = EXCLUDED.is_favorite,
                    is_nsfw = EXCLUDED.is_nsfw,
                    is_organized = EXCLUDED.is_organized,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_ratings (entity_id, value, updated_at)
                SELECT id, LEAST(GREATEST(rating, 0), 5), updated_at
                FROM public.video_episodes
                WHERE rating IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                SELECT gen_random_uuid(), id, 'source', file_path, NULL, file_size::bigint, created_at, updated_at
                FROM public.video_episodes
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    size_bytes = EXCLUDED.size_bytes,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_descriptions (entity_id, value, updated_at)
                SELECT id, overview, updated_at
                FROM public.video_episodes
                WHERE overview IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_dates (entity_id, code, value, sortable_value, precision, updated_at)
                SELECT id, 'air', air_date, NULL, NULL, updated_at
                FROM public.video_episodes
                WHERE air_date IS NOT NULL
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
                SELECT id, duration, width, height, frame_rate, bit_rate, NULL, NULL, codec, container, NULL, updated_at
                FROM public.video_episodes
                WHERE duration IS NOT NULL
                   OR width IS NOT NULL
                   OR height IS NOT NULL
                   OR frame_rate IS NOT NULL
                   OR bit_rate IS NOT NULL
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
                FROM public.video_episodes
                WHERE file_path IS NOT NULL
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_positions (entity_id, code, value, label, updated_at)
                SELECT episode.id, position.code, position.value, position.label, episode.updated_at
                FROM public.video_episodes episode
                CROSS JOIN LATERAL (VALUES
                    ('season', episode.season_number, episode.season_number::text),
                    ('episode', episode.episode_number, episode.episode_number::text),
                    ('absolute-episode', episode.absolute_episode_number, episode.absolute_episode_number::text)
                ) AS position(code, value, label)
                WHERE position.value IS NOT NULL
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    label = EXCLUDED.label,
                    updated_at = EXCLUDED.updated_at;

                IF to_regclass('public.video_seasons') IS NOT NULL THEN
                    WITH legacy_seasons AS (
                        SELECT
                            COALESCE(existing.entity_id, season.id) AS entity_id,
                            season.series_id,
                            season.season_number,
                            COALESCE(season.title, 'Season ' || season.season_number::text) AS title,
                            season.folder_path,
                            season.overview,
                            season.poster_path,
                            season.air_date,
                            season.external_ids,
                            season.created_at,
                            season.updated_at
                        FROM public.video_seasons season
                        LEFT JOIN v2.entity_child_links existing_link
                            ON existing_link.parent_entity_id = season.series_id
                           AND existing_link.child_kind_code = '{{EntityKindRegistry.VideoSeason.Code}}'
                           AND existing_link.is_structural = true
                        LEFT JOIN v2.video_season_details existing
                            ON existing.entity_id = existing_link.child_entity_id
                           AND existing.season_number = season.season_number
                        WHERE season.series_id IS NOT NULL
                          AND season.season_number IS NOT NULL
                    )
                    INSERT INTO v2.entities (id, kind_code, title, created_at, updated_at)
                    SELECT entity_id, '{{EntityKindRegistry.VideoSeason.Code}}', title, created_at, updated_at
                    FROM legacy_seasons
                    ON CONFLICT (id) DO UPDATE SET
                        kind_code = EXCLUDED.kind_code,
                        title = EXCLUDED.title,
                        updated_at = EXCLUDED.updated_at;

                    WITH legacy_seasons AS (
                        SELECT
                            COALESCE(existing.entity_id, season.id) AS entity_id,
                            season.series_id,
                            season.season_number
                        FROM public.video_seasons season
                        LEFT JOIN v2.entity_child_links existing_link
                            ON existing_link.parent_entity_id = season.series_id
                           AND existing_link.child_kind_code = '{{EntityKindRegistry.VideoSeason.Code}}'
                           AND existing_link.is_structural = true
                        LEFT JOIN v2.video_season_details existing
                            ON existing.entity_id = existing_link.child_entity_id
                           AND existing.season_number = season.season_number
                        WHERE season.series_id IS NOT NULL
                          AND season.season_number IS NOT NULL
                    )
                    INSERT INTO v2.video_season_details (entity_id, season_number)
                    SELECT entity_id, season_number
                    FROM legacy_seasons
                    ON CONFLICT (entity_id) DO UPDATE SET
                        season_number = EXCLUDED.season_number;

                    WITH legacy_seasons AS (
                        SELECT
                            COALESCE(existing.entity_id, season.id) AS entity_id,
                            season.overview,
                            season.updated_at
                        FROM public.video_seasons season
                        LEFT JOIN v2.entity_child_links existing_link
                            ON existing_link.parent_entity_id = season.series_id
                           AND existing_link.child_kind_code = '{{EntityKindRegistry.VideoSeason.Code}}'
                           AND existing_link.is_structural = true
                        LEFT JOIN v2.video_season_details existing
                            ON existing.entity_id = existing_link.child_entity_id
                           AND existing.season_number = season.season_number
                        WHERE season.overview IS NOT NULL
                    )
                    INSERT INTO v2.entity_descriptions (entity_id, value, updated_at)
                    SELECT entity_id, overview, updated_at
                    FROM legacy_seasons
                    ON CONFLICT (entity_id) DO UPDATE SET
                        value = EXCLUDED.value,
                        updated_at = EXCLUDED.updated_at;

                    WITH legacy_seasons AS (
                        SELECT
                            COALESCE(existing.entity_id, season.id) AS entity_id,
                            season.air_date,
                            season.updated_at
                        FROM public.video_seasons season
                        LEFT JOIN v2.entity_child_links existing_link
                            ON existing_link.parent_entity_id = season.series_id
                           AND existing_link.child_kind_code = '{{EntityKindRegistry.VideoSeason.Code}}'
                           AND existing_link.is_structural = true
                        LEFT JOIN v2.video_season_details existing
                            ON existing.entity_id = existing_link.child_entity_id
                           AND existing.season_number = season.season_number
                        WHERE season.air_date IS NOT NULL
                    )
                    INSERT INTO v2.entity_dates (entity_id, code, value, sortable_value, precision, updated_at)
                    SELECT entity_id, 'air', air_date, NULL, NULL, updated_at
                    FROM legacy_seasons
                    ON CONFLICT (entity_id, code) DO UPDATE SET
                        value = EXCLUDED.value,
                        sortable_value = EXCLUDED.sortable_value,
                        precision = EXCLUDED.precision,
                        updated_at = EXCLUDED.updated_at;

                    WITH legacy_seasons AS (
                        SELECT
                            COALESCE(existing.entity_id, season.id) AS entity_id,
                            season.folder_path,
                            season.updated_at
                        FROM public.video_seasons season
                        LEFT JOIN v2.entity_child_links existing_link
                            ON existing_link.parent_entity_id = season.series_id
                           AND existing_link.child_kind_code = '{{EntityKindRegistry.VideoSeason.Code}}'
                           AND existing_link.is_structural = true
                        LEFT JOIN v2.video_season_details existing
                            ON existing.entity_id = existing_link.child_entity_id
                           AND existing.season_number = season.season_number
                        WHERE season.folder_path IS NOT NULL
                    )
                    INSERT INTO v2.entity_sources (entity_id, code, value, updated_at)
                    SELECT entity_id, 'folder', folder_path, updated_at
                    FROM legacy_seasons
                    ON CONFLICT (entity_id, code) DO UPDATE SET
                        value = EXCLUDED.value,
                        updated_at = EXCLUDED.updated_at;

                    WITH legacy_seasons AS (
                        SELECT
                            COALESCE(existing.entity_id, season.id) AS entity_id,
                            season.folder_path,
                            season.created_at,
                            season.updated_at
                        FROM public.video_seasons season
                        LEFT JOIN v2.entity_child_links existing_link
                            ON existing_link.parent_entity_id = season.series_id
                           AND existing_link.child_kind_code = '{{EntityKindRegistry.VideoSeason.Code}}'
                           AND existing_link.is_structural = true
                        LEFT JOIN v2.video_season_details existing
                            ON existing.entity_id = existing_link.child_entity_id
                           AND existing.season_number = season.season_number
                        WHERE season.folder_path IS NOT NULL
                    )
                    INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                    SELECT gen_random_uuid(), entity_id, '{{EntityFileRole.Source.ToCode()}}', folder_path, NULL, NULL, created_at, updated_at
                    FROM legacy_seasons
                    ON CONFLICT (entity_id, role) DO UPDATE SET
                        path = EXCLUDED.path,
                        updated_at = EXCLUDED.updated_at;

                    WITH legacy_seasons AS (
                        SELECT
                            COALESCE(existing.entity_id, season.id) AS entity_id,
                            season.poster_path,
                            season.created_at,
                            season.updated_at
                        FROM public.video_seasons season
                        LEFT JOIN v2.entity_child_links existing_link
                            ON existing_link.parent_entity_id = season.series_id
                           AND existing_link.child_kind_code = '{{EntityKindRegistry.VideoSeason.Code}}'
                           AND existing_link.is_structural = true
                        LEFT JOIN v2.video_season_details existing
                            ON existing.entity_id = existing_link.child_entity_id
                           AND existing.season_number = season.season_number
                        WHERE season.poster_path IS NOT NULL
                    )
                    INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at, source)
                    SELECT gen_random_uuid(), entity_id, '{{EntityFileRole.Poster.ToCode()}}', poster_path, NULL, NULL, created_at, updated_at, 'custom'
                    FROM legacy_seasons
                    ON CONFLICT (entity_id, role) DO UPDATE SET
                        path = EXCLUDED.path,
                        size_bytes = EXCLUDED.size_bytes,
                        source = EXCLUDED.source,
                        updated_at = EXCLUDED.updated_at;

                    WITH legacy_seasons AS (
                        SELECT
                            COALESCE(existing.entity_id, season.id) AS entity_id,
                            season.external_ids,
                            season.created_at,
                            season.updated_at
                        FROM public.video_seasons season
                        LEFT JOIN v2.entity_child_links existing_link
                            ON existing_link.parent_entity_id = season.series_id
                           AND existing_link.child_kind_code = '{{EntityKindRegistry.VideoSeason.Code}}'
                           AND existing_link.is_structural = true
                        LEFT JOIN v2.video_season_details existing
                            ON existing.entity_id = existing_link.child_entity_id
                           AND existing.season_number = season.season_number
                    )
                    INSERT INTO v2.entity_external_ids (id, entity_id, provider, value, url, created_at, updated_at)
                    SELECT gen_random_uuid(), legacy.entity_id, external.key, external.value, NULL, legacy.created_at, legacy.updated_at
                    FROM legacy_seasons legacy
                    CROSS JOIN LATERAL jsonb_each_text(COALESCE(legacy.external_ids, '{}'::jsonb)) AS external(key, value)
                    ON CONFLICT (entity_id, provider) DO UPDATE SET
                        value = EXCLUDED.value,
                        url = EXCLUDED.url,
                        updated_at = EXCLUDED.updated_at;

                    WITH legacy_seasons AS (
                        SELECT
                            COALESCE(existing.entity_id, season.id) AS entity_id,
                            season.season_number,
                            season.updated_at
                        FROM public.video_seasons season
                        LEFT JOIN v2.entity_child_links existing_link
                            ON existing_link.parent_entity_id = season.series_id
                           AND existing_link.child_kind_code = '{{EntityKindRegistry.VideoSeason.Code}}'
                           AND existing_link.is_structural = true
                        LEFT JOIN v2.video_season_details existing
                            ON existing.entity_id = existing_link.child_entity_id
                           AND existing.season_number = season.season_number
                        WHERE season.season_number IS NOT NULL
                    )
                    INSERT INTO v2.entity_positions (entity_id, code, value, label, updated_at)
                    SELECT entity_id, 'season', season_number, season_number::text, updated_at
                    FROM legacy_seasons
                    ON CONFLICT (entity_id, code) DO UPDATE SET
                        value = EXCLUDED.value,
                        label = EXCLUDED.label,
                        updated_at = EXCLUDED.updated_at;

                    WITH legacy_seasons AS (
                        SELECT
                            COALESCE(existing.entity_id, season.id) AS entity_id,
                            season.series_id,
                            season.season_number,
                            season.created_at
                        FROM public.video_seasons season
                        LEFT JOIN v2.entity_child_links existing_link
                            ON existing_link.parent_entity_id = season.series_id
                           AND existing_link.child_kind_code = '{{EntityKindRegistry.VideoSeason.Code}}'
                           AND existing_link.is_structural = true
                        LEFT JOIN v2.video_season_details existing
                            ON existing.entity_id = existing_link.child_entity_id
                           AND existing.season_number = season.season_number
                        WHERE season.series_id IS NOT NULL
                          AND season.season_number IS NOT NULL
                    )
                    INSERT INTO v2.entity_child_links (parent_entity_id, child_entity_id, child_kind_code, sort_order, is_structural, source, created_at)
                    SELECT series_id, entity_id, '{{EntityKindRegistry.VideoSeason.Code}}', season_number, true, 'legacy-import', created_at
                    FROM legacy_seasons
                    ON CONFLICT (parent_entity_id, child_entity_id, child_kind_code) DO UPDATE SET
                        sort_order = EXCLUDED.sort_order,
                        is_structural = EXCLUDED.is_structural,
                        source = EXCLUDED.source;

                    INSERT INTO v2.video_series_details (entity_id)
                    SELECT DISTINCT series_id
                    FROM public.video_seasons
                    WHERE series_id IS NOT NULL
                    ON CONFLICT (entity_id) DO NOTHING;
                END IF;

                WITH legacy_seasons AS (
                    SELECT
                        series_id,
                        season_number,
                        'Season ' || season_number::text AS title,
                        regexp_replace(MIN(file_path), '/[^/]*$', '') AS folder_path,
                        MIN(created_at) AS created_at,
                        MAX(updated_at) AS updated_at
                    FROM public.video_episodes
                    WHERE series_id IS NOT NULL
                      AND season_number IS NOT NULL
                    GROUP BY series_id, season_number
                ),
                existing_seasons AS (
                    SELECT
                        season.entity_id,
                        legacy.series_id,
                        legacy.season_number,
                        legacy.title,
                        legacy.folder_path,
                        legacy.created_at,
                        legacy.updated_at
                    FROM legacy_seasons legacy
                    INNER JOIN v2.entity_child_links season_link
                        ON season_link.parent_entity_id = legacy.series_id
                       AND season_link.child_kind_code = '{{EntityKindRegistry.VideoSeason.Code}}'
                       AND season_link.is_structural = true
                    INNER JOIN v2.video_season_details season
                        ON season.entity_id = season_link.child_entity_id
                       AND season.season_number = legacy.season_number
                ),
                new_seasons AS (
                    SELECT
                        gen_random_uuid() AS entity_id,
                        legacy.series_id,
                        legacy.season_number,
                        legacy.title,
                        legacy.folder_path,
                        legacy.created_at,
                        legacy.updated_at
                    FROM legacy_seasons legacy
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM existing_seasons existing
                        WHERE existing.series_id = legacy.series_id
                          AND existing.season_number = legacy.season_number
                    )
                ),
                inserted_entities AS (
                    INSERT INTO v2.entities (id, kind_code, title, created_at, updated_at)
                    SELECT entity_id, '{{EntityKindRegistry.VideoSeason.Code}}', title, created_at, updated_at
                    FROM new_seasons
                    ON CONFLICT (id) DO UPDATE SET
                        kind_code = EXCLUDED.kind_code,
                        title = EXCLUDED.title,
                        updated_at = EXCLUDED.updated_at
                    RETURNING id
                ),
                season_entities AS (
                    SELECT * FROM existing_seasons
                    UNION ALL
                    SELECT * FROM new_seasons
                ),
                upsert_details AS (
                    INSERT INTO v2.video_season_details (entity_id, season_number)
                    SELECT entity_id, season_number
                    FROM season_entities
                    ON CONFLICT (entity_id) DO UPDATE SET
                        season_number = EXCLUDED.season_number
                    RETURNING entity_id
                )
                INSERT INTO v2.entity_child_links (parent_entity_id, child_entity_id, child_kind_code, sort_order, is_structural, source, created_at)
                SELECT series_id, entity_id, '{{EntityKindRegistry.VideoSeason.Code}}', season_number, true, 'legacy-import', created_at
                FROM season_entities
                ON CONFLICT (parent_entity_id, child_entity_id, child_kind_code) DO UPDATE SET
                    sort_order = EXCLUDED.sort_order,
                    is_structural = EXCLUDED.is_structural,
                    source = EXCLUDED.source;

                WITH season_folder_paths AS (
                    SELECT
                        season.entity_id,
                        regexp_replace(MIN(episode.file_path), '/[^/]*$', '') AS season_folder_path,
                        MAX(episode.updated_at) AS updated_at
                    FROM public.video_episodes episode
                    INNER JOIN v2.entity_child_links season_link
                        ON season_link.parent_entity_id = episode.series_id
                       AND season_link.child_kind_code = '{{EntityKindRegistry.VideoSeason.Code}}'
                       AND season_link.is_structural = true
                    INNER JOIN v2.video_season_details season
                        ON season.entity_id = season_link.child_entity_id
                       AND season.season_number = episode.season_number
                    WHERE episode.file_path IS NOT NULL
                    GROUP BY season.entity_id
                )
                INSERT INTO v2.entity_sources (entity_id, code, value, updated_at)
                SELECT entity_id, 'folder', season_folder_path, updated_at
                FROM season_folder_paths
                WHERE season_folder_path IS NOT NULL
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                WITH season_folder_paths AS (
                    SELECT
                        season.entity_id,
                        regexp_replace(MIN(episode.file_path), '/[^/]*$', '') AS season_folder_path,
                        MIN(episode.created_at) AS created_at,
                        MAX(episode.updated_at) AS updated_at
                    FROM public.video_episodes episode
                    INNER JOIN v2.entity_child_links season_link
                        ON season_link.parent_entity_id = episode.series_id
                       AND season_link.child_kind_code = '{{EntityKindRegistry.VideoSeason.Code}}'
                       AND season_link.is_structural = true
                    INNER JOIN v2.video_season_details season
                        ON season.entity_id = season_link.child_entity_id
                       AND season.season_number = episode.season_number
                    WHERE episode.file_path IS NOT NULL
                    GROUP BY season.entity_id
                )
                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                SELECT gen_random_uuid(), entity_id, 'source', season_folder_path, NULL, NULL, created_at, updated_at
                FROM season_folder_paths
                WHERE season_folder_path IS NOT NULL
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.video_series_details (entity_id)
                SELECT DISTINCT series_id
                FROM public.video_episodes
                WHERE series_id IS NOT NULL
                  AND season_number IS NOT NULL
                ON CONFLICT (entity_id) DO NOTHING;

                INSERT INTO v2.entity_positions (entity_id, code, value, label, updated_at)
                SELECT season.entity_id, 'season', season.season_number, season.season_number::text, NOW()
                FROM v2.video_season_details season
                INNER JOIN v2.entity_child_links season_link
                    ON season_link.child_entity_id = season.entity_id
                   AND season_link.child_kind_code = '{{EntityKindRegistry.VideoSeason.Code}}'
                   AND season_link.is_structural = true
                WHERE EXISTS (
                    SELECT 1
                    FROM public.video_episodes episode
                    WHERE episode.series_id = season_link.parent_entity_id
                      AND episode.season_number = season.season_number
                )
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    label = EXCLUDED.label,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_child_links (parent_entity_id, child_entity_id, child_kind_code, sort_order, is_structural, source, created_at)
                SELECT season_link.parent_entity_id, season.entity_id, '{{EntityKindRegistry.VideoSeason.Code}}', season.season_number, true, 'legacy-import', NOW()
                FROM v2.video_season_details season
                INNER JOIN v2.entity_child_links season_link
                    ON season_link.child_entity_id = season.entity_id
                   AND season_link.child_kind_code = '{{EntityKindRegistry.VideoSeason.Code}}'
                   AND season_link.is_structural = true
                WHERE EXISTS (
                    SELECT 1
                    FROM public.video_episodes episode
                    WHERE episode.series_id = season_link.parent_entity_id
                      AND episode.season_number = season.season_number
                )
                ON CONFLICT (parent_entity_id, child_entity_id, child_kind_code) DO UPDATE SET
                    sort_order = EXCLUDED.sort_order,
                    is_structural = EXCLUDED.is_structural,
                    source = EXCLUDED.source;

                INSERT INTO v2.entity_playback (entity_id, play_count, play_duration_seconds, resume_seconds, last_played_at, completed_at, updated_at)
                SELECT id, play_count, play_duration, resume_time, last_played_at, NULL, updated_at
                FROM public.video_episodes
                WHERE play_count > 0 OR play_duration > 0 OR resume_time > 0 OR last_played_at IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    play_count = EXCLUDED.play_count,
                    play_duration_seconds = EXCLUDED.play_duration_seconds,
                    resume_seconds = EXCLUDED.resume_seconds,
                    last_played_at = EXCLUDED.last_played_at,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_counters (entity_id, code, value, updated_at)
                SELECT id, 'orgasm', GREATEST(orgasm_count, 0), updated_at
                FROM public.video_episodes
                WHERE orgasm_count > 0
                ON CONFLICT (entity_id, code) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_file_fingerprints (id, entity_id, entity_file_id, algorithm, value, created_at)
                SELECT gen_random_uuid(), episode.id, NULL, hash.algorithm, hash.value, episode.created_at
                FROM public.video_episodes episode
                CROSS JOIN LATERAL (VALUES
                    ('md5', episode.checksum_md5),
                    ('oshash', episode.oshash),
                    ('phash', episode.phash)
                ) AS hash(algorithm, value)
                WHERE hash.value IS NOT NULL
                ON CONFLICT (entity_id, algorithm) DO UPDATE SET
                    value = EXCLUDED.value;

                DELETE FROM v2.entity_child_links link
                USING public.video_episodes episode
                INNER JOIN v2.entity_child_links season_link
                    ON season_link.parent_entity_id = episode.series_id
                   AND season_link.child_kind_code = '{{EntityKindRegistry.VideoSeason.Code}}'
                   AND season_link.is_structural = true
                INNER JOIN v2.video_season_details season
                    ON season.entity_id = season_link.child_entity_id
                   AND season.season_number = episode.season_number
                WHERE link.child_entity_id = episode.id
                  AND link.is_structural = true
                  AND link.parent_entity_id <> season.entity_id;

                INSERT INTO v2.entity_child_links (parent_entity_id, child_entity_id, child_kind_code, sort_order, is_structural, source, created_at)
                SELECT season.entity_id, episode.id, '{{EntityKindRegistry.Video.Code}}', COALESCE(episode.episode_number, episode.absolute_episode_number, 0), true, 'legacy-import', episode.created_at
                FROM public.video_episodes episode
                INNER JOIN v2.entity_child_links season_link
                    ON season_link.parent_entity_id = episode.series_id
                   AND season_link.child_kind_code = '{{EntityKindRegistry.VideoSeason.Code}}'
                   AND season_link.is_structural = true
                INNER JOIN v2.video_season_details season
                    ON season.entity_id = season_link.child_entity_id
                   AND season.season_number = episode.season_number
                ON CONFLICT (parent_entity_id, child_entity_id, child_kind_code) DO UPDATE SET
                    sort_order = EXCLUDED.sort_order,
                    is_structural = EXCLUDED.is_structural,
                    source = EXCLUDED.source;

                INSERT INTO v2.entity_child_links (parent_entity_id, child_entity_id, child_kind_code, sort_order, is_structural, source, created_at)
                SELECT episode.series_id, episode.id, '{{EntityKindRegistry.Video.Code}}', (COALESCE(episode.season_number, 0) * 10000) + COALESCE(episode.episode_number, episode.absolute_episode_number, 0), true, 'legacy-import', episode.created_at
                FROM public.video_episodes episode
                LEFT JOIN v2.entity_child_links season_link
                    ON season_link.parent_entity_id = episode.series_id
                   AND season_link.child_kind_code = '{{EntityKindRegistry.VideoSeason.Code}}'
                   AND season_link.is_structural = true
                LEFT JOIN v2.video_season_details season
                    ON season.entity_id = season_link.child_entity_id
                   AND season.season_number = episode.season_number
                WHERE episode.series_id IS NOT NULL
                  AND season.entity_id IS NULL
                ON CONFLICT (parent_entity_id, child_entity_id, child_kind_code) DO UPDATE SET
                    sort_order = EXCLUDED.sort_order,
                    is_structural = EXCLUDED.is_structural,
                    source = EXCLUDED.source;

                INSERT INTO v2.entity_urls (id, entity_id, url, label, sort_order, created_at)
                SELECT gen_random_uuid(), id, url, NULL, 0, created_at
                FROM public.video_episodes
                WHERE url IS NOT NULL
                ON CONFLICT (entity_id, url) DO UPDATE SET
                    label = EXCLUDED.label,
                    sort_order = EXCLUDED.sort_order;

                INSERT INTO v2.entity_external_ids (id, entity_id, provider, value, url, created_at, updated_at)
                SELECT gen_random_uuid(), episode.id, external.key, external.value, NULL, episode.created_at, episode.updated_at
                FROM public.video_episodes episode
                CROSS JOIN LATERAL jsonb_each_text(COALESCE(episode.external_ids, '{}'::jsonb)) AS external(key, value)
                ON CONFLICT (entity_id, provider) DO UPDATE SET
                    value = EXCLUDED.value,
                    url = EXCLUDED.url,
                    updated_at = EXCLUDED.updated_at;
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

            IF to_regclass('public.video_markers') IS NOT NULL THEN
                INSERT INTO v2.entity_markers (id, entity_id, title, seconds, end_seconds, created_at, updated_at)
                SELECT marker.id, marker.entity_id, marker.title, marker.seconds, marker.end_seconds, marker.created_at, marker.updated_at
                FROM public.video_markers marker
                WHERE EXISTS (SELECT 1 FROM v2.entities entity WHERE entity.id = marker.entity_id AND entity.kind_code = '{{EntityKindRegistry.Video.Code}}')
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    seconds = EXCLUDED.seconds,
                    end_seconds = EXCLUDED.end_seconds,
                    updated_at = EXCLUDED.updated_at;
            END IF;

            IF to_regclass('public.video_subtitles') IS NOT NULL THEN
                INSERT INTO v2.entity_subtitles (
                    id,
                    entity_id,
                    language,
                    label,
                    format,
                    source,
                    storage_path,
                    source_format,
                    source_path,
                    is_default,
                    created_at
                )
                SELECT
                    gen_random_uuid(),
                    subtitle.entity_id,
                    subtitle.language,
                    subtitle.label,
                    subtitle.format,
                    subtitle.source,
                    subtitle.storage_path,
                    subtitle.source_format,
                    subtitle.source_path,
                    subtitle.is_default,
                    subtitle.created_at
                FROM public.video_subtitles subtitle
                WHERE EXISTS (SELECT 1 FROM v2.entities entity WHERE entity.id = subtitle.entity_id AND entity.kind_code = '{{EntityKindRegistry.Video.Code}}')
                ON CONFLICT (entity_id, language, source) DO UPDATE SET
                    label = EXCLUDED.label,
                    format = EXCLUDED.format,
                    storage_path = EXCLUDED.storage_path,
                    source_format = EXCLUDED.source_format,
                    source_path = EXCLUDED.source_path,
                    is_default = EXCLUDED.is_default;
            END IF;

            IF to_regclass('public.video_series_tags') IS NOT NULL THEN
                INSERT INTO v2.entity_relationship_links (entity_id, relationship_code, label, target_entity_id, target_kind_code, sort_order, created_at)
                SELECT series_id, 'tags', 'Tags', tag_id, '{{EntityKindRegistry.Tag.Code}}', 0, now()
                FROM public.video_series_tags
                ON CONFLICT (entity_id, relationship_code, target_entity_id) DO NOTHING;
            END IF;

            IF to_regclass('public.video_movie_tags') IS NOT NULL THEN
                INSERT INTO v2.entity_relationship_links (entity_id, relationship_code, label, target_entity_id, target_kind_code, sort_order, created_at)
                SELECT movie_id, 'tags', 'Tags', tag_id, '{{EntityKindRegistry.Tag.Code}}', 0, now()
                FROM public.video_movie_tags
                ON CONFLICT (entity_id, relationship_code, target_entity_id) DO NOTHING;
            END IF;

            IF to_regclass('public.video_episode_tags') IS NOT NULL THEN
                INSERT INTO v2.entity_relationship_links (entity_id, relationship_code, label, target_entity_id, target_kind_code, sort_order, created_at)
                SELECT episode_id, 'tags', 'Tags', tag_id, '{{EntityKindRegistry.Tag.Code}}', 0, now()
                FROM public.video_episode_tags
                ON CONFLICT (entity_id, relationship_code, target_entity_id) DO NOTHING;
            END IF;

            IF to_regclass('public.video_series_performers') IS NOT NULL THEN
                INSERT INTO v2.entity_relationship_links (entity_id, relationship_code, label, target_entity_id, target_kind_code, sort_order, metadata_json, created_at)
                SELECT series_id, 'cast', 'Cast', performer_id, '{{EntityKindRegistry.Person.Code}}', COALESCE("order", 0), jsonb_build_object('role', '{{EntityKindRegistry.Person.Code}}', 'character', character), now()
                FROM public.video_series_performers
                ON CONFLICT (entity_id, relationship_code, target_entity_id) DO UPDATE SET
                    metadata_json = EXCLUDED.metadata_json,
                    sort_order = EXCLUDED.sort_order;
            END IF;

            IF to_regclass('public.video_movie_performers') IS NOT NULL THEN
                INSERT INTO v2.entity_relationship_links (entity_id, relationship_code, label, target_entity_id, target_kind_code, sort_order, metadata_json, created_at)
                SELECT movie_id, 'cast', 'Cast', performer_id, '{{EntityKindRegistry.Person.Code}}', COALESCE("order", 0), jsonb_build_object('role', '{{EntityKindRegistry.Person.Code}}', 'character', character), now()
                FROM public.video_movie_performers
                ON CONFLICT (entity_id, relationship_code, target_entity_id) DO UPDATE SET
                    metadata_json = EXCLUDED.metadata_json,
                    sort_order = EXCLUDED.sort_order;
            END IF;

            IF to_regclass('public.video_episode_performers') IS NOT NULL THEN
                INSERT INTO v2.entity_relationship_links (entity_id, relationship_code, label, target_entity_id, target_kind_code, sort_order, metadata_json, created_at)
                SELECT episode_id, 'cast', 'Cast', performer_id, '{{EntityKindRegistry.Person.Code}}', COALESCE("order", 0), jsonb_build_object('role', '{{EntityKindRegistry.Person.Code}}', 'character', character), now()
                FROM public.video_episode_performers
                ON CONFLICT (entity_id, relationship_code, target_entity_id) DO UPDATE SET
                    metadata_json = EXCLUDED.metadata_json,
                    sort_order = EXCLUDED.sort_order;
            END IF;

            UPDATE v2.entities child
            SET
                parent_entity_id = link.parent_entity_id,
                sort_order = link.sort_order,
                updated_at = GREATEST(child.updated_at, link.created_at)
            FROM v2.entity_child_links link
            WHERE link.child_entity_id = child.id
              AND link.is_structural = true;
        END $$;
        """;

    /// <summary>
    /// SQL query that reports preview-import counts for migrated video entities, taxonomy entities, and links.
    /// </summary>
    public static readonly string Counts = $$"""
        SELECT
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = '{{EntityKindRegistry.VideoSeries.Code}}') AS series_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = '{{EntityKindRegistry.Video.Code}}') AS videos_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = '{{EntityKindRegistry.Person.Code}}') AS people_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = '{{EntityKindRegistry.Tag.Code}}') AS tags_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = '{{EntityKindRegistry.Studio.Code}}') AS studios_imported,
            ((SELECT COUNT(*)::int FROM v2.entity_child_links WHERE is_structural = true) +
             (SELECT COUNT(*)::int FROM v2.entity_relationship_links) +
             (SELECT COUNT(*)::int FROM v2.entity_markers) +
             (SELECT COUNT(*)::int FROM v2.entity_subtitles)) AS links_imported;
        """;
}
