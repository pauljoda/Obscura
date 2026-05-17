using Microsoft.EntityFrameworkCore;
using Obscura.Contracts.Plugins;
using Obscura.Domain.Entities;
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
            SeasonNumber = 1
        });
        db.EntityChildLinks.AddRange(
            new EntityChildLinkRow
            {
                ParentEntityId = seriesId,
                ChildEntityId = seasonId,
                ChildKindCode = EntityKindRegistry.VideoSeason.Code,
                SortOrder = 1,
                IsStructural = true,
                CreatedAt = DateTimeOffset.UtcNow
            },
            new EntityChildLinkRow
            {
                ParentEntityId = seasonId,
                ChildEntityId = episodeId,
                ChildKindCode = EntityKindRegistry.Video.Code,
                SortOrder = 1,
                IsStructural = true,
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
                    TargetEntityId: seasonId,
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
                            TargetEntityId: episodeId,
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

    [Fact]
    public async Task ApplyProposalChildrenWithTargetEntityIdsRecursesThroughGenericGraph()
    {
        await using var db = CreateContext();
        var parentId = Guid.Parse("55555555-5555-5555-5555-555555555555");
        var childId = Guid.Parse("66666666-6666-6666-6666-666666666666");
        var grandchildId = Guid.Parse("77777777-7777-7777-7777-777777777777");
        SeedEntity(db, parentId, "video-series", "Old Series");
        SeedEntity(db, childId, "video-season", "Old Season");
        SeedEntity(db, grandchildId, "video", "Old Episode");
        db.EntityChildLinks.AddRange(
            new EntityChildLinkRow
            {
                ParentEntityId = parentId,
                ChildEntityId = childId,
                ChildKindCode = "video-season",
                SortOrder = 1,
                IsStructural = true,
                CreatedAt = DateTimeOffset.UtcNow
            },
            new EntityChildLinkRow
            {
                ParentEntityId = childId,
                ChildEntityId = grandchildId,
                ChildKindCode = "video",
                SortOrder = 1,
                IsStructural = true,
                CreatedAt = DateTimeOffset.UtcNow
            });
        await db.SaveChangesAsync();

        var proposal = new EntityMetadataProposal(
            ProposalId: "provider:series:1",
            Provider: "provider",
            TargetKind: "video-series",
            TargetEntityId: parentId,
            Confidence: 1,
            MatchReason: "external-id",
            Patch: EmptyPatch() with { Title = "New Series" },
            Images: [],
            Children:
            [
                new EntityMetadataProposal(
                    ProposalId: "provider:season:1",
                    Provider: "provider",
                    TargetKind: "video-season",
                    TargetEntityId: childId,
                    Confidence: 1,
                    MatchReason: "graph-child",
                    Patch: EmptyPatch() with
                    {
                        Title = "New Season",
                        Dates = new Dictionary<string, string> { ["air"] = "2026-01-01" }
                    },
                    Images: [],
                    Children:
                    [
                        new EntityMetadataProposal(
                            ProposalId: "provider:episode:1",
                            Provider: "provider",
                            TargetKind: "video",
                            TargetEntityId: grandchildId,
                            Confidence: 1,
                            MatchReason: "graph-child",
                            Patch: EmptyPatch() with
                            {
                                Title = "New Episode",
                                Description = "Episode metadata from its own proposal.",
                                Positions = new Dictionary<string, int> { ["episodeNumber"] = 1 }
                            },
                            Images: [],
                            Children: [],
                            Candidates: [])
                    ],
                    Candidates: [])
            ],
            Candidates: []);

        var service = new EntityMetadataApplyService(db, new PluginArtworkServiceOptions(Path.GetTempPath()));
        await service.ApplyAsync(parentId, proposal, selectedFields: ["title"], selectedImages: null, CancellationToken.None);

        Assert.Equal("New Series", (await db.Entities.FindAsync([parentId]))?.Title);
        Assert.Equal("New Season", (await db.Entities.FindAsync([childId]))?.Title);
        Assert.Equal("2026-01-01", (await db.EntityDates.FindAsync([childId, "air"]))?.Value);
        Assert.Equal("New Episode", (await db.Entities.FindAsync([grandchildId]))?.Title);
        Assert.Equal("Episode metadata from its own proposal.", (await db.EntityDescriptions.FindAsync([grandchildId]))?.Value);
        Assert.Equal(1, (await db.EntityPositions.FindAsync([grandchildId, "episode"]))?.Value);
    }

    [Fact]
    public async Task ApplyCascadePositionsUpdatesCanonicalPositionsAndStructuralSortOrder()
    {
        await using var db = CreateContext();
        var seriesId = Guid.Parse("88888888-8888-8888-8888-888888888888");
        var seasonId = Guid.Parse("99999999-9999-9999-9999-999999999999");
        var episodeId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        SeedEntity(db, seriesId, "video-series", "Series");
        SeedEntity(db, seasonId, "video-season", "Season", parentEntityId: seriesId, sortOrder: 1);
        SeedEntity(db, episodeId, "video", "Episode", parentEntityId: seasonId, sortOrder: 1);
        db.VideoSeasonDetails.Add(new VideoSeasonDetailRow
        {
            EntityId = seasonId,
            SeasonNumber = 1
        });
        db.EntityChildLinks.AddRange(
            new EntityChildLinkRow
            {
                ParentEntityId = seriesId,
                ChildEntityId = seasonId,
                ChildKindCode = "video-season",
                SortOrder = 1,
                IsStructural = true,
                CreatedAt = DateTimeOffset.UtcNow
            },
            new EntityChildLinkRow
            {
                ParentEntityId = seasonId,
                ChildEntityId = episodeId,
                ChildKindCode = "video",
                SortOrder = 1,
                IsStructural = true,
                CreatedAt = DateTimeOffset.UtcNow
            });
        await db.SaveChangesAsync();

        var proposal = new EntityMetadataProposal(
            ProposalId: "provider:series:positions",
            Provider: "provider",
            TargetKind: "video-series",
            TargetEntityId: seriesId,
            Confidence: 1,
            MatchReason: "external-id",
            Patch: EmptyPatch(),
            Images: [],
            Children:
            [
                new EntityMetadataProposal(
                    ProposalId: "provider:season:3",
                    Provider: "provider",
                    TargetKind: "video-season",
                    TargetEntityId: seasonId,
                    Confidence: 1,
                    MatchReason: "graph-child",
                    Patch: EmptyPatch() with
                    {
                        Positions = new Dictionary<string, int> { ["seasonNumber"] = 3 }
                    },
                    Images: [],
                    Children:
                    [
                        new EntityMetadataProposal(
                            ProposalId: "provider:episode:2",
                            Provider: "provider",
                            TargetKind: "video",
                            TargetEntityId: episodeId,
                            Confidence: 1,
                            MatchReason: "graph-child",
                            Patch: EmptyPatch() with
                            {
                                Positions = new Dictionary<string, int> { ["episodeNumber"] = 2 }
                            },
                            Images: [],
                            Children: [],
                            Candidates: [])
                    ],
                    Candidates: [])
            ],
            Candidates: []);

        var service = new EntityMetadataApplyService(db, new PluginArtworkServiceOptions(Path.GetTempPath()));
        await service.ApplyAsync(seriesId, proposal, selectedFields: [], selectedImages: null, CancellationToken.None);

        Assert.Equal(3, (await db.Entities.FindAsync([seasonId]))?.SortOrder);
        Assert.Equal(2, (await db.Entities.FindAsync([episodeId]))?.SortOrder);
        Assert.Equal(3, (await db.VideoSeasonDetails.FindAsync([seasonId]))?.SeasonNumber);
        Assert.Equal(3, (await db.EntityChildLinks.FindAsync([seriesId, seasonId, "video-season"]))?.SortOrder);
        Assert.Equal(2, (await db.EntityChildLinks.FindAsync([seasonId, episodeId, "video"]))?.SortOrder);
        Assert.Equal(3, (await db.EntityPositions.FindAsync([seasonId, "season"]))?.Value);
        Assert.Equal(2, (await db.EntityPositions.FindAsync([episodeId, "episode"]))?.Value);
        Assert.Null(await db.EntityPositions.FindAsync([seasonId, "seasonNumber"]));
        Assert.Null(await db.EntityPositions.FindAsync([episodeId, "episodeNumber"]));
    }

    [Fact]
    public async Task ApplyGraphChildCreditsDeduplicatesRepeatedPeople()
    {
        await using var db = CreateContext();
        var seriesId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        var episodeId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
        var personId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
        SeedEntity(db, seriesId, "video-series", "Series");
        SeedEntity(db, episodeId, "video", "Episode", parentEntityId: seriesId, sortOrder: 1);
        SeedEntity(db, personId, "person", "Returning Actor");
        db.EntityChildLinks.Add(new EntityChildLinkRow
        {
            ParentEntityId = seriesId,
            ChildEntityId = episodeId,
            ChildKindCode = "video",
            SortOrder = 1,
            IsStructural = true,
            CreatedAt = DateTimeOffset.UtcNow
        });
        await db.SaveChangesAsync();

        var proposal = new EntityMetadataProposal(
            ProposalId: "provider:series:credits",
            Provider: "provider",
            TargetKind: "video-series",
            TargetEntityId: seriesId,
            Confidence: 1,
            MatchReason: "external-id",
            Patch: EmptyPatch(),
            Images: [],
            Children:
            [
                new EntityMetadataProposal(
                    ProposalId: "provider:episode:credits",
                    Provider: "provider",
                    TargetKind: "video",
                    TargetEntityId: episodeId,
                    Confidence: 1,
                    MatchReason: "graph-child",
                    Patch: EmptyPatch() with
                    {
                        Credits =
                        [
                            new CreditPatch("Returning Actor", "person", "New Character", 0),
                            new CreditPatch("Returning Actor", "person", "Duplicate Character", 1)
                        ]
                    },
                    Images: [],
                    Children: [],
                    Candidates: [])
            ],
            Candidates: []);

        var service = new EntityMetadataApplyService(db, new PluginArtworkServiceOptions(Path.GetTempPath()));
        await service.ApplyAsync(seriesId, proposal, selectedFields: [], selectedImages: null, CancellationToken.None);

        var credit = await db.EntityCreditLinks.SingleAsync(row => row.EntityId == episodeId);
        Assert.Equal(personId, credit.PersonEntityId);
        Assert.Equal("New Character", credit.Character);
        Assert.Equal(0, credit.SortOrder);
    }

    private static ObscuraDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ObscuraDbContext>()
            .UseInMemoryDatabase($"metadata-apply-{Guid.NewGuid():N}")
            .Options;

        return new ObscuraDbContext(options);
    }

    private static void SeedEntity(
        ObscuraDbContext db,
        Guid id,
        string kind,
        string title,
        Guid? parentEntityId = null,
        int? sortOrder = null)
    {
        db.Entities.Add(new EntityRow
        {
            Id = id,
            KindCode = kind,
            Title = title,
            ParentEntityId = parentEntityId,
            SortOrder = sortOrder,
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
