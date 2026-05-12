using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Persistence;

internal static class ExpandedV2ModelConfiguration
{
    public static void ConfigureExpandedV2Model(this ModelBuilder modelBuilder)
    {
        ConfigureEntityCapabilities(modelBuilder);
        ConfigureMediaDetails(modelBuilder);
        ConfigureTaxonomyDetails(modelBuilder);
        ConfigureCollections(modelBuilder);
        ConfigureSystemTables(modelBuilder);
    }

    private static void ConfigureEntityCapabilities(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<EntityAliasRow>(entity =>
        {
            entity.ToTable("entity_aliases");
            entity.HasKey(row => row.Id);
            entity.Property(row => row.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.Value).HasColumnName("value").HasMaxLength(512).IsRequired();
            entity.Property(row => row.AliasType).HasColumnName("alias_type").HasMaxLength(64);
            entity.Property(row => row.SortOrder).HasColumnName("sort_order");
            entity.Property(row => row.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(row => new { row.EntityId, row.Value }).IsUnique();
            entity.HasOne<EntityRow>().WithMany().HasForeignKey(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<EntityPlaybackRow>(entity =>
        {
            entity.ToTable("entity_playback");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.PlayCount).HasColumnName("play_count");
            entity.Property(row => row.PlayDurationSeconds).HasColumnName("play_duration_seconds");
            entity.Property(row => row.ResumeSeconds).HasColumnName("resume_seconds");
            entity.Property(row => row.LastPlayedAt).HasColumnName("last_played_at");
            entity.Property(row => row.CompletedAt).HasColumnName("completed_at");
            entity.Property(row => row.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<EntityPlaybackRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<EntityCounterRow>(entity =>
        {
            entity.ToTable("entity_counters");
            entity.HasKey(row => new { row.EntityId, row.Code });
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.Code).HasColumnName("code").HasMaxLength(64).IsRequired();
            entity.Property(row => row.Value).HasColumnName("value");
            entity.Property(row => row.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne<EntityRow>().WithMany().HasForeignKey(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
            entity.ToTable(table => table.HasCheckConstraint("ck_entity_counters_value", "value >= 0"));
        });

        modelBuilder.Entity<EntityFileFingerprintRow>(entity =>
        {
            entity.ToTable("entity_file_fingerprints");
            entity.HasKey(row => row.Id);
            entity.Property(row => row.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.EntityFileId).HasColumnName("entity_file_id");
            entity.Property(row => row.Algorithm).HasColumnName("algorithm").HasMaxLength(64).IsRequired();
            entity.Property(row => row.Value).HasColumnName("value").IsRequired();
            entity.Property(row => row.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(row => new { row.EntityId, row.Algorithm }).IsUnique();
            entity.HasOne<EntityRow>().WithMany().HasForeignKey(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<EntityFileRow>().WithMany().HasForeignKey(row => row.EntityFileId).OnDelete(DeleteBehavior.SetNull);
        });
    }

    private static void ConfigureMediaDetails(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<VideoSeriesDetailRow>(entity =>
        {
            entity.ToTable("video_series_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.LibraryRootId).HasColumnName("library_root_id");
            entity.Property(row => row.FolderPath).HasColumnName("folder_path");
            entity.Property(row => row.RelativePath).HasColumnName("relative_path");
            entity.Property(row => row.SortTitle).HasColumnName("sort_title");
            entity.Property(row => row.OriginalTitle).HasColumnName("original_title");
            entity.Property(row => row.Overview).HasColumnName("overview");
            entity.Property(row => row.Tagline).HasColumnName("tagline");
            entity.Property(row => row.Status).HasColumnName("status");
            entity.Property(row => row.FirstAirDate).HasColumnName("first_air_date");
            entity.Property(row => row.EndAirDate).HasColumnName("end_air_date");
            entity.Property(row => row.ContentRating).HasColumnName("content_rating");
            entity.Property(row => row.RenderingMode)
                .HasColumnName("rendering_mode")
                .HasMaxLength(64)
                .HasConversion(value => value.ToCode(), value => value.DecodeAs<VideoSeriesRenderingMode>());
            entity.HasIndex(row => row.FolderPath).IsUnique();
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<VideoSeriesDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<LibraryRootRow>().WithMany().HasForeignKey(row => row.LibraryRootId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<VideoSeasonDetailRow>(entity =>
        {
            entity.ToTable("video_season_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.SeriesEntityId).HasColumnName("series_entity_id");
            entity.Property(row => row.SeasonNumber).HasColumnName("season_number");
            entity.Property(row => row.FolderPath).HasColumnName("folder_path");
            entity.Property(row => row.Overview).HasColumnName("overview");
            entity.Property(row => row.AirDate).HasColumnName("air_date");
            entity.HasIndex(row => new { row.SeriesEntityId, row.SeasonNumber }).IsUnique();
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<VideoSeasonDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<EntityRow>().WithMany().HasForeignKey(row => row.SeriesEntityId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GalleryDetailRow>(entity =>
        {
            entity.ToTable("gallery_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.Details).HasColumnName("details");
            entity.Property(row => row.Date).HasColumnName("date");
            entity.Property(row => row.GalleryType)
                .HasColumnName("gallery_type")
                .HasMaxLength(64)
                .HasConversion(value => value.ToCode(), value => value.DecodeAs<GalleryType>());
            entity.Property(row => row.FolderPath).HasColumnName("folder_path");
            entity.Property(row => row.ZipFilePath).HasColumnName("zip_file_path");
            entity.Property(row => row.Photographer).HasColumnName("photographer");
            entity.Property(row => row.CoverImageEntityId).HasColumnName("cover_image_entity_id");
            entity.Property(row => row.ImageCount).HasColumnName("image_count");
            entity.HasIndex(row => row.FolderPath);
            entity.HasIndex(row => row.ZipFilePath);
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<GalleryDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ImageDetailRow>(entity =>
        {
            entity.ToTable("image_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.Details).HasColumnName("details");
            entity.Property(row => row.Date).HasColumnName("date");
            entity.Property(row => row.FilePath).HasColumnName("file_path");
            entity.Property(row => row.FileSizeBytes).HasColumnName("file_size_bytes");
            entity.Property(row => row.Width).HasColumnName("width");
            entity.Property(row => row.Height).HasColumnName("height");
            entity.Property(row => row.Format).HasColumnName("format");
            entity.Property(row => row.SortOrder).HasColumnName("sort_order");
            entity.HasIndex(row => row.FilePath).IsUnique();
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<ImageDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
        });

        ConfigureBooks(modelBuilder);
        ConfigureAudio(modelBuilder);
    }

    private static void ConfigureBooks(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<BookDetailRow>(entity =>
        {
            entity.ToTable("book_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.LibraryRootId).HasColumnName("library_root_id");
            entity.Property(row => row.BookType)
                .HasColumnName("book_type")
                .HasMaxLength(64)
                .HasConversion(value => value.ToCode(), value => value.DecodeAs<BookType>());
            entity.Property(row => row.SortTitle).HasColumnName("sort_title");
            entity.Property(row => row.Summary).HasColumnName("summary");
            entity.Property(row => row.Date).HasColumnName("date");
            entity.Property(row => row.FolderPath).HasColumnName("folder_path");
            entity.Property(row => row.RelativePath).HasColumnName("relative_path");
            entity.Property(row => row.CoverPageEntityId).HasColumnName("cover_page_entity_id");
            entity.Property(row => row.CoverImagePath).HasColumnName("cover_image_path");
            entity.Property(row => row.PageCount).HasColumnName("page_count");
            entity.Property(row => row.ChapterCount).HasColumnName("chapter_count");
            entity.HasIndex(row => new { row.LibraryRootId, row.RelativePath }).IsUnique();
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<BookDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<LibraryRootRow>().WithMany().HasForeignKey(row => row.LibraryRootId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<BookVolumeDetailRow>(entity =>
        {
            entity.ToTable("book_volume_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.BookEntityId).HasColumnName("book_entity_id");
            entity.Property(row => row.VolumeNumber).HasColumnName("volume_number");
            entity.Property(row => row.FolderPath).HasColumnName("folder_path");
            entity.Property(row => row.RelativePath).HasColumnName("relative_path");
            entity.Property(row => row.CoverImagePath).HasColumnName("cover_image_path");
            entity.HasIndex(row => new { row.BookEntityId, row.VolumeNumber }).IsUnique();
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<BookVolumeDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<EntityRow>().WithMany().HasForeignKey(row => row.BookEntityId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BookChapterDetailRow>(entity =>
        {
            entity.ToTable("book_chapter_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.BookEntityId).HasColumnName("book_entity_id");
            entity.Property(row => row.VolumeEntityId).HasColumnName("volume_entity_id");
            entity.Property(row => row.ChapterNumber).HasColumnName("chapter_number");
            entity.Property(row => row.ArchivePath).HasColumnName("archive_path");
            entity.Property(row => row.RelativePath).HasColumnName("relative_path");
            entity.Property(row => row.PageCount).HasColumnName("page_count");
            entity.Property(row => row.CoverPageEntityId).HasColumnName("cover_page_entity_id");
            entity.HasIndex(row => row.ArchivePath).IsUnique();
            entity.HasIndex(row => new { row.BookEntityId, row.ChapterNumber });
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<BookChapterDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<EntityRow>().WithMany().HasForeignKey(row => row.BookEntityId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BookPageDetailRow>(entity =>
        {
            entity.ToTable("book_page_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.BookEntityId).HasColumnName("book_entity_id");
            entity.Property(row => row.ChapterEntityId).HasColumnName("chapter_entity_id");
            entity.Property(row => row.FilePath).HasColumnName("file_path").IsRequired();
            entity.Property(row => row.FileSizeBytes).HasColumnName("file_size_bytes");
            entity.Property(row => row.Width).HasColumnName("width");
            entity.Property(row => row.Height).HasColumnName("height");
            entity.Property(row => row.Format).HasColumnName("format");
            entity.Property(row => row.SortOrder).HasColumnName("sort_order");
            entity.HasIndex(row => row.FilePath).IsUnique();
            entity.HasIndex(row => new { row.ChapterEntityId, row.SortOrder });
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<BookPageDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<EntityRow>().WithMany().HasForeignKey(row => row.BookEntityId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<EntityRow>().WithMany().HasForeignKey(row => row.ChapterEntityId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BookReadProgressRow>(entity =>
        {
            entity.ToTable("book_read_progress");
            entity.HasKey(row => row.BookEntityId);
            entity.Property(row => row.BookEntityId).HasColumnName("book_entity_id");
            entity.Property(row => row.ChapterEntityId).HasColumnName("chapter_entity_id");
            entity.Property(row => row.PageIndex).HasColumnName("page_index");
            entity.Property(row => row.PageCount).HasColumnName("page_count");
            entity.Property(row => row.ReaderMode)
                .HasColumnName("reader_mode")
                .HasMaxLength(64)
                .HasConversion(value => value.ToCode(), value => value.DecodeAs<ReaderMode>());
            entity.Property(row => row.CompletedAt).HasColumnName("completed_at");
            entity.Property(row => row.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<BookReadProgressRow>(row => row.BookEntityId).OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureAudio(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AudioLibraryDetailRow>(entity =>
        {
            entity.ToTable("audio_library_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.Details).HasColumnName("details");
            entity.Property(row => row.Date).HasColumnName("date");
            entity.Property(row => row.FolderPath).HasColumnName("folder_path");
            entity.Property(row => row.ParentLibraryEntityId).HasColumnName("parent_library_entity_id");
            entity.Property(row => row.TrackCount).HasColumnName("track_count");
            entity.HasIndex(row => row.FolderPath).IsUnique();
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<AudioLibraryDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AudioTrackDetailRow>(entity =>
        {
            entity.ToTable("audio_track_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.Details).HasColumnName("details");
            entity.Property(row => row.Date).HasColumnName("date");
            entity.Property(row => row.DurationSeconds).HasColumnName("duration_seconds");
            entity.Property(row => row.BitRate).HasColumnName("bit_rate");
            entity.Property(row => row.SampleRate).HasColumnName("sample_rate");
            entity.Property(row => row.Channels).HasColumnName("channels");
            entity.Property(row => row.Codec).HasColumnName("codec");
            entity.Property(row => row.Container).HasColumnName("container");
            entity.Property(row => row.EmbeddedArtist).HasColumnName("embedded_artist");
            entity.Property(row => row.EmbeddedAlbum).HasColumnName("embedded_album");
            entity.Property(row => row.TrackNumber).HasColumnName("track_number");
            entity.Property(row => row.WaveformPath).HasColumnName("waveform_path");
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<AudioTrackDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureTaxonomyDetails(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PersonDetailRow>(entity =>
        {
            entity.ToTable("person_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.Disambiguation).HasColumnName("disambiguation");
            entity.Property(row => row.Gender).HasColumnName("gender");
            entity.Property(row => row.Birthdate).HasColumnName("birthdate");
            entity.Property(row => row.Country).HasColumnName("country");
            entity.Property(row => row.Ethnicity).HasColumnName("ethnicity");
            entity.Property(row => row.EyeColor).HasColumnName("eye_color");
            entity.Property(row => row.HairColor).HasColumnName("hair_color");
            entity.Property(row => row.Height).HasColumnName("height");
            entity.Property(row => row.Weight).HasColumnName("weight");
            entity.Property(row => row.Measurements).HasColumnName("measurements");
            entity.Property(row => row.Tattoos).HasColumnName("tattoos");
            entity.Property(row => row.Piercings).HasColumnName("piercings");
            entity.Property(row => row.CareerStart).HasColumnName("career_start");
            entity.Property(row => row.CareerEnd).HasColumnName("career_end");
            entity.Property(row => row.Details).HasColumnName("details");
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<PersonDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<StudioDetailRow>(entity =>
        {
            entity.ToTable("studio_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.Description).HasColumnName("description");
            entity.Property(row => row.ParentStudioEntityId).HasColumnName("parent_studio_entity_id");
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<StudioDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TagDetailRow>(entity =>
        {
            entity.ToTable("tag_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.Description).HasColumnName("description");
            entity.Property(row => row.ParentTagEntityId).HasColumnName("parent_tag_entity_id");
            entity.Property(row => row.IgnoreAutoTag).HasColumnName("ignore_auto_tag");
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<TagDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureCollections(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CollectionDetailRow>(entity =>
        {
            entity.ToTable("collection_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.Description).HasColumnName("description");
            entity.Property(row => row.Mode)
                .HasColumnName("mode")
                .HasMaxLength(64)
                .HasConversion(value => value.ToCode(), value => value.DecodeAs<CollectionMode>());
            entity.Property(row => row.RuleTreeJson).HasColumnName("rule_tree_json").HasColumnType("jsonb");
            entity.Property(row => row.ItemCount).HasColumnName("item_count");
            entity.Property(row => row.CoverMode)
                .HasColumnName("cover_mode")
                .HasMaxLength(64)
                .HasConversion(value => value.ToCode(), value => value.DecodeAs<CollectionCoverMode>());
            entity.Property(row => row.CoverImagePath).HasColumnName("cover_image_path");
            entity.Property(row => row.CoverItemEntityId).HasColumnName("cover_item_entity_id");
            entity.Property(row => row.SlideshowDurationSeconds).HasColumnName("slideshow_duration_seconds");
            entity.Property(row => row.SlideshowAutoAdvance).HasColumnName("slideshow_auto_advance");
            entity.Property(row => row.LastRefreshedAt).HasColumnName("last_refreshed_at");
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<CollectionDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CollectionItemDetailRow>(entity =>
        {
            entity.ToTable("collection_item_details");
            entity.HasKey(row => row.Id);
            entity.Property(row => row.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(row => row.CollectionEntityId).HasColumnName("collection_entity_id");
            entity.Property(row => row.ItemEntityId).HasColumnName("item_entity_id");
            entity.Property(row => row.Source)
                .HasColumnName("source")
                .HasMaxLength(64)
                .HasConversion(value => value.ToCode(), value => value.DecodeAs<CollectionItemSource>());
            entity.Property(row => row.SortOrder).HasColumnName("sort_order");
            entity.Property(row => row.AddedAt).HasColumnName("added_at");
            entity.HasIndex(row => new { row.CollectionEntityId, row.ItemEntityId }).IsUnique();
            entity.HasOne<EntityRow>().WithMany().HasForeignKey(row => row.CollectionEntityId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<EntityRow>().WithMany().HasForeignKey(row => row.ItemEntityId).OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureSystemTables(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<MediaFileIgnoreRow>(entity =>
        {
            entity.ToTable("media_file_ignores");
            entity.HasKey(row => row.Path);
            entity.Property(row => row.Path).HasColumnName("path");
            entity.Property(row => row.EntityKindCode).HasColumnName("entity_kind_code").HasMaxLength(64);
            entity.Property(row => row.Reason).HasColumnName("reason").HasMaxLength(128);
            entity.Property(row => row.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(row => row.EntityKindCode);
        });

        modelBuilder.Entity<UiPreferenceRow>(entity =>
        {
            entity.ToTable("ui_prefs");
            entity.HasKey(row => row.Key);
            entity.Property(row => row.Key).HasColumnName("key");
            entity.Property(row => row.ValueJson).HasColumnName("value_json").HasColumnType("jsonb");
            entity.Property(row => row.UpdatedAt).HasColumnName("updated_at");
        });

        modelBuilder.Entity<ProviderConfigRow>(entity =>
        {
            entity.ToTable("provider_configs");
            entity.HasKey(row => row.Id);
            entity.Property(row => row.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(row => row.ProviderCode).HasColumnName("provider_code").HasMaxLength(128).IsRequired();
            entity.Property(row => row.DisplayName).HasColumnName("display_name").HasMaxLength(256).IsRequired();
            entity.Property(row => row.ProviderType)
                .HasColumnName("provider_type")
                .HasMaxLength(64)
                .HasConversion(value => value.ToCode(), value => value.DecodeAs<ProviderType>())
                .IsRequired();
            entity.Property(row => row.SettingsJson).HasColumnName("settings_json").HasColumnType("jsonb");
            entity.Property(row => row.Enabled).HasColumnName("enabled");
            entity.Property(row => row.IsNsfw).HasColumnName("is_nsfw");
            entity.Property(row => row.CreatedAt).HasColumnName("created_at");
            entity.Property(row => row.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(row => row.ProviderCode).IsUnique();
        });

        modelBuilder.Entity<ProviderCredentialRow>(entity =>
        {
            entity.ToTable("provider_credentials");
            entity.HasKey(row => row.Id);
            entity.Property(row => row.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(row => row.ProviderConfigId).HasColumnName("provider_config_id");
            entity.Property(row => row.CredentialKey).HasColumnName("credential_key").HasMaxLength(128).IsRequired();
            entity.Property(row => row.EncryptedValue).HasColumnName("encrypted_value").IsRequired();
            entity.Property(row => row.CreatedAt).HasColumnName("created_at");
            entity.Property(row => row.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(row => new { row.ProviderConfigId, row.CredentialKey }).IsUnique();
            entity.HasOne<ProviderConfigRow>().WithMany().HasForeignKey(row => row.ProviderConfigId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<IdentifyResultRow>(entity =>
        {
            entity.ToTable("identify_results");
            entity.HasKey(row => row.Id);
            entity.Property(row => row.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.ProviderConfigId).HasColumnName("provider_config_id");
            entity.Property(row => row.Action).HasColumnName("action").HasMaxLength(128).IsRequired();
            entity.Property(row => row.Status)
                .HasColumnName("status")
                .HasMaxLength(64)
                .HasConversion(value => value.ToCode(), value => value.DecodeAs<IdentifyResultStatus>())
                .IsRequired();
            entity.Property(row => row.MatchType).HasColumnName("match_type").HasMaxLength(64);
            entity.Property(row => row.RawResultJson).HasColumnName("raw_result_json").HasColumnType("jsonb");
            entity.Property(row => row.ProposedResultJson).HasColumnName("proposed_result_json").HasColumnType("jsonb");
            entity.Property(row => row.AppliedAt).HasColumnName("applied_at");
            entity.Property(row => row.CreatedAt).HasColumnName("created_at");
            entity.Property(row => row.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(row => new { row.EntityId, row.Status });
            entity.HasOne<EntityRow>().WithMany().HasForeignKey(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<ProviderConfigRow>().WithMany().HasForeignKey(row => row.ProviderConfigId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<FingerprintSubmissionRow>(entity =>
        {
            entity.ToTable("fingerprint_submissions");
            entity.HasKey(row => row.Id);
            entity.Property(row => row.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.ProviderConfigId).HasColumnName("provider_config_id");
            entity.Property(row => row.Algorithm).HasColumnName("algorithm").HasMaxLength(64).IsRequired();
            entity.Property(row => row.Hash).HasColumnName("hash").IsRequired();
            entity.Property(row => row.Status)
                .HasColumnName("status")
                .HasMaxLength(64)
                .HasConversion(value => value.ToCode(), value => value.DecodeAs<FingerprintSubmissionStatus>())
                .IsRequired();
            entity.Property(row => row.Error).HasColumnName("error");
            entity.Property(row => row.SubmittedAt).HasColumnName("submitted_at");
            entity.HasIndex(row => new { row.EntityId, row.Algorithm, row.Hash }).IsUnique();
            entity.HasOne<EntityRow>().WithMany().HasForeignKey(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<ProviderConfigRow>().WithMany().HasForeignKey(row => row.ProviderConfigId).OnDelete(DeleteBehavior.SetNull);
        });
    }
}
