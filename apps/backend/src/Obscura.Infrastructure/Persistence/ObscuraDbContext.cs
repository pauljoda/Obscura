using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Persistence;

public sealed class ObscuraDbContext : DbContext
{
    public ObscuraDbContext(DbContextOptions<ObscuraDbContext> options)
        : base(options)
    {
    }

    public DbSet<EntityKindRow> EntityKinds => Set<EntityKindRow>();

    public DbSet<EntityRow> Entities => Set<EntityRow>();

    public DbSet<EntityRatingRow> EntityRatings => Set<EntityRatingRow>();

    public DbSet<EntityFlagRow> EntityFlags => Set<EntityFlagRow>();

    public DbSet<EntityTagLinkRow> EntityTagLinks => Set<EntityTagLinkRow>();

    public DbSet<VideoDetailRow> VideoDetails => Set<VideoDetailRow>();

    public DbSet<LibraryRootRow> LibraryRoots => Set<LibraryRootRow>();

    public DbSet<LibrarySettingsRow> LibrarySettings => Set<LibrarySettingsRow>();

    public DbSet<DatabaseBackupRow> DatabaseBackups => Set<DatabaseBackupRow>();

    public DbSet<JobRunRow> JobRuns => Set<JobRunRow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("v2");

        modelBuilder.Entity<EntityKindRow>(entity =>
        {
            entity.ToTable("entity_kinds");
            entity.HasKey(row => row.Code);
            entity.Property(row => row.Code).HasColumnName("code").HasMaxLength(64);
            entity.Property(row => row.DisplayName).HasColumnName("display_name").HasMaxLength(128).IsRequired();
            entity.Property(row => row.Category).HasColumnName("category").HasMaxLength(64).IsRequired();
            entity.HasData(Obscura.Domain.Entities.EntityKinds.All.Select(kind => new EntityKindRow
            {
                Code = kind.Code,
                DisplayName = kind.DisplayName,
                Category = kind.Category.ToString()
            }));
        });

