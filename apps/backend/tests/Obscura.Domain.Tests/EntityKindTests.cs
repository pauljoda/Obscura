using Obscura.Domain.Entities;

namespace Obscura.Domain.Tests;

public sealed class EntityKindTests
{
    [Fact]
    public void KnownKindsExposeStableLowercaseCodes()
    {
        var codes = EntityKind.All.Select(kind => kind.Code).ToArray();

        Assert.Contains("video", codes);
        Assert.Contains("video-series", codes);
        Assert.Contains("image", codes);
        Assert.Contains("gallery", codes);
        Assert.Contains("book", codes);
        Assert.Contains("audio", codes);
        Assert.Contains("audio-library", codes);
        Assert.Contains("audio-track", codes);
        Assert.Contains("person", codes);
        Assert.Contains("studio", codes);
        Assert.Contains("tag", codes);
        Assert.All(codes, code => Assert.Matches("^[a-z][a-z0-9_-]*$", code));
    }

    [Fact]
    public void TryGetReturnsKnownKindCaseInsensitively()
    {
        var found = EntityKind.TryGet("Video", out var kind);

        Assert.True(found);
        Assert.Equal(EntityKindCode.Video, kind.Value);
        Assert.Equal("video", kind.Code);
        Assert.Equal(EntityKindCategory.Media, kind.Category);
    }

    [Fact]
    public void StaticKnownKindsExposeTypedIdentities()
    {
        Assert.Equal(EntityKindCode.Video, EntityKind.Video.Value);
        Assert.Equal("video", EntityKind.Video.Code);
        Assert.Equal(EntityKindCode.Collection, EntityKind.Collection.Value);
        Assert.Equal("collection", EntityKind.Collection.Code);
    }

    [Fact]
    public void KnownKindsAreDiscoveredConcreteImplementations()
    {
        Assert.Contains(EntityKind.All, kind => kind is IEntityKind && kind.GetType().Name == "VideoEntityKind");
        Assert.Contains(EntityKind.All, kind => kind is IEntityKind && kind.GetType().Name == "BookPageEntityKind");
        Assert.All(EntityKind.All, kind =>
        {
            Assert.NotEqual(typeof(EntityKind), kind.GetType());
            Assert.True(kind.GetType().IsSealed);
        });
    }

    [Fact]
    public void StaticKnownKindsReturnDiscoveredInstances()
    {
        var found = EntityKind.Require("video");

        Assert.Same(EntityKind.Video, found);
    }
}
