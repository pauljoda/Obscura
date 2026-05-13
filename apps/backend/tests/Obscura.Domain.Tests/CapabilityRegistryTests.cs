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
        Assert.Contains(CapabilityRegistry.All, capability =>
            capability.Code == "playback" && capability.CapabilityType == typeof(CapabilityPlayback));
        Assert.Contains(CapabilityRegistry.All, capability =>
            capability.Code == "counters" && capability.CapabilityType == typeof(CapabilityCounters));
        Assert.Contains(CapabilityRegistry.All, capability =>
            capability.Code == "description" && capability.CapabilityType == typeof(CapabilityDescription));
        Assert.Contains(CapabilityRegistry.All, capability =>
            capability.Code == "fingerprints" && capability.CapabilityType == typeof(CapabilityFingerprints));
        Assert.Contains(CapabilityRegistry.All, capability =>
            capability.Code == "markers" && capability.CapabilityType == typeof(CapabilityMarkers));
        Assert.Contains(CapabilityRegistry.All, capability =>
            capability.Code == "subtitles" && capability.CapabilityType == typeof(CapabilitySubtitles));
        Assert.Contains(CapabilityRegistry.All, capability =>
            capability.Code == "stats" && capability.CapabilityType == typeof(CapabilityStats));
        Assert.Contains(CapabilityRegistry.All, capability =>
            capability.Code == "dates" && capability.CapabilityType == typeof(CapabilityDates));
        Assert.Contains(CapabilityRegistry.All, capability =>
            capability.Code == "technical" && capability.CapabilityType == typeof(CapabilityTechnical));
        Assert.Contains(CapabilityRegistry.All, capability =>
            capability.Code == "source" && capability.CapabilityType == typeof(CapabilitySource));
        Assert.Contains(CapabilityRegistry.All, capability =>
            capability.Code == "progress" && capability.CapabilityType == typeof(CapabilityProgress));
        Assert.Contains(CapabilityRegistry.All, capability =>
            capability.Code == "position" && capability.CapabilityType == typeof(CapabilityPosition));
        Assert.Contains(CapabilityRegistry.All, capability =>
            capability.Code == "classification" && capability.CapabilityType == typeof(CapabilityClassification));
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
    public void CapabilityRegistryUsesSharedRegistryInfrastructure()
    {
        Assert.True(typeof(CapabilityRegistry).IsSubclassOf(typeof(AbstractRegistry<ICapabilityKind, string>)));
    }
}
