namespace Obscura.Domain.Capabilities;

/// <summary>
/// Validated scalar rating value shared by all rateable entity kinds.
/// </summary>
public readonly record struct RatingValue
{
    private RatingValue(int value)
    {
        Value = value;
    }

    /// <summary>
    /// Gets the normalized rating value.
    /// </summary>
    public int Value { get; }

    /// <summary>
    /// Validates and creates a rating value.
    /// </summary>
    /// <param name="value">Integer rating from 0 through 5.</param>
    /// <returns>A validated rating value.</returns>
    /// <exception cref="ArgumentOutOfRangeException">Thrown when the value is outside the supported 0 through 5 range.</exception>
    public static RatingValue Create(int value)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(value, 0);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(value, 5);

        return new RatingValue(value);
    }
}
