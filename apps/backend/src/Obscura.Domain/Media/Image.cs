using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

/// <summary>
/// Domain model for a single image entity.
/// </summary>
public sealed record Image : Entity
{
    /// <summary>
    /// Creates an image entity with explicit shared capabilities.
    /// </summary>
    public Image(
        Guid Id,
        string Title,
        IReadOnlyList<ICapability>? capabilities = null)
        : base(
            Id,
            EntityKindRegistry.Image,
            Title,
            capabilities ??
            [
                new CapabilityRating(null),
                CapabilityTags.Empty,
                CapabilityCredits.Empty,
                new CapabilityStudio(null),
                CapabilityImages.Empty,
                CapabilityLinks.Empty,
                CapabilityFlags.Empty,
                CapabilityFiles.Empty
            ])
    {
    }

    /// <summary>
    /// Creates an image from an already hydrated entity root.
    /// </summary>
    public Image(Entity entity)
        : this(entity.Id, entity.Title, entity.Capabilities)
    {
    }
}
