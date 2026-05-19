using Obscura.Domain.Entities;

namespace Obscura.Domain.Capabilities;

/// <summary>
/// Base class for every mutable behavior module that can be attached to an entity.
/// </summary>
public abstract class EntityCapability {
    /// <summary>Entity this capability is currently attached to, or null when detached.</summary>
    public Entity? Entity { get; private set; }

    /// <summary>
    /// Attaches this capability to an entity.
    /// </summary>
    /// <param name="entity">Entity that now owns this capability instance.</param>
    /// <exception cref="InvalidOperationException">Thrown when this capability already belongs to another entity.</exception>
    internal void AttachTo(Entity entity) {
        ArgumentNullException.ThrowIfNull(entity);
        if (Entity is not null && !ReferenceEquals(Entity, entity)) {
            throw new InvalidOperationException($"Capability {GetType().Name} is already attached to entity '{Entity.Id}'.");
        }

        Entity = entity;
    }

    /// <summary>
    /// Detaches this capability from the supplied entity.
    /// </summary>
    /// <param name="entity">Entity that is releasing the capability.</param>
    internal void DetachFrom(Entity entity) {
        if (ReferenceEquals(Entity, entity)) {
            Entity = null;
        }
    }
}
