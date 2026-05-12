namespace Obscura.Infrastructure.FreshStart;

public static class FreshStartSql
{
    public const string PreserveConfiguration = """
        TRUNCATE TABLE
            v2.entity_hierarchy_links,
            v2.entity_tag_links,
            v2.entity_files,
            v2.video_details,
            v2.entity_flags,
            v2.entity_ratings,
            v2.entities,
            v2.library_roots,
            v2.library_settings
        RESTART IDENTITY CASCADE;

        INSERT INTO v2.library_settings (
            id,
            auto_scan_enabled,
            scan_interval_minutes,
            auto_generate_metadata,
            auto_generate_fingerprints,
            generate_phash,
            auto_generate_preview,
            generate_trickplay,
            trickplay_interval_seconds,
            preview_clip_duration_seconds,
            thumbnail_quality,
            trickplay_quality,
            background_worker_concurrency,
            nsfw_lan_auto_enable,
            hide_nsfw,
            metadata_storage_dedicated,
            subtitles_auto_enable,
            subtitles_preferred_languages,
            subtitle_style,
            subtitle_font_scale,
            subtitle_position_percent,
            subtitle_opacity,
            default_playback_mode,
            show_cast_controls,
            created_at,
            updated_at
        )
        SELECT
            id,
            auto_scan_enabled,
            scan_interval_minutes,
            auto_generate_metadata,
            auto_generate_fingerprints,
            generate_phash,
            auto_generate_preview,
            generate_trickplay,
            trickplay_interval_seconds,
            preview_clip_duration_seconds,
            thumbnail_quality,
            trickplay_quality,
            background_worker_concurrency,
            nsfw_lan_auto_enable,
            false,
            metadata_storage_dedicated,
            subtitles_auto_enable,
            subtitles_preferred_languages,
            subtitle_style,
            subtitle_font_scale,
            subtitle_position_percent,
            subtitle_opacity,
            default_playback_mode,
            show_cast_controls,
            created_at,
            updated_at
        FROM public.library_settings
        ORDER BY created_at
        LIMIT 1;

        INSERT INTO v2.library_roots (
            id,
            path,
            label,
            enabled,
            recursive,
            scan_videos,
            scan_images,
            scan_audio,
            scan_books,
            is_nsfw,
            last_scanned_at,
            created_at,
            updated_at
        )
        SELECT
            id,
            path,
            label,
            enabled,
            recursive,
            scan_videos,
            scan_images,
            scan_audio,
            scan_books,
            is_nsfw,
            last_scanned_at,
            created_at,
            updated_at
        FROM public.library_roots
        ORDER BY path;
        """;

    public const string CountPreservedLibraryRoots = """
        SELECT COUNT(*) FROM v2.library_roots;
        """;

    public const string HasPreservedSettings = """
        SELECT EXISTS (SELECT 1 FROM v2.library_settings);
        """;
}
