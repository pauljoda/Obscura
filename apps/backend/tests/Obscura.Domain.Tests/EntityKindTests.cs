using Obscura.Domain.Entities;

namespace Obscura.Domain.Tests;

public sealed class EntityKindTests
{
    [Fact]
    public void KnownKindsExposeStableLowercaseCodes()
    {
        var codes = EntityKindRegistry.All.Select(kind => kind.Code).ToArray();

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
        var found = EntityKindRegistry.TryGet("Video", out var kind);

        Assert.True(found);
        Assert.Equal("video", kind.Code);
        Assert.Equal(EntityKindCategory.Media, kind.Category);
    }

    [Fact]
    public void StaticKnownKindsExposeStableCodes()
    {
        Assert.Equal("video", EntityKindRegistry.Video.Code);
        Assert.Equal("collection", EntityKindRegistry.Collection.Code);
    }

    [Fact]
    public void KnownKindsAreDiscoveredConcreteImplementations()
    {
        Assert.Contains(EntityKindRegistry.All, kind => kind is IEntityKind && kind.GetType().Name == "VideoEntityKind");
        Assert.Contains(EntityKindRegistry.All, kind => kind is IEntityKind && kind.GetType().Name == "BookPageEntityKind");
        Assert.All(EntityKindRegistry.All, kind =>
        {
            Assert.NotEqual(typeof(IEntityKind), kind.GetType());
            Assert.True(kind.GetType().IsSealed);
        });
    }

    [Fact]
    public void KindModelDoesNotKeepParallelClassOrEnum()
    {
        Assert.DoesNotContain(
            typeof(IEntityKind).Assembly.GetTypes(),
            type => type.Name is "EntityKind" or "EntityKinds" or "EntityKindCode");
    }

    [Fact]
    public void StaticKnownKindsReturnDiscoveredInstances()
    {
        var found = EntityKindRegistry.Require("video");

        Assert.Same(EntityKindRegistry.Video, found);
    }

    [Fact]
    public void EntityKindsDeclareTheirSupportedImageAssetShape()
    {
        Assert.Contains(EntityFileRole.Trickplay, EntityKindRegistry.Video.ImageAssetRoles);
        Assert.Contains(EntityFileRole.Logo, EntityKindRegistry.Video.ImageAssetRoles);
        Assert.Contains(EntityFileRole.Backdrop, EntityKindRegistry.Video.ImageAssetRoles);

        Assert.Equal([EntityFileRole.Cover], EntityKindRegistry.AudioLibrary.ImageAssetRoles);
        Assert.DoesNotContain(EntityFileRole.Trickplay, EntityKindRegistry.AudioLibrary.ImageAssetRoles);
    }
}
