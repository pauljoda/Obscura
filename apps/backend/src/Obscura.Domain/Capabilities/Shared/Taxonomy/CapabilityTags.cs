using Obscura.Domain.Entities;

namespace Obscura.Domain.Capabilities;

/// <summary>
/// Tag capability for an entity that supports shared tag names.
/// </summary>
/// <param name="Items">Sorted tag entity references attached to the entity.</param>
public sealed record CapabilityTags(IReadOnlyList<EntityTag> Items) : ICapability<CapabilityTags>
{
    /// <summary>
    /// Creates a tags capability from display names when tag entity references have not been loaded.
    /// </summary>
    /// <param name="values">Sorted tag names attached to the entity.</param>
    public CapabilityTags(IReadOnlyList<string> values)
        : this(values.Select(value => new EntityTag(new EntityReference(Guid.Empty, EntityKindRegistry.Tag, value))).ToArray())
    {
    }

    /// <inheritdoc />
    public static ICapabilityKind<CapabilityTags> CapabilityKind { get; } = new CapabilityKind<CapabilityTags>("tags", "Tags");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>Sorted tag names attached to the entity.</summary>
    public IReadOnlyList<string> Values => Items.Select(item => item.Reference.Title).ToArray();

    /// <summary>A reusable empty tag capability.</summary>
    public static CapabilityTags Empty { get; } = new(Array.Empty<EntityTag>());
}
