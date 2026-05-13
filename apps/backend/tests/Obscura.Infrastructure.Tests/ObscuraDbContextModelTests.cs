using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Domain.Media;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Tests;

public sealed class ObscuraDbContextModelTests
{
    [Theory]
    [InlineData(typeof(EntityKindRow), "entity_kinds")]
    [InlineData(typeof(EntityRow), "entities")]
    [InlineData(typeof(EntityRatingRow), "entity_ratings")]
    [InlineData(typeof(EntityFlagRow), "entity_flags")]
    [InlineData(typeof(EntityDescriptionRow), "entity_descriptions")]
    [InlineData(typeof(EntityTagLinkRow), "entity_tag_links")]
    [InlineData(typeof(EntityAliasRow), "entity_aliases")]
    [InlineData(typeof(EntityPlaybackRow), "entity_playback")]
    [InlineData(typeof(EntityCounterRow), "entity_counters")]
    [InlineData(typeof(EntityStatRow), "entity_stats")]
    [InlineData(typeof(EntityDateRow), "entity_dates")]
    [InlineData(typeof(EntityTechnicalRow), "entity_technical")]
    [InlineData(typeof(EntitySourceRow), "entity_sources")]
    [InlineData(typeof(EntityProgressRow), "entity_progress")]
    [InlineData(typeof(EntityPositionRow), "entity_positions")]
    [InlineData(typeof(EntityClassificationRow), "entity_classifications")]
    [InlineData(typeof(EntityFileFingerprintRow), "entity_file_fingerprints")]
    [InlineData(typeof(VideoDetailRow), "video_details")]
    [InlineData(typeof(VideoSeriesDetailRow), "video_series_details")]
    [InlineData(typeof(VideoSeasonDetailRow), "video_season_details")]
    [InlineData(typeof(GalleryDetailRow), "gallery_details")]
    [InlineData(typeof(ImageDetailRow), "image_details")]
    [InlineData(typeof(BookDetailRow), "book_details")]
    [InlineData(typeof(BookVolumeDetailRow), "book_volume_details")]
    [InlineData(typeof(BookChapterDetailRow), "book_chapter_details")]
    [InlineData(typeof(BookPageDetailRow), "book_page_details")]
    [InlineData(typeof(BookReadProgressRow), "book_read_progress")]
    [InlineData(typeof(AudioLibraryDetailRow), "audio_library_details")]
    [InlineData(typeof(AudioTrackDetailRow), "audio_track_details")]
    [InlineData(typeof(PersonDetailRow), "person_details")]
    [InlineData(typeof(StudioDetailRow), "studio_details")]
    [InlineData(typeof(TagDetailRow), "tag_details")]
    [InlineData(typeof(CollectionDetailRow), "collection_details")]
    [InlineData(typeof(CollectionItemDetailRow), "collection_item_details")]
    [InlineData(typeof(LibraryRootRow), "library_roots")]
    [InlineData(typeof(MediaFileIgnoreRow), "media_file_ignores")]
    [InlineData(typeof(LibrarySettingsRow), "library_settings")]
    [InlineData(typeof(UiPreferenceRow), "ui_prefs")]
    [InlineData(typeof(ProviderConfigRow), "provider_configs")]
    [InlineData(typeof(ProviderCredentialRow), "provider_credentials")]
    [InlineData(typeof(IdentifyResultRow), "identify_results")]
    [InlineData(typeof(FingerprintSubmissionRow), "fingerprint_submissions")]
    [InlineData(typeof(DatabaseBackupRow), "database_backups")]
    [InlineData(typeof(JobRunRow), "job_runs")]
    public void V2ModelMapsGlobalEntityTablesToV2Schema(Type entityType, string tableName)
    {
        using var db = CreateContext();
        var modelEntity = db.Model.FindEntityType(entityType);

        Assert.NotNull(modelEntity);
        Assert.Equal("v2", modelEntity.GetSchema());
        Assert.Equal(tableName, modelEntity.GetTableName());
    }

