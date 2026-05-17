using Obscura.Domain.Capabilities;

namespace Obscura.Domain.Entities;

/// <summary>
/// Typed entity-kind view over a registered entity kind, preserving the storage code while avoiding raw string access.
/// </summary>
/// <typeparam name="TEntity">Entity shape represented by this kind.</typeparam>
public sealed class EntityKind<TEntity> : IEntityKind<TEntity>
    where TEntity : Entity
{
    private readonly IEntityKind _inner;

    /// <summary>
    /// Creates a typed view over a discovered entity kind.
    /// </summary>
    /// <param name="inner">Registered entity kind metadata.</param>
    public EntityKind(IEntityKind inner)
    {
        ArgumentNullException.ThrowIfNull(inner);
        _inner = inner;
    }

    /// <inheritdoc />
    public string Code => _inner.Code;

    /// <inheritdoc />
    public string DisplayName => _inner.DisplayName;

    /// <inheritdoc />
    public EntityKindCategory Category => _inner.Category;

    /// <inheritdoc />
    public IReadOnlyList<EntityFileRole> ImageAssetRoles => _inner.ImageAssetRoles;

    /// <inheritdoc />
    public IReadOnlyList<ICapabilityKind> SupportedCapabilities => _inner.SupportedCapabilities;
}
