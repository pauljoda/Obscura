using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Entities.Mappers;
using Obscura.Infrastructure.Persistence;

namespace Obscura.Infrastructure.Tests;

/// <summary>
/// Structural coverage tests that enforce a 1:1 relationship between domain capabilities and
/// their persistence mappers, and between entity kinds and their kind mappers. These tests
/// fail the moment someone adds a new capability or entity kind without wiring up the
/// corresponding Infrastructure mapper, preventing silent data loss at runtime.
/// </summary>
public sealed class MapperCoverageTests {
    /// <summary>
    /// Every concrete <see cref="EntityCapability"/> subclass in the Domain assembly must have
    /// exactly one <see cref="IEntityCapabilityMapper"/> implementation in the Infrastructure
    /// assembly, and the mapper must follow the naming convention
    /// <c>Capability{X}</c> → <c>{X}CapabilityMapper</c>.
    /// </summary>
    [Fact]
    public void EveryCapabilityHasExactlyOneMapper() {
        var capabilityTypes = DiscoverConcreteCapabilityTypes();
        var mapperTypes = DiscoverConcreteCapabilityMapperTypes();

        // Forward check: every capability → mapper exists
        Assert.All(capabilityTypes, capabilityType => {
            var expectedMapperName = ExpectedMapperName(capabilityType);
            Assert.Contains(mapperTypes, mapperType => mapperType.Name == expectedMapperName);
        });

        // Reverse check: every mapper → capability exists
        Assert.All(mapperTypes, mapperType => {
            var expectedCapabilityName = ExpectedCapabilityName(mapperType);
            Assert.Contains(capabilityTypes, capabilityType => capabilityType.Name == expectedCapabilityName);
        });

        // Count check: exact 1:1
        Assert.Equal(capabilityTypes.Length, mapperTypes.Length);
    }

    /// <summary>
    /// Every <see cref="EntityKind"/> value that declares a concrete domain CLR type must have
    /// exactly one <see cref="IEntityKindMapper"/> implementation whose <c>Kind</c> property
    /// returns that value. Kinds without a CLR type (e.g. placeholder kinds) are excluded.
    /// </summary>
    [Fact]
    public void EveryEntityKindWithDomainTypeHasExactlyOneKindMapper() {
        using var db = CreateInMemoryContext();
        var mappers = EntityMappers.Kinds(db);
        var mappedKinds = new HashSet<EntityKind>(mappers.Select(mapper => mapper.Kind));

        var kindsWithDomainTypes = EntityKindRegistry.All
            .Where(descriptor => descriptor.ClrType is not null)
            .Select(descriptor => descriptor.Value)
            .ToArray();

        // Every kind with a CLR type must have a mapper
        Assert.All(kindsWithDomainTypes, kind =>
            Assert.True(mappedKinds.Contains(kind),
                $"EntityKind.{kind} has CLR type {EntityKindRegistry.Describe(kind).ClrType!.Name} but no IEntityKindMapper."));

        // Every mapper must map to a kind with a CLR type (no orphan mappers)
        Assert.All(mappers, mapper =>
            Assert.Contains(mapper.Kind, kindsWithDomainTypes));

        // Exact 1:1 count
        Assert.Equal(kindsWithDomainTypes.Length, mappers.Count);
    }

    /// <summary>
    /// The reflection-based <see cref="EntityMappers"/> factory must discover the same set of
    /// mappers that DI registration would. This catches mappers that have the wrong constructor
    /// shape or visibility and silently fail to instantiate.
    /// </summary>
    [Fact]
    public void MapperFactoryDiscoversEveryRegisteredMapper() {
        using var db = CreateInMemoryContext();
        var kindMappers = EntityMappers.Kinds(db);
        var capabilityMappers = EntityMappers.Capabilities(db);

        var expectedKindCount = DiscoverConcreteKindMapperTypes().Length;
        var expectedCapabilityCount = DiscoverConcreteCapabilityMapperTypes().Length;

        Assert.Equal(expectedKindCount, kindMappers.Count);
        Assert.Equal(expectedCapabilityCount, capabilityMappers.Count);
    }

    /// <summary>
    /// Every <see cref="IEntityKindMapper"/> follows the naming convention
    /// <c>{KindName}KindMapper</c> where <c>KindName</c> matches the <see cref="EntityKind"/>
    /// enum member name. This is not enforced by the type system but aids discoverability.
    /// </summary>
    [Fact]
    public void KindMapperNamingConventionIsConsistent() {
        using var db = CreateInMemoryContext();
        var mappers = EntityMappers.Kinds(db);
        Assert.All(mappers, mapper => {
            var expectedName = $"{mapper.Kind}KindMapper";
            Assert.Equal(expectedName, mapper.GetType().Name);
        });
    }

    // ── Reflection helpers ──────────────────────────────────────────────────────

    private static readonly Type[] DomainCapabilityTypes = typeof(EntityCapability).Assembly.GetTypes();
    private static readonly Type[] InfrastructureMapperTypes = typeof(IEntityCapabilityMapper).Assembly.GetTypes();

    private static Type[] DiscoverConcreteCapabilityTypes() =>
        DomainCapabilityTypes
            .Where(type => type is { IsClass: true, IsAbstract: false } &&
                           typeof(EntityCapability).IsAssignableFrom(type))
            .OrderBy(type => type.Name)
            .ToArray();

    private static Type[] DiscoverConcreteCapabilityMapperTypes() =>
        InfrastructureMapperTypes
            .Where(type => type is { IsClass: true, IsAbstract: false } &&
                           typeof(IEntityCapabilityMapper).IsAssignableFrom(type))
            .OrderBy(type => type.Name)
            .ToArray();

    private static Type[] DiscoverConcreteKindMapperTypes() =>
        InfrastructureMapperTypes
            .Where(type => type is { IsClass: true, IsAbstract: false } &&
                           typeof(IEntityKindMapper).IsAssignableFrom(type))
            .OrderBy(type => type.Name)
            .ToArray();

    /// <summary>Maps <c>CapabilityRating</c> → <c>RatingCapabilityMapper</c>.</summary>
    private static string ExpectedMapperName(Type capabilityType) {
        const string prefix = "Capability";
        var name = capabilityType.Name;
        var suffix = name.StartsWith(prefix, StringComparison.Ordinal) ? name[prefix.Length..] : name;
        return $"{suffix}CapabilityMapper";
    }

    /// <summary>Maps <c>RatingCapabilityMapper</c> → <c>CapabilityRating</c>.</summary>
    private static string ExpectedCapabilityName(Type mapperType) {
        const string suffix = "CapabilityMapper";
        var name = mapperType.Name;
        var core = name.EndsWith(suffix, StringComparison.Ordinal) ? name[..^suffix.Length] : name;
        return $"Capability{core}";
    }

    private static ObscuraDbContext CreateInMemoryContext() =>
        new(new DbContextOptionsBuilder<ObscuraDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
}
