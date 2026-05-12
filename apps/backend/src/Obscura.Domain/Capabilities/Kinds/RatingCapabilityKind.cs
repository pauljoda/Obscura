namespace Obscura.Domain.Capabilities;

/// <summary>Capability kind for user ratings.</summary>
public sealed record RatingCapabilityKind()
    : ICapabilityKind<CapabilityRating>
{
    public string Code => "rating";
    public string DisplayName => "Rating";
    public Type CapabilityType => typeof(CapabilityRating);
}
