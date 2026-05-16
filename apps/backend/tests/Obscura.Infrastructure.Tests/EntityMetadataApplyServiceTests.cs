using Microsoft.EntityFrameworkCore;
using Obscura.Contracts.Plugins;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;
using Obscura.Infrastructure.Plugins;

namespace Obscura.Infrastructure.Tests;

public sealed class EntityMetadataApplyServiceTests
{
    [Fact]
    public async Task ApplySelectedFieldsPersistsProviderIdentityAndCapabilityRows()
    {
        await using var db = CreateContext();
        var entityId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        SeedEntity(db, entityId, "video", "Old Title");
        await db.SaveChangesAsync();

        var proposal = new EntityMetadataProposal(
            ProposalId: "tmdb:movie:123",
            Provider: "tmdb",
            TargetKind: "video",
            Confidence: 1,
            MatchReason: "external-id",
            Patch: new EntityMetadataPatch(
                Title: "New Movie",
                Description: "A better description.",
                ExternalIds: new Dictionary<string, string> { ["tmdb"] = "123" },
                Urls: ["https://www.themoviedb.org/movie/123"],
                Tags: ["Drama", "Mystery"],
                Studio: "Obscura Pictures",
                Credits: [new CreditPatch("Ada Actor", "person", "Lead", 0)],
                Dates: new Dictionary<string, string> { ["released"] = "2026-05-16" },
                Counters: new Dictionary<string, int> { ["runtime-minutes"] = 90 },
                Stats: new Dictionary<string, int> { ["votes"] = 42 },
                Positions: new Dictionary<string, int>(),
                Classification: "movie"),
            Images: [],
            Children: [],
            Candidates: []);

        var service = new EntityMetadataApplyService(db, new PluginArtworkServiceOptions(Path.GetTempPath()));
        await service.ApplyAsync(
            entityId,
            proposal,
            ["title", "description", "externalIds", "urls", "tags", "studio", "credits", "dates", "counters", "stats", "classification"],
            selectedImages: null,
            CancellationToken.None);

        var entity = await db.Entities.SingleAsync(row => row.Id == entityId);
        Assert.Equal("New Movie", entity.Title);
        Assert.Equal("A better description.", (await db.EntityDescriptions.FindAsync([entityId]))?.Value);
        var externalId = await db.EntityExternalIds.SingleAsync();
        Assert.Equal("tmdb", externalId.Provider);
        Assert.Equal("123", externalId.Value);
        Assert.Equal("https://www.themoviedb.org/movie/123", externalId.Url);
        Assert.Equal(["Drama", "Mystery"], await db.Entities
            .Where(row => row.KindCode == "tag")
            .OrderBy(row => row.Title)
            .Select(row => row.Title)
            .ToArrayAsync());
        Assert.Equal("Obscura Pictures", await db.Entities
            .Where(row => row.KindCode == "studio")
            .Select(row => row.Title)
            .SingleAsync());
        Assert.Equal("Ada Actor", await db.Entities
            .Where(row => row.KindCode == "person")
            .Select(row => row.Title)
            .SingleAsync());
        Assert.Equal("2026-05-16", (await db.EntityDates.FindAsync([entityId, "released"]))?.Value);
        Assert.Equal(90, (await db.EntityCounters.FindAsync([entityId, "runtime-minutes"]))?.Value);
        Assert.Equal(42, (await db.EntityStats.FindAsync([entityId, "votes"]))?.Value);
        Assert.Equal("movie", (await db.EntityClassifications.FindAsync([entityId]))?.Value);
    }

    private static ObscuraDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ObscuraDbContext>()
            .UseInMemoryDatabase($"metadata-apply-{Guid.NewGuid():N}")
            .Options;

        return new ObscuraDbContext(options);
    }

    private static void SeedEntity(ObscuraDbContext db, Guid id, string kind, string title)
    {
        db.Entities.Add(new EntityRow
        {
            Id = id,
            KindCode = kind,
            Title = title,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
    }
}
