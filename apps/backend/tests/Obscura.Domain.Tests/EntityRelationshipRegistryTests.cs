using Obscura.Domain.Entities;

namespace Obscura.Domain.Tests;

public sealed class EntityRelationshipRegistryTests
{
    [Fact]
    public void KnownRelationshipsAreDiscoveredConcreteImplementations()
    {
        Assert.Contains(EntityRelationshipRegistry.All, relationship =>
            relationship is IEntityRelationship && relationship.GetType().Name == "EpisodeRelationship");
        Assert.Contains(EntityRelationshipRegistry.All, relationship =>
            relationship is IEntityRelationship && relationship.GetType().Name == "PageRelationship");
        Assert.DoesNotContain(EntityRelationshipRegistry.All, relationship =>
            relationship.GetType().Name.StartsWith("Nested", StringComparison.Ordinal));
        Assert.All(EntityRelationshipRegistry.All, relationship =>
        {
            Assert.NotEqual(typeof(IEntityRelationship), relationship.GetType());
            Assert.True(relationship.GetType().IsSealed);
        });
    }

    [Fact]
    public void RelationshipModelDoesNotKeepParallelClassOrEnum()
    {
        Assert.DoesNotContain(
            typeof(IEntityRelationship).Assembly.GetTypes(),
            type => type.Name is "EntityRelationship" or "EntityRelationships" or "EntityRelationshipCode");
    }

    [Fact]
    public void StaticKnownRelationshipsReturnDiscoveredInstances()
    {
        var found = EntityRelationshipRegistry.Require("episode");

        Assert.Same(EntityRelationshipRegistry.Episode, found);
    }

    [Fact]
    public void RelationshipClassesDeclareTheirAllowedHierarchyLayers()
    {
        var episodeLayers = EntityRelationshipRegistry.Episode.Layers;

        Assert.Contains(episodeLayers, layer =>
            layer.RootKind == EntityKindRegistry.VideoSeries &&
            layer.ParentKind == EntityKindRegistry.VideoSeason &&
            layer.ChildKind == EntityKindRegistry.Video);
        Assert.Contains(episodeLayers, layer =>
            layer.RootKind == EntityKindRegistry.VideoSeries &&
            layer.ParentKind == EntityKindRegistry.VideoSeries &&
            layer.ChildKind == EntityKindRegistry.Video);

        var chapterLayers = EntityRelationshipRegistry.Chapter.Layers;
        Assert.Contains(chapterLayers, layer =>
            layer.RootKind == EntityKindRegistry.Book &&
            layer.ParentKind == EntityKindRegistry.BookVolume &&
            layer.ChildKind == EntityKindRegistry.BookChapter);
        Assert.Contains(chapterLayers, layer =>
            layer.RootKind == EntityKindRegistry.Book &&
            layer.ParentKind == EntityKindRegistry.Book &&
            layer.ChildKind == EntityKindRegistry.BookChapter);
    }
}
