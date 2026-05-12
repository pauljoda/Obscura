using Obscura.Domain.Capabilities;

namespace Obscura.Domain.Tests;

public sealed class RatingValueTests
{
    [Theory]
    [InlineData(0)]
    [InlineData(3)]
    [InlineData(5)]
    public void CreateAcceptsIntegerRatingsOnTheSharedZeroToFiveScale(int value)
    {
        var rating = RatingValue.Create(value);

        Assert.Equal(value, rating.Value);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(6)]
    public void CreateRejectsRatingsOutsideTheSharedZeroToFiveScale(int value)
    {
        var error = Assert.Throws<ArgumentOutOfRangeException>(() => RatingValue.Create(value));

        Assert.Equal("value", error.ParamName);
    }
}
