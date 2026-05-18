namespace Obscura.Domain.Capabilities;

/// <summary>
/// Mutable flag capability for shared user-facing boolean state.
/// </summary>
public sealed class CapabilityFlags : EntityCapability {
    public CapabilityFlags(bool? isFavorite = null, bool? isNsfw = null, bool? isOrganized = null) {
        IsFavorite = isFavorite;
        IsNsfw = isNsfw;
        IsOrganized = isOrganized;
    }

    public override CapabilityKind Kind => CapabilityKind.Flags;
    public bool? IsFavorite { get; private set; }
    public bool? IsNsfw { get; private set; }
    public bool? IsOrganized { get; private set; }
}
