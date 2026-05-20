using Microsoft.EntityFrameworkCore;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Persistence;

internal static partial class ExpandedV2ModelConfiguration {
    private static void ConfigureMediaPlaybackModel(ModelBuilder modelBuilder) {
        modelBuilder.Entity<MediaSourceRow>(entity => {
            entity.ToTable("media_sources");
            entity.HasKey(row => row.Id);
            entity.Property(row => row.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.EntityFileId).HasColumnName("entity_file_id");
            entity.Property(row => row.Path).HasColumnName("path").IsRequired();
            entity.Property(row => row.Protocol).HasColumnName("protocol").HasMaxLength(32).IsRequired();
            entity.Property(row => row.Container).HasColumnName("container").HasMaxLength(128);
            entity.Property(row => row.Name).HasColumnName("name").HasMaxLength(512);
            entity.Property(row => row.SizeBytes).HasColumnName("size_bytes");
            entity.Property(row => row.DurationSeconds).HasColumnName("duration_seconds");
            entity.Property(row => row.BitRate).HasColumnName("bit_rate");
            entity.Property(row => row.VideoCodec).HasColumnName("video_codec").HasMaxLength(128);
            entity.Property(row => row.AudioCodec).HasColumnName("audio_codec").HasMaxLength(128);
            entity.Property(row => row.Width).HasColumnName("width");
            entity.Property(row => row.Height).HasColumnName("height");
            entity.Property(row => row.FrameRate).HasColumnName("frame_rate");
            entity.Property(row => row.CreatedAt).HasColumnName("created_at");
            entity.Property(row => row.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(row => new { row.EntityId, row.Path }).IsUnique();
            entity.HasOne<EntityRow>().WithMany().HasForeignKey(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<EntityFileRow>().WithMany().HasForeignKey(row => row.EntityFileId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<MediaStreamRow>(entity => {
            entity.ToTable("media_streams");
            entity.HasKey(row => row.Id);
            entity.Property(row => row.Id).HasColumnName("id").ValueGeneratedNever();
            entity.Property(row => row.MediaSourceId).HasColumnName("media_source_id");
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.StreamIndex).HasColumnName("stream_index");
            entity.Property(row => row.Type).HasColumnName("type").HasMaxLength(32).IsRequired();
            entity.Property(row => row.Codec).HasColumnName("codec").HasMaxLength(128);
            entity.Property(row => row.Language).HasColumnName("language").HasMaxLength(32);
            entity.Property(row => row.Title).HasColumnName("title").HasMaxLength(512);
            entity.Property(row => row.Width).HasColumnName("width");
            entity.Property(row => row.Height).HasColumnName("height");
            entity.Property(row => row.FrameRate).HasColumnName("frame_rate");
            entity.Property(row => row.BitRate).HasColumnName("bit_rate");
            entity.Property(row => row.SampleRate).HasColumnName("sample_rate");
            entity.Property(row => row.Channels).HasColumnName("channels");
            entity.Property(row => row.IsDefault).HasColumnName("is_default");
            entity.Property(row => row.IsForced).HasColumnName("is_forced");
            entity.Property(row => row.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(row => new { row.MediaSourceId, row.StreamIndex }).IsUnique();
            entity.HasOne<MediaSourceRow>().WithMany().HasForeignKey(row => row.MediaSourceId).OnDelete(DeleteBehavior.Cascade);
            entity.HasOne<EntityRow>().WithMany().HasForeignKey(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TrickplayInfoRow>(entity => {
            entity.ToTable("trickplay_infos");
            entity.HasKey(row => new { row.EntityId, row.Width });
            entity.Property(row => row.EntityId).HasColumnName("entity_id");
            entity.Property(row => row.Width).HasColumnName("width");
            entity.Property(row => row.Height).HasColumnName("height");
            entity.Property(row => row.TileWidth).HasColumnName("tile_width");
            entity.Property(row => row.TileHeight).HasColumnName("tile_height");
            entity.Property(row => row.ThumbnailCount).HasColumnName("thumbnail_count");
            entity.Property(row => row.IntervalSeconds).HasColumnName("interval_seconds");
            entity.Property(row => row.Bandwidth).HasColumnName("bandwidth");
            entity.Property(row => row.CreatedAt).HasColumnName("created_at");
            entity.Property(row => row.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne<EntityRow>().WithMany().HasForeignKey(row => row.EntityId).OnDelete(DeleteBehavior.Cascade);
            entity.ToTable(table => {
                table.HasCheckConstraint("ck_trickplay_infos_width", "width > 0");
                table.HasCheckConstraint("ck_trickplay_infos_height", "height > 0");
                table.HasCheckConstraint("ck_trickplay_infos_tiles", "tile_width > 0 AND tile_height > 0");
                table.HasCheckConstraint("ck_trickplay_infos_thumbnail_count", "thumbnail_count >= 0");
                table.HasCheckConstraint("ck_trickplay_infos_interval", "interval_seconds > 0");
            });
        });
    }
}
