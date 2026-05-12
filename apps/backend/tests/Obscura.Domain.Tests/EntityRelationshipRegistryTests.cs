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
}
