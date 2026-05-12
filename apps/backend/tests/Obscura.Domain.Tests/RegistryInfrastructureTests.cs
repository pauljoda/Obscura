using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Domain.Registries;

namespace Obscura.Domain.Tests;

public sealed class RegistryInfrastructureTests
{
    [Fact]
    public void DomainRegistriesShareDiscoveryInfrastructure()
    {
        Assert.True(typeof(EntityKindRegistry).IsSubclassOf(typeof(CodeRegistry<IEntityKind>)));
        Assert.True(typeof(EntityRelationshipRegistry).IsSubclassOf(typeof(CodeRegistry<IEntityRelationship>)));
        Assert.True(typeof(CapabilityRegistry).IsSubclassOf(typeof(CodeRegistry<ICapabilityKind>)));
        Assert.True(typeof(CodecRegistry).IsSubclassOf(typeof(DiscoveredRegistry<ICodec, Type>)));
    }
}
