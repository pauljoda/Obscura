using Microsoft.EntityFrameworkCore;
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
    [InlineData(typeof(EntityTagLinkRow), "entity_tag_links")]
    [InlineData(typeof(VideoDetailRow), "video_details")]
    [InlineData(typeof(LibraryRootRow), "library_roots")]
    [InlineData(typeof(LibrarySettingsRow), "library_settings")]
    [InlineData(typeof(DatabaseBackupRow), "database_backups")]
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

    [Theory]
    [InlineData(typeof(EntityRow), nameof(EntityRow.KindCode), "kind_code")]
    [InlineData(typeof(EntityRatingRow), nameof(EntityRatingRow.EntityId), "entity_id")]
    [InlineData(typeof(EntityFlagRow), nameof(EntityFlagRow.IsFavorite), "is_favorite")]
    [InlineData(typeof(VideoDetailRow), nameof(VideoDetailRow.DurationMs), "duration_ms")]
    [InlineData(typeof(LibraryRootRow), nameof(LibraryRootRow.ScanVideos), "scan_videos")]
    [InlineData(typeof(LibrarySettingsRow), nameof(LibrarySettingsRow.AutoScanEnabled), "auto_scan_enabled")]
    [InlineData(typeof(DatabaseBackupRow), nameof(DatabaseBackupRow.BackupPath), "backup_path")]
    public void V2ModelUsesSnakeCaseColumns(Type entityType, string propertyName, string columnName)
    {
        using var db = CreateContext();
        var modelEntity = db.Model.FindEntityType(entityType);

        var property = modelEntity!.FindProperty(propertyName);

        Assert.NotNull(property);
        Assert.Equal(columnName, property.GetColumnName());
    }

    private static ObscuraDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ObscuraDbContext>()
            .UseNpgsql("Host=localhost;Database=obscura;Username=obscura;Password=obscura")
            .Options;

        return new ObscuraDbContext(options);
    }
}
