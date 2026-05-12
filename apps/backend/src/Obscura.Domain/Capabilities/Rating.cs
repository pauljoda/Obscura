namespace Obscura.Domain.Capabilities;

/// <summary>
/// Represents the rating capability once an entity has an explicit rating value.
/// </summary>
/// <param name="Value">Validated rating value stored on the entity.</param>
public sealed record Rating(RatingValue Value)
{
    /// <summary>
    /// Creates a rating from a nullable database value after callers have confirmed a rating exists.
    /// </summary>
    /// <param name="value">Nullable integer rating value from storage.</param>
    /// <returns>A rating with a validated value between 0 and 5.</returns>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="value" /> is null.</exception>
    public static Rating FromNullable(int? value)
    {
        if (value is null)
        {
            throw new ArgumentNullException(nameof(value));
        }

        return new Rating(RatingValue.Create(value.Value));
    }
}
