using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Entities;
using Obscura.Domain.Media;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Entities.Mappers.Kinds;

internal sealed class BookKindMapper(ObscuraDbContext db) : IEntityKindMapper {
    public EntityKind Kind => EntityKind.Book;

    public async Task<Entity> ConstructAsync(EntityRow row, CancellationToken cancellationToken) {
        var detail = await db.BookDetails.AsNoTracking()
            .FirstOrDefaultAsync(d => d.EntityId == row.Id, cancellationToken);
        return new Book(row.Id, row.Title, detail?.BookType ?? BookType.Book, detail?.CoverPageEntityId);
    }

    public async Task PersistDetailAsync(Entity entity, CancellationToken cancellationToken) {
        if (entity is not Book book) {
            return;
        }

        var row = await db.BookDetails.FindAsync([entity.Id], cancellationToken)
            ?? Track(new BookDetailRow { EntityId = entity.Id });
        row.BookType = book.BookType;
        row.CoverPageEntityId = book.CoverPageId;
    }

    private BookDetailRow Track(BookDetailRow row) {
        db.BookDetails.Add(row);
        return row;
    }
}
