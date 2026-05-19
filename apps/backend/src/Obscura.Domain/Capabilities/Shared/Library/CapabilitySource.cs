namespace Obscura.Domain.Capabilities;

/// <summary>Mutable source capability for library, file, and import provenance values.</summary>
public sealed class CapabilitySource(IReadOnlyList<EntitySource>? items = null)
    : ItemsCapability<EntitySource>(items);