        modelBuilder.Entity<EntityRow>(entity =>
        {
            entity.ToTable("entities");
            entity.HasKey(row => row.Id);
            entity.Property(row => row.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(row => row.KindCode).HasColumnName("kind_code").HasMaxLength(64).IsRequired();
            entity.Property(row => row.Title).HasColumnName("title").HasMaxLength(512).IsRequired();
            entity.Property(row => row.CreatedAt).HasColumnName("created_at");
            entity.Property(row => row.UpdatedAt).HasColumnName("updated_at");
            entity.Property(row => row.DeletedAt).HasColumnName("deleted_at");
            entity.HasIndex(row => new { row.KindCode, row.Title });
            entity.HasOne<EntityKindRow>()
                .WithMany()
                .HasForeignKey(row => row.KindCode)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<EntityRatingRow>(entity =>
        {
            entity.ToTable("entity_ratings");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.Value).HasColumnName("value");
            entity.Property(row => row.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne<EntityRow>()
                .WithOne()
                .HasForeignKey<EntityRatingRow>(row => row.EntityId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.ToTable(table => table.HasCheckConstraint(
                "ck_entity_ratings_value",
                "value >= 0 AND value <= 5"));
        });

        modelBuilder.Entity<EntityFlagRow>(entity =>
        {
            entity.ToTable("entity_flags");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.IsFavorite).HasColumnName("is_favorite");
            entity.Property(row => row.IsNsfw).HasColumnName("is_nsfw");
            entity.Property(row => row.IsOrganized).HasColumnName("is_organized");
            entity.Property(row => row.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne<EntityRow>()
                .WithOne()
                .HasForeignKey<EntityFlagRow>(row => row.EntityId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<EntityTagLinkRow>(entity =>
        {
            entity.ToTable("entity_tag_links");
            entity.HasKey(row => new { row.EntityId, row.TagId });
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.TagId).HasColumnName("tag_id");
            entity.Property(row => row.CreatedAt).HasColumnName("created_at");
            entity.HasOne<EntityRow>()
                .WithMany()
                .HasForeignKey(row => row.EntityId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<EntityRow>()
                .WithMany()
                .HasForeignKey(row => row.TagId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<VideoDetailRow>(entity =>
        {
            entity.ToTable("video_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.Summary).HasColumnName("summary");
            entity.Property(row => row.DurationMs).HasColumnName("duration_ms");
            entity.Property(row => row.Width).HasColumnName("width");
            entity.Property(row => row.Height).HasColumnName("height");
            entity.HasOne<EntityRow>()
                .WithOne()
                .HasForeignKey<VideoDetailRow>(row => row.EntityId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<LibraryRootRow>(entity =>
        {
            entity.ToTable("library_roots");
            entity.HasKey(row => row.Id);
            entity.Property(row => row.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(row => row.Path).HasColumnName("path").IsRequired();
            entity.Property(row => row.Label).HasColumnName("label").IsRequired();
            entity.Property(row => row.Enabled).HasColumnName("enabled");
            entity.Property(row => row.Recursive).HasColumnName("recursive");
            entity.Property(row => row.ScanVideos).HasColumnName("scan_videos");
            entity.Property(row => row.ScanImages).HasColumnName("scan_images");
            entity.Property(row => row.ScanAudio).HasColumnName("scan_audio");
            entity.Property(row => row.ScanBooks).HasColumnName("scan_books");
            entity.Property(row => row.IsNsfw).HasColumnName("is_nsfw");
            entity.Property(row => row.LastScannedAt).HasColumnName("last_scanned_at");
            entity.Property(row => row.CreatedAt).HasColumnName("created_at");
            entity.Property(row => row.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(row => row.Path).IsUnique();
        });

        modelBuilder.Entity<LibrarySettingsRow>(entity =>
        {
            entity.ToTable("library_settings");
            entity.HasKey(row => row.Id);
            entity.Property(row => row.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(row => row.AutoScanEnabled).HasColumnName("auto_scan_enabled");
            entity.Property(row => row.ScanIntervalMinutes).HasColumnName("scan_interval_minutes");
            entity.Property(row => row.AutoGenerateMetadata).HasColumnName("auto_generate_metadata");
            entity.Property(row => row.AutoGenerateFingerprints).HasColumnName("auto_generate_fingerprints");
            entity.Property(row => row.GeneratePhash).HasColumnName("generate_phash");
            entity.Property(row => row.AutoGeneratePreview).HasColumnName("auto_generate_preview");
            entity.Property(row => row.GenerateTrickplay).HasColumnName("generate_trickplay");
            entity.Property(row => row.TrickplayIntervalSeconds).HasColumnName("trickplay_interval_seconds");
            entity.Property(row => row.PreviewClipDurationSeconds).HasColumnName("preview_clip_duration_seconds");
            entity.Property(row => row.ThumbnailQuality).HasColumnName("thumbnail_quality");
            entity.Property(row => row.TrickplayQuality).HasColumnName("trickplay_quality");
            entity.Property(row => row.BackgroundWorkerConcurrency).HasColumnName("background_worker_concurrency");
            entity.Property(row => row.NsfwLanAutoEnable).HasColumnName("nsfw_lan_auto_enable");
            entity.Property(row => row.MetadataStorageDedicated).HasColumnName("metadata_storage_dedicated");
            entity.Property(row => row.SubtitlesAutoEnable).HasColumnName("subtitles_auto_enable");
            entity.Property(row => row.SubtitlesPreferredLanguages).HasColumnName("subtitles_preferred_languages");
            entity.Property(row => row.SubtitleStyle).HasColumnName("subtitle_style");
            entity.Property(row => row.SubtitleFontScale).HasColumnName("subtitle_font_scale");
            entity.Property(row => row.SubtitlePositionPercent).HasColumnName("subtitle_position_percent");
            entity.Property(row => row.SubtitleOpacity).HasColumnName("subtitle_opacity");
            entity.Property(row => row.DefaultPlaybackMode).HasColumnName("default_playback_mode");
            entity.Property(row => row.ShowCastControls).HasColumnName("show_cast_controls");
            entity.Property(row => row.CreatedAt).HasColumnName("created_at");
            entity.Property(row => row.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<DatabaseBackupRow>(entity =>
        {
            entity.ToTable("database_backups");
            entity.HasKey(row => row.Id);
            entity.Property(row => row.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(row => row.BackupPath).HasColumnName("backup_path").IsRequired();
            entity.Property(row => row.Status).HasColumnName("status").HasMaxLength(32).IsRequired();
            entity.Property(row => row.Error).HasColumnName("error");
            entity.Property(row => row.CreatedAt).HasColumnName("created_at");
            entity.Property(row => row.CompletedAt).HasColumnName("completed_at");
        });

        modelBuilder.Entity<JobRunRow>(entity =>
        {
            entity.ToTable("job_runs");
            entity.HasKey(row => row.Id);
            entity.Property(row => row.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(row => row.Type).HasColumnName("type").HasMaxLength(128).IsRequired();
            entity.Property(row => row.Status).HasColumnName("status").HasMaxLength(32).IsRequired();
            entity.Property(row => row.PayloadJson).HasColumnName("payload_json").HasColumnType("jsonb").IsRequired();
            entity.Property(row => row.Priority).HasColumnName("priority");
            entity.Property(row => row.Attempts).HasColumnName("attempts");
            entity.Property(row => row.MaxAttempts).HasColumnName("max_attempts");
            entity.Property(row => row.Progress).HasColumnName("progress");
            entity.Property(row => row.Message).HasColumnName("message");
            entity.Property(row => row.AvailableAt).HasColumnName("available_at");
            entity.Property(row => row.LockedAt).HasColumnName("locked_at");
            entity.Property(row => row.LockedBy).HasColumnName("locked_by").HasMaxLength(128);
            entity.Property(row => row.CreatedAt).HasColumnName("created_at");
            entity.Property(row => row.StartedAt).HasColumnName("started_at");
            entity.Property(row => row.FinishedAt).HasColumnName("finished_at");
            entity.HasIndex(row => new { row.Status, row.AvailableAt, row.Priority });
            entity.ToTable(table =>
            {
                table.HasCheckConstraint("ck_job_runs_progress", "progress >= 0 AND progress <= 100");
                table.HasCheckConstraint("ck_job_runs_attempts", "attempts >= 0 AND max_attempts > 0");
            });
        });
    }
}
