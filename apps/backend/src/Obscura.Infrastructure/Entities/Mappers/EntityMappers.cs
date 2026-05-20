using Obscura.Infrastructure.Persistence;

namespace Obscura.Infrastructure.Entities.Mappers;

/// <summary>
/// Reflection-based factory that discovers every <see cref="IEntityKindMapper"/> and
/// <see cref="IEntityCapabilityMapper"/> implementation in the Infrastructure assembly.
/// Used by the DI registration in <see cref="DependencyInjection"/> and by tests that
/// construct <see cref="EfEntityRepository"/> directly. Every mapper takes a single
/// <see cref="ObscuraDbContext"/> constructor parameter so the factory has one path.
/// </summary>
public static class EntityMappers {
    /// <summary>Discovers every concrete kind mapper bound to <paramref name="db"/>.</summary>
    public static IReadOnlyList<IEntityKindMapper> Kinds(ObscuraDbContext db) =>
        Discover<IEntityKindMapper>(db);

    /// <summary>Discovers every concrete capability mapper bound to <paramref name="db"/>.</summary>
    public static IReadOnlyList<IEntityCapabilityMapper> Capabilities(ObscuraDbContext db) =>
        Discover<IEntityCapabilityMapper>(db);

    private static IReadOnlyList<TMapper> Discover<TMapper>(ObscuraDbContext db) {
        var assembly = typeof(EntityMappers).Assembly;
        return assembly.GetTypes()
            .Where(type => type is { IsClass: true, IsAbstract: false } && typeof(TMapper).IsAssignableFrom(type))
            .Select(type => (TMapper)Activator.CreateInstance(type, db)!)
            .ToArray();
    }
}
