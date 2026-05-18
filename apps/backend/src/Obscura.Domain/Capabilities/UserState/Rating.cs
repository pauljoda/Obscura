namespace Obscura.Domain.Capabilities;

/// <summary>
/// Represents the rating capability once an entity has an explicit rating value.
/// </summary>
public sealed record Rating {
    /// <summary>Lowest rating value supported by Obscura.</summary>
    public const int MinValue = 0;

    /// <summary>Highest rating value supported by Obscura.</summary>
    public const int MaxValue = 5;

    private int _value;

    /// <summary>
    /// Creates a rating and normalizes it onto Obscura's shared zero-through-five rating scale.
    /// </summary>
    /// <param name="value">Integer rating value to clamp into the supported range.</param>
    public Rating(int value) {
        Value = value;
    }

    /// <summary>
    /// Gets or initializes the normalized rating value.
    /// </summary>
    public int Value {
        get => _value;
        init => _value = Normalize(value);
    }

    /// <summary>
    /// Returns a copy of the rating with a replacement value normalized onto the shared scale.
    /// </summary>
    /// <param name="value">Replacement integer rating value.</param>
    /// <returns>A rating with the replacement value clamped from zero through five.</returns>
    public Rating WithValue(int value) => this with { Value = value };

    /// <summary>
    /// Creates a rating from a nullable database value after callers have confirmed a rating exists.
    /// </summary>
    /// <param name="value">Nullable integer rating value from storage.</param>
    /// <returns>A rating with a normalized value between 0 and 5.</returns>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="value" /> is null.</exception>
    public static Rating FromNullable(int? value) {
        if (value is null) {
            throw new ArgumentNullException(nameof(value));
        }

        return new Rating(value.Value);
    }

    private static int Normalize(int value) => Math.Clamp(value, MinValue, MaxValue);
}
