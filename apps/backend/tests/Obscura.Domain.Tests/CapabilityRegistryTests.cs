using Obscura.Domain.Capabilities;
using Obscura.Domain.Registries;

namespace Obscura.Domain.Tests;

public sealed class CapabilityRegistryTests
{
    [Fact]
    public void KnownCapabilitiesAreDiscoveredConcreteImplementations()
    {
        Assert.Contains(CapabilityRegistry.All, capability =>
            capability.Code == "rating" && capability.CapabilityType == typeof(CapabilityRating));
        Assert.Contains(CapabilityRegistry.All, capability =>
            capability.Code == "files" && capability.CapabilityType == typeof(CapabilityFiles));
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
        Assert.Same(CapabilityRating.CapabilityKind, found);
        Assert.Equal(typeof(CapabilityRating), CapabilityRegistry.Rating.CapabilityType);
    }

    [Fact]
    public void CapabilityRegistryUsesSharedCodeRegistryInfrastructure()
    {
        Assert.True(typeof(CapabilityRegistry).IsSubclassOf(typeof(CodeRegistry<ICapabilityKind>)));
    }
}
