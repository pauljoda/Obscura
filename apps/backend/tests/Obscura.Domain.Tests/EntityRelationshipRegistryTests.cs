using Obscura.Domain.Entities;

namespace Obscura.Domain.Tests;

public sealed class EntityRelationshipRegistryTests
{
    [Fact]
    public void KnownRelationshipsAreDiscoveredConcreteImplementations()
    {
        Assert.Contains(IEntityRelationship.All, relationship =>
            relationship is IEntityRelationship && relationship.GetType().Name == "EpisodeRelationship");
        Assert.Contains(IEntityRelationship.All, relationship =>
            relationship is IEntityRelationship && relationship.GetType().Name == "PageRelationship");
        Assert.All(IEntityRelationship.All, relationship =>
        {
            Assert.NotEqual(typeof(IEntityRelationship), relationship.GetType());
            Assert.True(relationship.GetType().IsSealed);
        });
    }

    [Fact]
    public void RelationshipModelDoesNotKeepParallelAbstractClass()
    {
        Assert.DoesNotContain(
            typeof(IEntityRelationship).Assembly.GetTypes(),
            type => type is { Name: "EntityRelationship", IsClass: true });
    }

    [Fact]
    public void StaticKnownRelationshipsReturnDiscoveredInstances()
    {
        var found = IEntityRelationship.Require("episode");

        Assert.Same(IEntityRelationship.Episode, found);
    }
}
