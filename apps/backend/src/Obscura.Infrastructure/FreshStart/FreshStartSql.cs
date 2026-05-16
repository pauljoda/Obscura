namespace Obscura.Infrastructure.FreshStart;

/// <summary>
/// Provides SQL statements used by the v2 fresh-start flow to preserve configuration while resetting media data.
/// </summary>
public static class FreshStartSql
{
    /// <summary>
    /// SQL block that copies legacy settings and library roots into v2 preservation tables.
    /// </summary>
    public const string PreserveConfiguration = """
        TRUNCATE TABLE
            v2.entity_hierarchy_links,
            v2.entity_credit_links,
            v2.entity_studio_links,
            v2.entity_tag_links,
            v2.entity_external_ids,
            v2.entity_urls,
            v2.entity_subtitles,
            v2.entity_markers,
            v2.entity_file_fingerprints,
            v2.entity_files,
            v2.entity_counters,
            v2.entity_stats,
            v2.entity_dates,
            v2.entity_technical,
            v2.entity_sources,
            v2.entity_progress,
            v2.entity_positions,
            v2.entity_classifications,
            v2.entity_playback,
            v2.entity_descriptions,
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

    /// <summary>
    /// SQL block that truncates every v2 table including settings and library roots.
    /// Used by development-mode gate re-arming to give a completely clean slate — no
    /// backup is created and no configuration is preserved.
    /// </summary>
    public const string ResetAllV2Data = """
        TRUNCATE TABLE
            v2.entity_hierarchy_links,
            v2.entity_credit_links,
            v2.entity_studio_links,
            v2.entity_tag_links,
            v2.entity_external_ids,
            v2.entity_urls,
            v2.entity_subtitles,
            v2.entity_markers,
            v2.entity_file_fingerprints,
            v2.entity_files,
            v2.entity_counters,
            v2.entity_stats,
            v2.entity_dates,
            v2.entity_technical,
            v2.entity_sources,
            v2.entity_progress,
            v2.entity_positions,
            v2.entity_classifications,
            v2.entity_playback,
            v2.entity_descriptions,
            v2.video_details,
            v2.entity_flags,
            v2.entity_ratings,
            v2.entities,
            v2.library_roots,
            v2.library_settings
        RESTART IDENTITY CASCADE;
        """;

    /// <summary>
    /// Deletes generated entity_files rows whose role is anything other than <c>source</c>.
    /// After a fresh migration, source media files and custom legacy artwork should survive.
    /// Generated thumbnails, previews, sprites, and trickplay frames are regenerated by
    /// the first library rescan. This cleanup catches stale rows left by older import SQL
    /// that may have been compiled into a running binary.
    /// </summary>
    public const string PurgeNonSourceEntityFiles = """
        DELETE FROM v2.entity_files
        WHERE role <> 'source'
          AND source <> 'custom';
        """;

    /// <summary>
    /// SQL query that counts preserved v2 library roots after the fresh-start preparation step.
    /// </summary>
    public const string CountPreservedLibraryRoots = """
        SELECT COUNT(*) FROM v2.library_roots;
        """;

    /// <summary>
    /// SQL query that reports whether a preserved v2 library-settings row exists.
    /// </summary>
    public const string HasPreservedSettings = """
        SELECT EXISTS (SELECT 1 FROM v2.library_settings);
        """;
}
