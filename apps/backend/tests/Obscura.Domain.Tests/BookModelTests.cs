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
            SortTitle: "Brass Archive",
            Summary: null,
            Date: null,
            FolderPath: null,
            RelativePath: null,
            CoverPageId: null,
            CoverImagePath: null,
            PageCount: 120,
            ChapterCount: 6,
            CurrentChapterId: null,
            CurrentPageIndex: 0,
            CurrentChapterPageCount: 0,
            ReaderMode: ReaderMode.Paged,
            CompletedAt: null);

        Assert.Equal("book", book.Kind.Code);
        Assert.Equal("The Brass Archive", book.Title);
        Assert.Equal(BookType.Comic, book.BookType);
        Assert.Equal(120, book.PageCount);
    }

    [Fact]
    public void BookMutatorsKeepBookRulesInsideTheBookModel()
    {
        var book = new Book(
            Guid.Parse("22222222-2222-2222-2222-222222222222"),
            "Draft Book",
            null,
            BookType: BookType.Book,
            SortTitle: null,
            Summary: null,
            Date: null,
            FolderPath: null,
            RelativePath: null,
            CoverPageId: null,
            CoverImagePath: null,
            PageCount: 0,
            ChapterCount: 0,
            CurrentChapterId: null,
            CurrentPageIndex: 0,
            CurrentChapterPageCount: 0,
            ReaderMode: ReaderMode.Paged,
            CompletedAt: null);

        var updated = book
            with { Summary = "Updated from metadata.", PageCount = 12 };
        updated = updated
            .MoveReaderToChapter(Guid.Parse("33333333-3333-3333-3333-333333333333"), 4, 12, ReaderMode.Paged);

        Assert.Equal("Updated from metadata.", updated.Summary);
        Assert.Equal(12, updated.PageCount);
        Assert.Equal(Guid.Parse("33333333-3333-3333-3333-333333333333"), updated.CurrentChapterId);
        Assert.Equal(4, updated.CurrentPageIndex);
        Assert.Null(updated.CompletedAt);
    }
}
