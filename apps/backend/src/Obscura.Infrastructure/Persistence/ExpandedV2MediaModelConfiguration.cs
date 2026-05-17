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
            entity.Property(row => row.Status).HasColumnName("status");
            entity.Property(row => row.RenderingMode)
                .HasColumnName("rendering_mode")
                .HasMaxLength(64)
                .HasConversion(value => value.ToCode(), value => value.DecodeAs<VideoSeriesRenderingMode>());
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<VideoSeriesDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<VideoSeasonDetailRow>(entity =>
        {
            entity.ToTable("video_season_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.SeasonNumber).HasColumnName("season_number");
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<VideoSeasonDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GalleryDetailRow>(entity =>
        {
            entity.ToTable("gallery_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.GalleryType)
                .HasColumnName("gallery_type")
                .HasMaxLength(64)
                .HasConversion(value => value.ToCode(), value => value.DecodeAs<GalleryType>());
            entity.Property(row => row.CoverImageEntityId).HasColumnName("cover_image_entity_id");
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<GalleryDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ImageDetailRow>(entity =>
        {
            entity.ToTable("image_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
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
            entity.Property(row => row.BookType)
                .HasColumnName("book_type")
                .HasMaxLength(64)
                .HasConversion(value => value.ToCode(), value => value.DecodeAs<BookType>());
            entity.Property(row => row.CoverPageEntityId).HasColumnName("cover_page_entity_id");
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<BookDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BookVolumeDetailRow>(entity =>
        {
            entity.ToTable("book_volume_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<BookVolumeDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BookChapterDetailRow>(entity =>
        {
            entity.ToTable("book_chapter_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.CoverPageEntityId).HasColumnName("cover_page_entity_id");
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<BookChapterDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<BookPageDetailRow>(entity =>
        {
            entity.ToTable("book_page_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<BookPageDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
        });
    }

    private static void ConfigureAudio(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AudioLibraryDetailRow>(entity =>
        {
            entity.ToTable("audio_library_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<AudioLibraryDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AudioTrackDetailRow>(entity =>
        {
            entity.ToTable("audio_track_details");
            entity.HasKey(row => row.EntityId);
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.EmbeddedArtist).HasColumnName("embedded_artist");
            entity.Property(row => row.EmbeddedAlbum).HasColumnName("embedded_album");
            entity.HasOne<EntityRow>().WithOne().HasForeignKey<AudioTrackDetailRow>(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
