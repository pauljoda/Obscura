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
        END $$;
        """;

    public const string Counts = """
        SELECT
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = 'video-series') AS series_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = 'video') AS videos_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = 'tag') AS tags_imported,
            (SELECT COUNT(*)::int FROM v2.entities WHERE kind_code = 'studio') AS studios_imported,
            (SELECT COUNT(*)::int FROM v2.entity_hierarchy_links) AS links_imported;
        """;
}
