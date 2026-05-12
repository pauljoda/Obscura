namespace Obscura.Domain.Capabilities;

/// <summary>Capability kind for shared tag names.</summary>
public sealed record TagsCapabilityKind()
    : ICapabilityKind<CapabilityTags>
{
    public string Code => "tags";
    public string DisplayName => "Tags";
    public Type CapabilityType => typeof(CapabilityTags);
}
