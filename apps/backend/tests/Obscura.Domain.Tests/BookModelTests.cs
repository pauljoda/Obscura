using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Domain.Media;

namespace Obscura.Domain.Tests;

public sealed class BookModelTests
{
    [Fact]
    public void BookCarriesBaseEntityFieldsAndBookSpecificDetails()
    {
        var book = new Book(
            Guid.Parse("11111111-1111-1111-1111-111111111111"),
            "The Brass Archive",
            null,
            BookType: BookType.Comic,
            CoverPageId: null,
            capabilities:
            [
                new CapabilityStats([
                    new EntityStat("pages", 120),
                    new EntityStat("chapters", 6)
                ])
            ]);

        Assert.Equal("book", book.Kind.Code);
        Assert.Equal("The Brass Archive", book.Title);
        Assert.Equal(BookType.Comic, book.BookType);
        Assert.Equal(120, book.Stats?.Items.Single(stat => stat.Code == "pages").Value);
    }

    [Fact]
    public void BookMutatorsKeepBookRulesInsideTheBookModel()
    {
        var book = new Book(
            Guid.Parse("22222222-2222-2222-2222-222222222222"),
            "Draft Book",
            null,
            BookType: BookType.Book,
            CoverPageId: null,
            capabilities:
            [
                CapabilityProgress.Empty,
                new CapabilityDescription("Initial")
            ]);

        var entityWithDescription = book.WithCapability(
            CapabilityRegistry.Description,
            new CapabilityDescription("Updated from metadata."));
        var updated = (book with { Capabilities = entityWithDescription.Capabilities })
            .MoveReaderToChapter(Guid.Parse("33333333-3333-3333-3333-333333333333"), 4, 12, ReaderMode.Paged);

        Assert.Equal("Updated from metadata.", updated.Description);
        Assert.Equal(Guid.Parse("33333333-3333-3333-3333-333333333333"), updated.Progress?.CurrentEntityId);
        Assert.Equal(4, updated.Progress?.Index);
        Assert.Null(updated.Progress?.CompletedAt);
    }
}
