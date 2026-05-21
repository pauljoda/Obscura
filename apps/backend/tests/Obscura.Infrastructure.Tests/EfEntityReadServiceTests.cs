using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Entities;
using Obscura.Infrastructure.Entities.Mappers;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Tests;

public sealed class EfEntityReadServiceTests {
    [Fact]
    public async Task ListAsyncProjectsVideoTrickplayPlaylistAsSpriteHover() {
        await using var db = CreateContext();
        var videoId = Guid.Parse("44444444-4444-4444-4444-444444444444");
        var now = DateTimeOffset.UtcNow;
        db.Entities.Add(new EntityRow {
            Id = videoId,
            KindCode = EntityKindRegistry.Video.Code,
            Title = "Hoverable Video",
            CreatedAt = now,
            UpdatedAt = now
        });
        db.EntityFiles.AddRange(
            new EntityFileRow {
                Id = Guid.NewGuid(),
                EntityId = videoId,
                Role = EntityFileRole.Thumbnail,
                Path = "/assets/videos/444/thumb.jpg",
                CreatedAt = now,
                UpdatedAt = now
            },
            new EntityFileRow {
                Id = Guid.NewGuid(),
                EntityId = videoId,
                Role = EntityFileRole.Trickplay,
                Path = "/Videos/44444444-4444-4444-4444-444444444444/Trickplay/320/tiles.m3u8",
                MimeType = "application/vnd.apple.mpegurl",
                CreatedAt = now,
                UpdatedAt = now
            });
        await db.SaveChangesAsync();

        var repository = new EfEntityRepository(db, EntityMappers.Kinds(db), EntityMappers.Capabilities(db));
        var service = new EfEntityReadService(db, repository, EntityMappers.Kinds(db));

        var result = await service.ListAsync(EntityKindRegistry.Video.Code, null, null, null, null, CancellationToken.None);
        var item = Assert.Single(result.Items);

        Assert.Equal("sprite", item.HoverKind);
        Assert.Equal("/Videos/44444444-4444-4444-4444-444444444444/Trickplay/320/tiles.m3u8", item.HoverUrl);
    }

    [Fact]
    public async Task ListAsyncReturnsUnboundedTotalCountForFilteredEntities() {
        await using var db = CreateContext();
        var now = DateTimeOffset.UtcNow;
        for (var index = 0; index < 5; index++) {
            db.Entities.Add(new EntityRow {
                Id = Guid.NewGuid(),
                KindCode = EntityKindRegistry.Video.Code,
                Title = $"Video {index:00}",
                CreatedAt = now,
                UpdatedAt = now
            });
        }
        // A non-matching entity must not be counted in the kind-scoped total.
        db.Entities.Add(new EntityRow {
            Id = Guid.NewGuid(),
            KindCode = EntityKindRegistry.Image.Code,
            Title = "Stray image",
            CreatedAt = now,
            UpdatedAt = now
        });
        await db.SaveChangesAsync();

        var repository = new EfEntityRepository(db, EntityMappers.Kinds(db), EntityMappers.Capabilities(db));
        var service = new EfEntityReadService(db, repository, EntityMappers.Kinds(db));

        var firstPage = await service.ListAsync(
            EntityKindRegistry.Video.Code, query: null, cursor: null, hideNsfw: null, limit: 2, CancellationToken.None);
        Assert.Equal(2, firstPage.Items.Count);
        Assert.NotNull(firstPage.NextCursor);
        Assert.Equal(5, firstPage.TotalCount);

        var secondPage = await service.ListAsync(
            EntityKindRegistry.Video.Code, query: null, cursor: firstPage.NextCursor, hideNsfw: null, limit: 2, CancellationToken.None);
        Assert.Equal(2, secondPage.Items.Count);
        // Total is independent of cursor position — it always reflects the full filter match.
        Assert.Equal(5, secondPage.TotalCount);
    }

    private static ObscuraDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<ObscuraDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
}
