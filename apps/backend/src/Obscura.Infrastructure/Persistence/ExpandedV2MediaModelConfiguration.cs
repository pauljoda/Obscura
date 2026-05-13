using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Persistence;

internal static partial class ExpandedV2ModelConfiguration
{
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
}
