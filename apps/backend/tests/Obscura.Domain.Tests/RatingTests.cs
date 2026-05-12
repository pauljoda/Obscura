using Obscura.Domain.Capabilities;

namespace Obscura.Domain.Tests;

public sealed class RatingTests
{
    [Theory]
    [InlineData(0)]
    [InlineData(3)]
    [InlineData(5)]
    public void ConstructorAcceptsIntegerRatingsOnTheSharedZeroToFiveScale(int value)
    {
        var rating = new Rating(value);

        Assert.Equal(value, rating.Value);
    }

    [Theory]
    [InlineData(-1, 0)]
    [InlineData(6, 5)]
    public void ConstructorClampsRatingsOutsideTheSharedZeroToFiveScale(int value, int normalizedValue)
    {
        var rating = new Rating(value);

        Assert.Equal(normalizedValue, rating.Value);
    }

    [Fact]
    public void WithValueClampsReplacementRatings()
    {
        var rating = new Rating(3);

        var updated = rating.WithValue(9);

        Assert.Equal(5, updated.Value);
    }
}
