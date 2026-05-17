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

    [Fact]
    public async Task ApplySeriesCascadePersistsEpisodeMetadataAndCredits()
    {
        await using var db = CreateContext();
        var seriesId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var seasonId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        var episodeId = Guid.Parse("44444444-4444-4444-4444-444444444444");
        SeedEntity(db, seriesId, "video-series", "Old Series");
        SeedEntity(db, seasonId, "video-season", "Old Season");
        SeedEntity(db, episodeId, "video", "Old Episode");
        db.VideoSeasonDetails.Add(new VideoSeasonDetailRow
        {
            EntityId = seasonId,
            SeriesEntityId = seriesId,
            SeasonNumber = 1
        });
        db.EntityHierarchyLinks.AddRange(
            new EntityHierarchyLinkRow
            {
                ParentEntityId = seriesId,
                ChildEntityId = seasonId,
                Relationship = "season",
                SortOrder = 1,
                CreatedAt = DateTimeOffset.UtcNow
            },
            new EntityHierarchyLinkRow
            {
                ParentEntityId = seasonId,
                ChildEntityId = episodeId,
                Relationship = "episode",
                SortOrder = 1,
                CreatedAt = DateTimeOffset.UtcNow
            });
        db.EntityPositions.Add(new EntityPositionRow
        {
            EntityId = episodeId,
            Code = "episodeNumber",
            Value = 1,
            UpdatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var episodePatch = new EntityMetadataPatch(
            Title: "Pilot",
            Description: "The story starts.",
            ExternalIds: new Dictionary<string, string> { ["tmdb"] = "9001" },
            Urls: ["https://www.themoviedb.org/tv/12/season/1/episode/1"],
            Tags: ["Guest Heavy"],
            Studio: null,
            Credits: [new CreditPatch("Guest Actor", "guest", "Visitor", 3)],
            Dates: new Dictionary<string, string> { ["air"] = "2026-05-16" },
            Counters: new Dictionary<string, int> { ["runtimeMinutes"] = 33 },
            Stats: new Dictionary<string, int> { ["voteAverage"] = 8 },
            Positions: new Dictionary<string, int> { ["seasonNumber"] = 1, ["episodeNumber"] = 1 },
            Classification: "episode");
        var proposal = new EntityMetadataProposal(
            ProposalId: "tmdb:tv:12",
            Provider: "tmdb",
            TargetKind: "video-series",
            Confidence: 1,
            MatchReason: "external-id",
            Patch: EmptyPatch(),
            Images: [],
            Children:
            [
                new EntityMetadataProposal(
                    ProposalId: "tmdb:tv:12:season:1",
                    Provider: "tmdb",
                    TargetKind: "video-season",
                    Confidence: 0.9m,
                    MatchReason: "cascade",
                    Patch: EmptyPatch() with
                    {
                        Title = "Season 1",
                        Positions = new Dictionary<string, int> { ["seasonNumber"] = 1 }
                    },
                    Images: [],
                    Children:
                    [
                        new EntityMetadataProposal(
                            ProposalId: "tmdb:tv:12:s1:e1",
                            Provider: "tmdb",
                            TargetKind: "video-episode",
                            Confidence: 0.9m,
                            MatchReason: "cascade",
                            Patch: episodePatch,
                            Images: [],
                            Children: [],
                            Candidates: [])
                    ],
                    Candidates: [])
            ],
            Candidates: []);

        var service = new EntityMetadataApplyService(db, new PluginArtworkServiceOptions(Path.GetTempPath()));
        await service.ApplyAsync(
            seriesId,
            proposal,
            selectedFields: ["externalIds"],
            selectedImages: null,
            CancellationToken.None);

        Assert.Equal("Season 1", (await db.Entities.FindAsync([seasonId]))?.Title);
        Assert.Equal("Pilot", (await db.Entities.FindAsync([episodeId]))?.Title);
        Assert.Equal("The story starts.", (await db.EntityDescriptions.FindAsync([episodeId]))?.Value);
        Assert.Equal("9001", (await db.EntityExternalIds.SingleAsync(row => row.EntityId == episodeId)).Value);
        Assert.Equal("https://www.themoviedb.org/tv/12/season/1/episode/1", await db.EntityUrls
            .Where(row => row.EntityId == episodeId)
            .Select(row => row.Url)
            .SingleAsync());
        Assert.Equal("Guest Actor", await db.Entities
            .Where(row => row.KindCode == "person")
            .Select(row => row.Title)
            .SingleAsync());
        Assert.Equal("Visitor", await db.EntityCreditLinks
            .Where(row => row.EntityId == episodeId)
            .Select(row => row.Character)
            .SingleAsync());
        Assert.Equal("2026-05-16", (await db.EntityDates.FindAsync([episodeId, "air"]))?.Value);
        Assert.Equal(33, (await db.EntityCounters.FindAsync([episodeId, "runtimeMinutes"]))?.Value);
        Assert.Equal(8, (await db.EntityStats.FindAsync([episodeId, "voteAverage"]))?.Value);
        Assert.Equal("episode", (await db.EntityClassifications.FindAsync([episodeId]))?.Value);
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

    private static EntityMetadataPatch EmptyPatch() => new(
        Title: null,
        Description: null,
        ExternalIds: new Dictionary<string, string>(),
        Urls: [],
        Tags: [],
        Studio: null,
        Credits: [],
        Dates: new Dictionary<string, string>(),
        Counters: new Dictionary<string, int>(),
        Stats: new Dictionary<string, int>(),
        Positions: new Dictionary<string, int>(),
        Classification: null);
}
