using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;
using Obscura.Domain.Media;
using Obscura.Domain.Taxonomy;
using Obscura.Infrastructure.Entities;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Tests;

public sealed class EfEntityRepositoryTests {
    [Fact]
    public async Task FindAsyncHydratesConcreteEntityRelationshipMapsAndCredits() {
        await using var db = CreateContext();
        var seriesId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var seasonId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var personId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        var tagId = Guid.Parse("44444444-4444-4444-4444-444444444444");
        SeedEntity(db, seriesId, EntityKind.VideoSeries, "Series");
        SeedEntity(db, seasonId, EntityKind.VideoSeason, "Season 1");
        SeedEntity(db, personId, EntityKind.Person, "Ada Person");
        SeedEntity(db, tagId, EntityKind.Tag, "Noir");
        db.EntityChildLinks.Add(new EntityChildLinkRow {
            ParentEntityId = seriesId,
            ChildEntityId = seasonId,
            ChildKindCode = EntityKindRegistry.VideoSeason.Code,
            SortOrder = 1,
            IsStructural = true,
            CreatedAt = DateTimeOffset.UtcNow
        });
        db.EntityRelationshipLinks.AddRange(
            new EntityRelationshipLinkRow {
                EntityId = seriesId,
                RelationshipCode = "related",
                Label = "Ada Person",
                TargetEntityId = personId,
                TargetKindCode = EntityKindRegistry.Person.Code,
                CreatedAt = DateTimeOffset.UtcNow
            },
            new EntityRelationshipLinkRow {
                EntityId = seriesId,
                RelationshipCode = "credits",
                Label = "Detective",
                TargetEntityId = personId,
                TargetKindCode = EntityKindRegistry.Person.Code,
                SortOrder = 1,
                MetadataJson = """{"role":"actor"}""",
                CreatedAt = DateTimeOffset.UtcNow
            });
        db.EntityRelationshipLinks.Add(
            new EntityRelationshipLinkRow {
                EntityId = seriesId,
                RelationshipCode = "related",
                Label = "Noir",
                TargetEntityId = tagId,
                TargetKindCode = EntityKindRegistry.Tag.Code,
                CreatedAt = DateTimeOffset.UtcNow
            });
        await db.SaveChangesAsync();

        var repository = new EfEntityRepository(db);
        var series = await repository.RequireAsync<VideoSeries>(seriesId, CancellationToken.None);

        Assert.Equal(EntityKind.VideoSeries, series.Kind);
        Assert.Same(Assert.Single(series.ChildrenOf<VideoSeason>()), series.ChildrenByKind[EntityKind.VideoSeason][0]);
        Assert.IsType<Tag>(Assert.Single(series.RelationshipsOf<Tag>()));
        var relatedPerson = Assert.Single(series.RelationshipsOf<Person>());
        var credits = series.Credits!.Credits;
        var credit = Assert.Single(credits);
        Assert.Same(relatedPerson, credit.Person);
        Assert.Equal(CreditRole.Actor, credits[0].Role);
        Assert.Equal("Detective", credits[0].Label);
    }

    [Fact]
    public async Task SaveAsyncPersistsBasicFieldsRelationshipMapsAndCredits() {
        await using var db = CreateContext();
        var series = new VideoSeries(Guid.Parse("55555555-5555-5555-5555-555555555555"), "Series");
        var season = new VideoSeason(Guid.Parse("66666666-6666-6666-6666-666666666666"), "Season 1", parentEntityId: null);
        var tag = new Tag(Guid.Parse("77777777-7777-7777-7777-777777777777"), "Noir");
        var person = new Person(Guid.Parse("88888888-8888-8888-8888-888888888888"), "Ada Person");
        series.AddChild(season, sortOrder: 3);
        series.AddRelationship(tag);
        series.Credits!.Add(person, CreditRole.Actor, "Detective");

        var repository = new EfEntityRepository(db);
        await repository.SaveAsync(series, CancellationToken.None);

        Assert.Equal("video-series", Assert.Single(db.Entities.Where(row => row.Id == series.Id)).KindCode);
        Assert.Equal(series.Id, Assert.Single(db.Entities.Where(row => row.Id == season.Id)).ParentEntityId);
        Assert.Contains(db.EntityChildLinks, link =>
            link.ParentEntityId == series.Id &&
            link.ChildEntityId == season.Id &&
            link.ChildKindCode == EntityKindRegistry.VideoSeason.Code &&
            link.SortOrder == 3);
        Assert.Contains(db.EntityRelationshipLinks, link =>
            link.EntityId == series.Id &&
            link.RelationshipCode == "related" &&
            link.TargetEntityId == tag.Id);
        var credit = Assert.Single(db.EntityRelationshipLinks.Where(link =>
            link.EntityId == series.Id &&
            link.RelationshipCode == "credits" &&
            link.TargetEntityId == person.Id));
        Assert.Equal("Detective", credit.Label);
        Assert.Contains("actor", credit.MetadataJson, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task MissingOptionalAndRequiredLoadsUseDifferentPaths() {
        await using var db = CreateContext();
        var repository = new EfEntityRepository(db);
        var id = Guid.Parse("99999999-9999-9999-9999-999999999999");

        Assert.Null(await repository.FindAsync<Video>(id, CancellationToken.None));
        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.RequireAsync<Video>(id, CancellationToken.None));
    }

    private static ObscuraDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<ObscuraDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static void SeedEntity(ObscuraDbContext db, Guid id, EntityKind kind, string title) {
        db.Entities.Add(new EntityRow {
            Id = id,
            KindCode = EntityKindRegistry.ToCode(kind),
            Title = title,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
    }
}
