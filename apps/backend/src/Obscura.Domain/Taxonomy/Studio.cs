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
        Guid? ParentStudioId,
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
        this.ParentStudioId = ParentStudioId;
    }

    /// <summary>Optional parent studio entity identifier for hierarchical studios.</summary>
    public Guid? ParentStudioId { get; init; }

    /// <summary>
    /// Creates a studio from an already hydrated entity root.
    /// </summary>
    public Studio(Entity entity, Guid? ParentStudioId)
        : this(entity.Id, entity.Title, ParentStudioId, entity.Capabilities)
    {
    }
}
