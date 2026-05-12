using Obscura.Domain.Entities;

namespace Obscura.Domain.Tests;

public sealed class EntityRelationshipRegistryTests
{
    [Fact]
    public void KnownRelationshipsAreDiscoveredConcreteImplementations()
    {
        Assert.Contains(EntityRelationship.All, relationship =>
            relationship is IEntityRelationship && relationship.GetType().Name == "EpisodeRelationship");
        Assert.Contains(EntityRelationship.All, relationship =>
            relationship is IEntityRelationship && relationship.GetType().Name == "PageRelationship");
        Assert.All(EntityRelationship.All, relationship =>
        {
            Assert.NotEqual(typeof(EntityRelationship), relationship.GetType());
            Assert.True(relationship.GetType().IsSealed);
        });
    }

    [Fact]
    public void StaticKnownRelationshipsReturnDiscoveredInstances()
    {
        var found = EntityRelationship.Require("episode");

        Assert.Same(EntityRelationship.Episode, found);
    }
}
