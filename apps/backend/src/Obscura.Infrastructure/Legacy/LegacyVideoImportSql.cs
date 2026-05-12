namespace Obscura.Infrastructure.Legacy;

public static class LegacyVideoImportSql
{
    public const string Import = """
        DO $$
        BEGIN
            IF to_regclass('public.tags') IS NOT NULL THEN
                INSERT INTO v2.entities (id, kind_code, title, created_at, updated_at)
                SELECT id, 'tag', name, created_at, updated_at
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

                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                SELECT gen_random_uuid(), id, 'thumbnail', COALESCE(image_path, image_url), NULL, NULL, created_at, updated_at
                FROM public.tags
                WHERE COALESCE(image_path, image_url) IS NOT NULL
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    updated_at = EXCLUDED.updated_at;
            END IF;

            IF to_regclass('public.studios') IS NOT NULL THEN
                INSERT INTO v2.entities (id, kind_code, title, created_at, updated_at)
                SELECT id, 'studio', name, created_at, updated_at
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

                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                SELECT gen_random_uuid(), id, 'thumbnail', COALESCE(image_path, image_url), NULL, NULL, created_at, updated_at
                FROM public.studios
                WHERE COALESCE(image_path, image_url) IS NOT NULL
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    updated_at = EXCLUDED.updated_at;
            END IF;

            IF to_regclass('public.performers') IS NOT NULL THEN
                INSERT INTO v2.entities (id, kind_code, title, created_at, updated_at)
                SELECT id, 'performer', name, created_at, updated_at
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

                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                SELECT gen_random_uuid(), id, 'thumbnail', COALESCE(image_path, image_url), NULL, NULL, created_at, updated_at
                FROM public.performers
                WHERE COALESCE(image_path, image_url) IS NOT NULL
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    updated_at = EXCLUDED.updated_at;
            END IF;

            IF to_regclass('public.video_series') IS NOT NULL THEN
                INSERT INTO v2.entities (id, kind_code, title, created_at, updated_at)
                SELECT id, 'video-series', COALESCE(custom_name, title), created_at, updated_at
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

                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                SELECT gen_random_uuid(), id, 'thumbnail', poster_path, NULL, NULL, created_at, updated_at
                FROM public.video_series
                WHERE poster_path IS NOT NULL
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_studio_links (entity_id, studio_id, created_at)
                SELECT id, studio_id, updated_at
                FROM public.video_series
                WHERE studio_id IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    studio_id = EXCLUDED.studio_id;

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
                SELECT id, 'video', title, created_at, updated_at
                FROM public.video_movies
                ON CONFLICT (id) DO UPDATE SET
                    kind_code = EXCLUDED.kind_code,
                    title = EXCLUDED.title,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.video_details (entity_id, summary, duration_ms, width, height)
                SELECT id, overview, (duration * 1000)::bigint, width, height
                FROM public.video_movies
                ON CONFLICT (entity_id) DO UPDATE SET
                    summary = EXCLUDED.summary,
                    duration_ms = EXCLUDED.duration_ms,
                    width = EXCLUDED.width,
                    height = EXCLUDED.height;

                INSERT INTO v2.entity_flags (entity_id, is_favorite, is_nsfw, is_organized, updated_at)
                SELECT id, false, is_nsfw, organized, updated_at
                FROM public.video_movies
                ON CONFLICT (entity_id) DO UPDATE SET
                    is_favorite = EXCLUDED.is_favorite,
                    is_nsfw = EXCLUDED.is_nsfw,
                    is_organized = EXCLUDED.is_organized,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                SELECT gen_random_uuid(), id, 'source', file_path, NULL, file_size::bigint, created_at, updated_at
                FROM public.video_movies
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    size_bytes = EXCLUDED.size_bytes,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                SELECT gen_random_uuid(), id, 'thumbnail', COALESCE(card_thumbnail_path, thumbnail_path, poster_path), NULL, NULL, created_at, updated_at
                FROM public.video_movies
                WHERE COALESCE(card_thumbnail_path, thumbnail_path, poster_path) IS NOT NULL
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_studio_links (entity_id, studio_id, created_at)
                SELECT id, studio_id, updated_at
                FROM public.video_movies
                WHERE studio_id IS NOT NULL
                ON CONFLICT (entity_id) DO UPDATE SET
                    studio_id = EXCLUDED.studio_id;

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
                    'video',
                    COALESCE(title, 'Episode ' || COALESCE(episode_number::text, absolute_episode_number::text), regexp_replace(file_path, '^.*/', '')),
                    created_at,
                    updated_at
                FROM public.video_episodes
                ON CONFLICT (id) DO UPDATE SET
                    kind_code = EXCLUDED.kind_code,
                    title = EXCLUDED.title,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.video_details (entity_id, summary, duration_ms, width, height)
                SELECT id, overview, (duration * 1000)::bigint, width, height
                FROM public.video_episodes
                ON CONFLICT (entity_id) DO UPDATE SET
                    summary = EXCLUDED.summary,
                    duration_ms = EXCLUDED.duration_ms,
                    width = EXCLUDED.width,
                    height = EXCLUDED.height;

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

                INSERT INTO v2.entity_files (id, entity_id, role, path, mime_type, size_bytes, created_at, updated_at)
                SELECT gen_random_uuid(), id, 'thumbnail', COALESCE(card_thumbnail_path, thumbnail_path, still_path), NULL, NULL, created_at, updated_at
                FROM public.video_episodes
                WHERE COALESCE(card_thumbnail_path, thumbnail_path, still_path) IS NOT NULL
                ON CONFLICT (entity_id, role) DO UPDATE SET
                    path = EXCLUDED.path,
                    updated_at = EXCLUDED.updated_at;

                INSERT INTO v2.entity_hierarchy_links (parent_entity_id, child_entity_id, relationship, sort_order, created_at)
                SELECT series_id, id, 'episode', (season_number * 10000) + COALESCE(episode_number, absolute_episode_number, 0), created_at
                FROM public.video_episodes
                ON CONFLICT (parent_entity_id, child_entity_id, relationship) DO UPDATE SET
                    sort_order = EXCLUDED.sort_order;

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
                WHERE EXISTS (SELECT 1 FROM v2.entities entity WHERE entity.id = marker.entity_id AND entity.kind_code = 'video')
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
                WHERE EXISTS (SELECT 1 FROM v2.entities entity WHERE entity.id = subtitle.entity_id AND entity.kind_code = 'video')
                ON CONFLICT (entity_id, language, source) DO UPDATE SET
                    label = EXCLUDED.label,
                    format = EXCLUDED.format,
                    storage_path = EXCLUDED.storage_path,
                    source_format = EXCLUDED.source_format,
                    source_path = EXCLUDED.source_path,
                    is_default = EXCLUDED.is_default;
            END IF;

            IF to_regclass('public.video_series_tags') IS NOT NULL THEN
                INSERT INTO v2.entity_tag_links (entity_id, tag_id, created_at)
                SELECT series_id, tag_id, now()
                FROM public.video_series_tags
                ON CONFLICT (entity_id, tag_id) DO NOTHING;
            END IF;

            IF to_regclass('public.video_movie_tags') IS NOT NULL THEN
                INSERT INTO v2.entity_tag_links (entity_id, tag_id, created_at)
                SELECT movie_id, tag_id, now()
                FROM public.video_movie_tags
                ON CONFLICT (entity_id, tag_id) DO NOTHING;
            END IF;

            IF to_regclass('public.video_episode_tags') IS NOT NULL THEN
                INSERT INTO v2.entity_tag_links (entity_id, tag_id, created_at)
                SELECT episode_id, tag_id, now()
                FROM public.video_episode_tags
                ON CONFLICT (entity_id, tag_id) DO NOTHING;
            END IF;

            IF to_regclass('public.video_series_performers') IS NOT NULL THEN
                INSERT INTO v2.entity_credit_links (entity_id, person_entity_id, role, character, sort_order, created_at)
                SELECT series_id, performer_id, 'performer', character, COALESCE("order", 0), now()
                FROM public.video_series_performers
                ON CONFLICT (entity_id, person_entity_id, role) DO UPDATE SET
                    character = EXCLUDED.character,
                    sort_order = EXCLUDED.sort_order;
            END IF;

            IF to_regclass('public.video_movie_performers') IS NOT NULL THEN
                INSERT INTO v2.entity_credit_links (entity_id, person_entity_id, role, character, sort_order, created_at)
                SELECT movie_id, performer_id, 'performer', character, COALESCE("order", 0), now()
                FROM public.video_movie_performers
                ON CONFLICT (entity_id, person_entity_id, role) DO UPDATE SET
                    character = EXCLUDED.character,
                    sort_order = EXCLUDED.sort_order;
            END IF;

            IF to_regclass('public.video_episode_performers') IS NOT NULL THEN
                INSERT INTO v2.entity_credit_links (entity_id, person_entity_id, role, character, sort_order, created_at)
                SELECT episode_id, performer_id, 'performer', character, COALESCE("order", 0), now()
                FROM public.video_episode_performers
                ON CONFLICT (entity_id, person_entity_id, role) DO UPDATE SET
                    character = EXCLUDED.character,
                    sort_order = EXCLUDED.sort_order;
            END IF;
        END $$;
        """;

    public const string Counts = """
        SELECT
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = 'video-series') AS series_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = 'video') AS videos_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = 'performer') AS performers_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = 'tag') AS tags_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = 'studio') AS studios_imported,
            ((SELECT COUNT(*)::int FROM v2.entity_hierarchy_links) +
             (SELECT COUNT(*)::int FROM v2.entity_credit_links) +
             (SELECT COUNT(*)::int FROM v2.entity_studio_links) +
             (SELECT COUNT(*)::int FROM v2.entity_markers) +
             (SELECT COUNT(*)::int FROM v2.entity_subtitles)) AS links_imported;
        """;
}
