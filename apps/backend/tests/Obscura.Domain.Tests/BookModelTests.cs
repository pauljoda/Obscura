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
            BookDetails.Empty with
            {
                BookType = BookType.Comic,
                SortTitle = "Brass Archive",
                PageCount = 120,
                ChapterCount = 6
            },
            BookReadProgress.Empty);

        Assert.Equal("book", book.Kind.Code);
        Assert.Equal("The Brass Archive", book.Title);
        Assert.Equal(BookType.Comic, book.Details.BookType);
        Assert.Equal(120, book.Details.PageCount);
    }

    [Fact]
    public void BookMutatorsKeepBookRulesInsideTheBookModel()
    {
        var book = new Book(
            Guid.Parse("22222222-2222-2222-2222-222222222222"),
            "Draft Book",
            null,
            BookDetails.Empty,
            BookReadProgress.Empty);

        var updated = book
            .WithDetails(book.Details with { Summary = "Updated from metadata.", PageCount = 12 })
            .MoveReaderToChapter(Guid.Parse("33333333-3333-3333-3333-333333333333"), 4, 12, ReaderMode.Paged);

        Assert.Equal("Updated from metadata.", updated.Details.Summary);
        Assert.Equal(12, updated.Details.PageCount);
        Assert.Equal(Guid.Parse("33333333-3333-3333-3333-333333333333"), updated.ReadProgress.ChapterId);
        Assert.Equal(4, updated.ReadProgress.PageIndex);
        Assert.Null(updated.ReadProgress.CompletedAt);
    }
}
