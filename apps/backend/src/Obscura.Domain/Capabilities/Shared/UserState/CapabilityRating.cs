namespace Obscura.Domain.Capabilities;

/// <summary>
/// Mutable rating capability for entities that support user ratings.
/// </summary>
public sealed class CapabilityRating : EntityCapability {
    /// <summary>
    /// Creates a rating capability.
    /// </summary>
    /// <param name="value">Optional zero-through-five rating value.</param>
    public CapabilityRating(int? value = null) {
        Value = value is null ? null : new Rating(value.Value).Value;
    }

    /// <inheritdoc />

    /// <summary>Current normalized rating value, or null when unrated.</summary>
    public int? Value { get; private set; }

    /// <summary>
    /// Sets the rating value.
    /// </summary>
    /// <param name="value">Rating value clamped onto the shared zero-through-five scale.</param>
    public void Rate(int value) {
        Value = new Rating(value).Value;
    }

    /// <summary>Clears the current rating.</summary>
    public void Clear() {
        Value = null;
    }
}
