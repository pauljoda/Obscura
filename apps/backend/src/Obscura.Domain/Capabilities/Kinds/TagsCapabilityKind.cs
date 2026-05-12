namespace Obscura.Domain.Capabilities;

/// <summary>Capability kind for shared tag names.</summary>
public sealed class TagsCapabilityKind()
    : CapabilityKind<CapabilityTags>("tags", "Tags")
{
}
