using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;
using Obscura.Infrastructure.Videos;

namespace Obscura.Infrastructure.Tests;

public sealed class VideoSourceServiceTests : IDisposable
{
    private readonly string _tempDir = Path.Combine(Path.GetTempPath(), $"obscura-video-source-{Guid.NewGuid():N}");

    public VideoSourceServiceTests()
    {
        Directory.CreateDirectory(_tempDir);
    }

    [Fact]
    public async Task GetsExistingSourceFileForVideoEntity()
    {
        await using var db = CreateContext();
        var videoId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var filePath = Path.Combine(_tempDir, "video.mp4");
        await File.WriteAllTextAsync(filePath, "video-bytes");
        SeedVideoSource(db, videoId, filePath, "video/mp4");
        await db.SaveChangesAsync();

        var service = new VideoSourceService(db);
        var source = await service.GetSourceAsync(videoId, CancellationToken.None);

        Assert.NotNull(source);
        Assert.Equal(filePath, source.Path);
        Assert.Equal("video/mp4", source.ContentType);
        Assert.True(source.DirectPlayable);
    }

    [Fact]
    public async Task MarksKnownTranscodeContainersAsNotDirectPlayable()
    {
        await using var db = CreateContext();
        var videoId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var filePath = Path.Combine(_tempDir, "video.mkv");
        await File.WriteAllTextAsync(filePath, "video-bytes");
        SeedVideoSource(db, videoId, filePath, null);
        await db.SaveChangesAsync();

        var service = new VideoSourceService(db);
        var source = await service.GetSourceAsync(videoId, CancellationToken.None);

        Assert.NotNull(source);
        Assert.Equal("video/x-matroska", source.ContentType);
        Assert.False(source.DirectPlayable);
    }

    public void Dispose()
    {
        if (Directory.Exists(_tempDir))
        {
            Directory.Delete(_tempDir, recursive: true);
        }
    }

    private static ObscuraDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ObscuraDbContext>()
            .UseInMemoryDatabase($"video-source-{Guid.NewGuid():N}")
            .Options;

        return new ObscuraDbContext(options);
    }

    private static void SeedVideoSource(
        ObscuraDbContext db,
        Guid videoId,
        string path,
        string? mimeType)
    {
        db.Entities.Add(new EntityRow
        {
            Id = videoId,
            KindCode = EntityKindRegistry.Video.Code,
            Title = "Source",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        db.EntityFiles.Add(new EntityFileRow
        {
            Id = Guid.NewGuid(),
            EntityId = videoId,
            Role = EntityFileRole.Source,
            Path = path,
            MimeType = mimeType,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
    }
}
