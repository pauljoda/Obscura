using Obscura.Domain.Capabilities;

namespace Obscura.Domain.Tests;

public sealed class CapabilityRegistryTests
{
    [Fact]
    public void KnownCapabilitiesAreDiscoveredConcreteImplementations()
    {
        Assert.True(typeof(CapabilityKind<>).IsAbstract);
        Assert.Contains(CapabilityRegistry.All, capability =>
            capability is ICapabilityKind && capability.GetType().Name == "RatingCapabilityKind");
        Assert.Contains(CapabilityRegistry.All, capability =>
            capability is ICapabilityKind && capability.GetType().Name == "FilesCapabilityKind");
        Assert.IsAssignableFrom<CapabilityKind<CapabilityRating>>(CapabilityRegistry.Rating);
        Assert.All(CapabilityRegistry.All, capability =>
        {
            Assert.NotEqual(typeof(ICapabilityKind), capability.GetType());
            Assert.True(capability.GetType().IsSealed);
        });
    }

    [Fact]
    public void CapabilityModelDoesNotKeepParallelGroupingClass()
    {
        Assert.DoesNotContain(
            typeof(ICapabilityKind).Assembly.GetTypes(),
            type => type.Name is "Capabilities" or "CapabilityKinds" or "CapabilityCode");
    }

    [Fact]
    public void StaticKnownCapabilitiesReturnDiscoveredInstances()
    {
        var found = CapabilityRegistry.Require("rating");

        Assert.Same(CapabilityRegistry.Rating, found);
        Assert.Equal(typeof(CapabilityRating), CapabilityRegistry.Rating.CapabilityType);
    }
}
