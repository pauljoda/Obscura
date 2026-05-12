using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Domain.Registries;

namespace Obscura.Domain.Tests;

public sealed class RegistryInfrastructureTests
{
    [Fact]
    public void DomainRegistriesShareDiscoveryInfrastructure()
    {
        Assert.True(typeof(EntityKindRegistry).IsSubclassOf(typeof(AbstractRegistry<IEntityKind, string>)));
        Assert.True(typeof(EntityRelationshipRegistry).IsSubclassOf(typeof(AbstractRegistry<IEntityRelationship, string>)));
        Assert.True(typeof(CapabilityRegistry).IsSubclassOf(typeof(AbstractRegistry<ICapabilityKind, string>)));
        Assert.True(typeof(CodecRegistry).IsSubclassOf(typeof(AbstractRegistry<ICodec, Type>)));
        Assert.DoesNotContain(
            typeof(AbstractRegistry<,>).Assembly.GetTypes(),
            type => type.Name is "CodeRegistry`1" or "DiscoveredRegistry`2");
    }
}
