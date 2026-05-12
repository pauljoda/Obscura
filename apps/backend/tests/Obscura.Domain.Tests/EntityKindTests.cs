using Obscura.Domain.Entities;

namespace Obscura.Domain.Tests;

public sealed class EntityKindTests
{
    [Fact]
    public void KnownKindsExposeStableLowercaseCodes()
    {
        var codes = EntityKinds.All.Select(kind => kind.Code).ToArray();

        Assert.Contains("video", codes);
        Assert.Contains("video-series", codes);
        Assert.Contains("image", codes);
        Assert.Contains("gallery", codes);
        Assert.Contains("book", codes);
        Assert.Contains("audio", codes);
        Assert.Contains("audio-library", codes);
        Assert.Contains("audio-track", codes);
        Assert.Contains("performer", codes);
        Assert.Contains("studio", codes);
        Assert.Contains("tag", codes);
        Assert.All(codes, code => Assert.Matches("^[a-z][a-z0-9_-]*$", code));
    }

    [Fact]
    public void TryGetReturnsKnownKindCaseInsensitively()
    {
        var found = EntityKinds.TryGet("Video", out var kind);

        Assert.True(found);
        Assert.Equal("video", kind.Code);
        Assert.Equal(EntityKindCategory.Media, kind.Category);
    }
}