    [Fact]
    public void RatingCapabilityUsesEntityIdAsItsPrimaryKey()
    {
        using var db = CreateContext();
        var modelEntity = db.Model.FindEntityType(typeof(EntityRatingRow));

        var key = Assert.Single(modelEntity!.FindPrimaryKey()!.Properties);
        Assert.Equal(nameof(EntityRatingRow.EntityId), key.Name);
    }

    [Fact]
    public void EntityKindSeedDataIncludesStructuralHierarchyKinds()
    {
        using var db = CreateContext();
        var modelEntity = db.GetService<IDesignTimeModel>().Model.FindEntityType(typeof(EntityKindRow));

        var seededCodes = modelEntity!.GetSeedData()
            .Select(seed => seed[nameof(EntityKindRow.Code)])
            .Cast<string>()
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        Assert.Contains(EntityKindRegistry.VideoSeason.Code, seededCodes);
        Assert.Contains(EntityKindRegistry.BookVolume.Code, seededCodes);
        Assert.Contains(EntityKindRegistry.BookChapter.Code, seededCodes);
        Assert.Contains(EntityKindRegistry.BookPage.Code, seededCodes);
    }

    [Fact]
    public void StructuralHierarchyLinksHaveCanonicalChildIndex()
    {
        using var db = CreateContext();
        var modelEntity = db.Model.FindEntityType(typeof(EntityHierarchyLinkRow));

        var index = modelEntity!.GetIndexes().SingleOrDefault(candidate =>
            candidate.IsUnique &&
            candidate.Properties.Select(property => property.Name).SequenceEqual([
                nameof(EntityHierarchyLinkRow.ChildEntityId),
                nameof(EntityHierarchyLinkRow.Relationship)
            ]));

        Assert.NotNull(index);
        Assert.Contains("relationship IN", index!.GetFilter(), StringComparison.OrdinalIgnoreCase);
        Assert.Contains(EntityRelationshipRegistry.Chapter.Code, index.GetFilter(), StringComparison.OrdinalIgnoreCase);
        Assert.Contains(EntityRelationshipRegistry.Page.Code, index.GetFilter(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void GalleryDetailsDoNotKeepLegacyPhotographerMetadata()
    {
        Assert.Null(typeof(Gallery).GetProperty("Photographer"));
        Assert.Null(typeof(GalleryDetailRow).GetProperty("Photographer"));

        using var db = CreateContext();
        var modelEntity = db.Model.FindEntityType(typeof(GalleryDetailRow));

        Assert.NotNull(modelEntity);
        Assert.DoesNotContain(modelEntity!.GetProperties(), property => property.GetColumnName() == "photographer");
    }

    [Theory]
    [InlineData(typeof(EntityRow), nameof(EntityRow.KindCode), "kind_code")]
    [InlineData(typeof(EntityRatingRow), nameof(EntityRatingRow.EntityId), "entity_id")]
    [InlineData(typeof(EntityDescriptionRow), nameof(EntityDescriptionRow.Value), "value")]
    [InlineData(typeof(EntityCounterRow), nameof(EntityCounterRow.Code), "code")]
    [InlineData(typeof(EntityStatRow), nameof(EntityStatRow.Code), "code")]
    [InlineData(typeof(EntityTechnicalRow), nameof(EntityTechnicalRow.DurationSeconds), "duration_seconds")]
    [InlineData(typeof(EntitySourceRow), nameof(EntitySourceRow.Value), "value")]
    [InlineData(typeof(EntityProgressRow), nameof(EntityProgressRow.CurrentEntityId), "current_entity_id")]
    [InlineData(typeof(EntityPositionRow), nameof(EntityPositionRow.Label), "label")]
    [InlineData(typeof(EntityClassificationRow), nameof(EntityClassificationRow.Value), "value")]
    [InlineData(typeof(EntityFlagRow), nameof(EntityFlagRow.IsFavorite), "is_favorite")]
    [InlineData(typeof(VideoDetailRow), nameof(VideoDetailRow.DurationMs), "duration_ms")]
    [InlineData(typeof(LibraryRootRow), nameof(LibraryRootRow.ScanVideos), "scan_videos")]
    [InlineData(typeof(LibrarySettingsRow), nameof(LibrarySettingsRow.AutoScanEnabled), "auto_scan_enabled")]
    [InlineData(typeof(LibrarySettingsRow), nameof(LibrarySettingsRow.HideNsfw), "hide_nsfw")]
    [InlineData(typeof(DatabaseBackupRow), nameof(DatabaseBackupRow.BackupPath), "backup_path")]
    [InlineData(typeof(JobRunRow), nameof(JobRunRow.AvailableAt), "available_at")]
    public void V2ModelUsesSnakeCaseColumns(Type entityType, string propertyName, string columnName)
    {
        using var db = CreateContext();
        var modelEntity = db.Model.FindEntityType(entityType);

        var property = modelEntity!.FindProperty(propertyName);

        Assert.NotNull(property);
        Assert.Equal(columnName, property.GetColumnName());
    }

    [Theory]
    [InlineData(typeof(BookDetailRow), nameof(BookDetailRow.BookType), typeof(BookType))]
    [InlineData(typeof(BookReadProgressRow), nameof(BookReadProgressRow.ReaderMode), typeof(ReaderMode))]
    [InlineData(typeof(GalleryDetailRow), nameof(GalleryDetailRow.GalleryType), typeof(GalleryType))]
    [InlineData(typeof(VideoSeriesDetailRow), nameof(VideoSeriesDetailRow.RenderingMode), typeof(VideoSeriesRenderingMode))]
    [InlineData(typeof(CollectionDetailRow), nameof(CollectionDetailRow.Mode), typeof(CollectionMode))]
    [InlineData(typeof(CollectionDetailRow), nameof(CollectionDetailRow.CoverMode), typeof(CollectionCoverMode))]
    [InlineData(typeof(CollectionItemDetailRow), nameof(CollectionItemDetailRow.Source), typeof(CollectionItemSource))]
    [InlineData(typeof(ProviderConfigRow), nameof(ProviderConfigRow.ProviderType), typeof(ProviderType))]
    [InlineData(typeof(IdentifyResultRow), nameof(IdentifyResultRow.Status), typeof(IdentifyResultStatus))]
    [InlineData(typeof(FingerprintSubmissionRow), nameof(FingerprintSubmissionRow.Status), typeof(FingerprintSubmissionStatus))]
    [InlineData(typeof(EntityCreditLinkRow), nameof(EntityCreditLinkRow.Role), typeof(EntityCreditRole))]
    [InlineData(typeof(EntityFileRow), nameof(EntityFileRow.Role), typeof(EntityFileRole))]
    [InlineData(typeof(EntitySubtitleRow), nameof(EntitySubtitleRow.Source), typeof(EntitySubtitleSource))]
    [InlineData(typeof(DatabaseBackupRow), nameof(DatabaseBackupRow.Status), typeof(DatabaseBackupStatus))]
    [InlineData(typeof(JobRunRow), nameof(JobRunRow.Type), typeof(JobType))]
    [InlineData(typeof(JobRunRow), nameof(JobRunRow.Status), typeof(JobRunStatus))]
    [InlineData(typeof(LibrarySettingsRow), nameof(LibrarySettingsRow.SubtitleStyle), typeof(SubtitleStyle))]
    [InlineData(typeof(LibrarySettingsRow), nameof(LibrarySettingsRow.DefaultPlaybackMode), typeof(PlaybackMode))]
    public void V2ModelUsesEnumsForClosedChoiceCodes(Type entityType, string propertyName, Type clrType)
    {
        using var db = CreateContext();
        var modelEntity = db.Model.FindEntityType(entityType);

        var property = modelEntity!.FindProperty(propertyName);

        Assert.NotNull(property);
        Assert.Equal(clrType, property.ClrType);
    }

    private static ObscuraDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ObscuraDbContext>()
            .UseNpgsql("Host=localhost;Database=obscura;Username=obscura;Password=obscura")
            .Options;

        return new ObscuraDbContext(options);
    }
}
