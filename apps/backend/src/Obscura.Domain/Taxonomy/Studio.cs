using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Taxonomy;

/// <summary>
/// Domain model for studio, publisher, label, or production-group taxonomy entities.
/// </summary>
public sealed record Studio : Entity
{
    /// <summary>
    /// Creates a studio with explicit shared capabilities.
    /// </summary>
    public Studio(
        Guid Id,
        string Title,
        IReadOnlyList<ICapability>? capabilities = null)
        : base(
            Id,
            EntityKindRegistry.Studio,
            Title,
            capabilities ??
            [
                new CapabilityRating(null),
                CapabilityTags.Empty,
                CapabilityImages.Empty,
                CapabilityLinks.Empty,
                CapabilityFlags.Empty,
                CapabilityFiles.Empty
            ])
    {
    }

    /// <summary>
    /// Creates a studio from an already hydrated entity root.
    /// </summary>
    public Studio(Entity entity)
        : this(entity.Id, entity.Title, entity.Capabilities)
    {
    }
}
