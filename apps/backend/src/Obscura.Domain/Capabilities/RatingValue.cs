namespace Obscura.Domain.Capabilities;

public readonly record struct RatingValue
{
    private RatingValue(int value)
    {
        Value = value;
    }

    public int Value { get; }

    public static RatingValue Create(int value)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(value, 0);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(value, 5);

        return new RatingValue(value);
    }
}
