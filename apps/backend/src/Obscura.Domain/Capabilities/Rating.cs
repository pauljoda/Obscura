namespace Obscura.Domain.Capabilities;

public sealed record Rating(RatingValue Value)
{
    public static Rating FromNullable(int? value)
    {
        if (value is null)
        {
            throw new ArgumentNullException(nameof(value));
        }

        return new Rating(RatingValue.Create(value.Value));
    }
}
