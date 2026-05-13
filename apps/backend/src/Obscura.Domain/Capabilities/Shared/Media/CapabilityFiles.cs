namespace Obscura.Domain.Capabilities;

/// <summary>
/// File capability for an entity that supports attached source, generated, or cached files.
/// </summary>
/// <param name="Items">Projected files attached to the entity.</param>
public sealed record CapabilityFiles(IReadOnlyList<EntityFile> Items) : ICapability<CapabilityFiles>
{
    /// <inheritdoc />
    public static ICapabilityKind<CapabilityFiles> CapabilityKind { get; } = new CapabilityKind<CapabilityFiles>("files", "Files");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>A reusable empty file capability.</summary>
    public static CapabilityFiles Empty { get; } = new([]);
}
