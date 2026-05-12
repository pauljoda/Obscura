namespace Obscura.Domain.Capabilities;

/// <summary>Capability kind for user ratings.</summary>
public sealed class RatingCapabilityKind()
    : CapabilityKind<CapabilityRating>("rating", "Rating")
{
}
