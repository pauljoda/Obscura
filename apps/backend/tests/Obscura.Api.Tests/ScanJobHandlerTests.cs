using Microsoft.Extensions.Logging.Abstractions;
using Obscura.Application.Jobs;
using Obscura.Application.Jobs.Handlers;
using Obscura.Application.Jobs.Handlers.Scan;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Api.Tests;

public sealed class ScanJobHandlerTests {
    [Fact]
    public async Task VideoScanEnqueuesPreviewJobWhenOnlyTrickplayNeedsGeneration() {
        var root = new LibraryRootData(
            Guid.Parse("11111111-1111-1111-1111-111111111111"),
            "/media/videos",
            "Videos",
            Enabled: true,
            Recursive: true,
            ScanVideos: true,
            ScanImages: false,
            ScanAudio: false,
            ScanBooks: false,
            IsNsfw: false);
        var videoId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var persistence = new FakeScanPersistence([root]) {
            Settings = new LibrarySettingsData(
                AutoGenerateMetadata: false,
                AutoGenerateFingerprints: false,
                GeneratePhash: false,
                AutoGeneratePreview: false,
                GenerateTrickplay: true,
                TrickplayIntervalSeconds: 10,
                PreviewClipDurationSeconds: 8,
                ThumbnailQuality: 2,
                TrickplayQuality: 2),
            UpsertedVideoIds = [videoId],
            DownstreamNeedsById = new Dictionary<Guid, DownstreamNeeds> {
                [videoId] = new(
                    NeedsProbe: false,
                    NeedsFingerprint: false,
                    NeedsPreview: false,
                    NeedsTrickplay: true,
                    NeedsSubtitleExtraction: false)
            }
        };
        var discovery = new RecordingFileDiscovery(["/media/videos/movie.mkv"]);
        var queue = new RecordingJobQueue();
        var handler = new ScanLibraryJobHandler(
            NullLogger<ScanLibraryJobHandler>.Instance,
            discovery,
            persistence);
        var job = new JobRunSnapshot(
            Guid.NewGuid(),
            JobType.ScanLibrary,
            JobRunStatus.Running,
            Progress: 0,
            Message: null,
            PayloadJson: $$"""{"libraryRootId":"{{root.Id}}"}""",
            TargetEntityKind: "library-root",
            TargetEntityId: root.Id.ToString(),
            TargetLabel: root.Label,
            CreatedAt: DateTimeOffset.UtcNow,
            StartedAt: DateTimeOffset.UtcNow,
            FinishedAt: null);

        await handler.HandleAsync(new JobContext(job, queue), CancellationToken.None);

        var request = Assert.Single(queue.Enqueued);
        Assert.Equal(JobType.GeneratePreview, request.Type);
        Assert.Equal(videoId.ToString(), request.TargetEntityId);
    }

    [Fact]
    public async Task VideoScanClassifiesSeasonFolderEpisodesForHierarchyMaterialization() {
        var root = new LibraryRootData(
            Guid.Parse("11111111-1111-1111-1111-111111111111"),
            "/media/videos",
            "Videos",
            Enabled: true,
            Recursive: true,
            ScanVideos: true,
            ScanImages: false,
            ScanAudio: false,
            ScanBooks: false,
            IsNsfw: false);
        var videoId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var persistence = new FakeScanPersistence([root]) {
            Settings = new LibrarySettingsData(
                AutoGenerateMetadata: false,
                AutoGenerateFingerprints: false,
                GeneratePhash: false,
                AutoGeneratePreview: false,
                GenerateTrickplay: false,
                TrickplayIntervalSeconds: 10,
                PreviewClipDurationSeconds: 8,
                ThumbnailQuality: 2,
                TrickplayQuality: 2),
            UpsertedVideoIds = [videoId],
            DownstreamNeedsById = new Dictionary<Guid, DownstreamNeeds> {
                [videoId] = new(
                    NeedsProbe: false,
                    NeedsFingerprint: false,
                    NeedsPreview: false,
                    NeedsTrickplay: false,
                    NeedsSubtitleExtraction: false)
            }
        };
        var discovery = new RecordingFileDiscovery([
            "/media/videos/The Chair Company/Season 1/The Chair Company - S01E02 - New Blood.mkv"
        ]);
        var handler = new ScanLibraryJobHandler(
            NullLogger<ScanLibraryJobHandler>.Instance,
            discovery,
            persistence);
        var job = new JobRunSnapshot(
            Guid.NewGuid(),
            JobType.ScanLibrary,
            JobRunStatus.Running,
            Progress: 0,
            Message: null,
            PayloadJson: $$"""{"libraryRootId":"{{root.Id}}"}""",
            TargetEntityKind: "library-root",
            TargetEntityId: root.Id.ToString(),
            TargetLabel: root.Label,
            CreatedAt: DateTimeOffset.UtcNow,
            StartedAt: DateTimeOffset.UtcNow,
            FinishedAt: null);

        await handler.HandleAsync(new JobContext(job, new RecordingJobQueue()), CancellationToken.None);

        var item = Assert.Single(persistence.UpsertedVideoItems);
        Assert.Equal("The Chair Company", item.Series?.Title);
        Assert.Equal("/media/videos/The Chair Company", item.Series?.FolderPath);
        Assert.Equal("Season 1", item.Season?.Title);
        Assert.Equal("/media/videos/The Chair Company/Season 1", item.Season?.FolderPath);
        Assert.Equal(1, item.Season?.SeasonNumber);
        Assert.Equal(2, item.EpisodeNumber);
    }

    [Fact]
    public async Task HandlesScheduledLibraryRootPayloadAsSingleRootScan() {
        var targetRoot = new LibraryRootData(
            Guid.Parse("11111111-1111-1111-1111-111111111111"),
            "/media/one",
            "Root One",
            Enabled: true,
            Recursive: true,
            ScanVideos: true,
            ScanImages: false,
            ScanAudio: false,
            ScanBooks: false,
            IsNsfw: false);
        var otherRoot = targetRoot with {
            Id = Guid.Parse("22222222-2222-2222-2222-222222222222"),
            Path = "/media/two",
            Label = "Root Two"
        };
        var persistence = new FakeScanPersistence([targetRoot, otherRoot]);
        var handler = new RecordingScanHandler(persistence);
        var job = new JobRunSnapshot(
            Guid.NewGuid(),
            JobType.ScanLibrary,
            JobRunStatus.Running,
            Progress: 0,
            Message: null,
            PayloadJson: $$"""{"libraryRootId":"{{targetRoot.Id}}"}""",
            TargetEntityKind: "library-root",
            TargetEntityId: targetRoot.Id.ToString(),
            TargetLabel: targetRoot.Label,
            CreatedAt: DateTimeOffset.UtcNow,
            StartedAt: DateTimeOffset.UtcNow,
            FinishedAt: null);

        await handler.HandleAsync(new JobContext(job, new NoopJobQueue()), CancellationToken.None);

        Assert.Equal([targetRoot.Id], handler.ScannedRootIds);
        Assert.Equal(targetRoot.Id, persistence.LoadedRootIds.Single());
        Assert.False(persistence.LoadedEnabledRoots);
    }

    private sealed class RecordingScanHandler(FakeScanPersistence persistence)
        : ScanJobHandler(NullLogger<RecordingScanHandler>.Instance, new NoopFileDiscovery(), persistence) {
        public List<Guid> ScannedRootIds { get; } = [];

        public override JobType Type => JobType.ScanLibrary;

        protected override bool IsEligibleRoot(LibraryRootData root) => root.ScanVideos;

        protected override Task ScanRootAsync(
            JobContext context,
            LibraryRootData root,
            CancellationToken cancellationToken) {
            ScannedRootIds.Add(root.Id);
            return Task.CompletedTask;
        }
    }

    private sealed class FakeScanPersistence(IReadOnlyList<LibraryRootData> roots) : ILibraryScanPersistence {
        public List<Guid> LoadedRootIds { get; } = [];
        public bool LoadedEnabledRoots { get; private set; }
        public LibrarySettingsData Settings { get; init; } = new(
            AutoGenerateMetadata: true,
            AutoGenerateFingerprints: true,
            GeneratePhash: false,
            AutoGeneratePreview: true,
            GenerateTrickplay: true,
            TrickplayIntervalSeconds: 10,
            PreviewClipDurationSeconds: 8,
            ThumbnailQuality: 2,
            TrickplayQuality: 2);
        public IReadOnlyList<Guid> UpsertedVideoIds { get; init; } = [];
        public IReadOnlyDictionary<Guid, DownstreamNeeds> DownstreamNeedsById { get; init; } =
            new Dictionary<Guid, DownstreamNeeds>();
        public List<VideoUpsertItem> UpsertedVideoItems { get; } = [];

        public Task<LibraryRootData?> GetLibraryRootAsync(Guid rootId, CancellationToken cancellationToken) {
            LoadedRootIds.Add(rootId);
            return Task.FromResult(roots.FirstOrDefault(root => root.Id == rootId));
        }

        public Task<IReadOnlyList<LibraryRootData>> GetEnabledRootsAsync(CancellationToken cancellationToken) {
            LoadedEnabledRoots = true;
            return Task.FromResult(roots);
        }

        public Task<LibrarySettingsData> GetSettingsAsync(CancellationToken cancellationToken) =>
            Task.FromResult(Settings);

        public Task UpdateRootLastScannedAsync(Guid rootId, CancellationToken cancellationToken) =>
            Task.CompletedTask;

        public Task<Guid> UpsertVideoAsync(string filePath, string title, Guid libraryRootId, bool isNsfw, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<Guid> UpsertImageAsync(string filePath, string title, Guid? galleryEntityId, long? sizeBytes, int sortOrder, bool isNsfw, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<Guid> UpsertGalleryAsync(string folderPath, string title, Guid libraryRootId, bool isNsfw, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<Guid> UpsertAudioTrackAsync(string filePath, string title, Guid audioLibraryId, int sortOrder, bool isNsfw, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<Guid> UpsertAudioLibraryAsync(string folderPath, string title, Guid libraryRootId, bool isNsfw, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<Guid> UpsertBookAsync(string archivePath, string title, Guid libraryRootId, bool isNsfw, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<Guid> UpsertBookChapterAsync(string archivePath, string title, Guid bookEntityId, int pageCount, bool isNsfw, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<Guid> UpsertBookPageAsync(string filePath, string title, Guid bookEntityId, Guid chapterEntityId, int sortOrder, bool isNsfw, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<int> RemoveStaleVideosByRootAsync(Guid rootId, IReadOnlySet<string> validPaths, CancellationToken cancellationToken) =>
            Task.FromResult(0);

        public Task<int> RemoveStaleImagesInGalleryAsync(Guid galleryEntityId, IReadOnlySet<string> validPaths, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<int> RemoveStaleGalleriesInRootAsync(Guid rootId, IReadOnlySet<string> validFolderPaths, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<int> RemoveStaleAudioTracksInLibraryAsync(Guid libraryEntityId, IReadOnlySet<string> validPaths, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<int> RemoveStaleAudioLibrariesInRootAsync(Guid rootId, IReadOnlySet<string> validFolderPaths, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<int> RemoveStaleBookChaptersAsync(Guid bookEntityId, IReadOnlySet<string> validArchivePaths, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<int> RemoveStaleBooksInRootAsync(Guid rootId, IReadOnlySet<string> validPaths, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<int> RemoveOrphanSeriesAndSeasonsAsync(CancellationToken cancellationToken) =>
            Task.FromResult(0);

        public Task<IReadOnlyList<Guid>> UpsertVideosBatchAsync(IReadOnlyList<VideoUpsertItem> items, CancellationToken cancellationToken) {
            UpsertedVideoItems.AddRange(items);
            return Task.FromResult(UpsertedVideoIds);
        }

        public Task<IReadOnlyDictionary<Guid, DownstreamNeeds>> CheckDownstreamNeedsBatchAsync(IReadOnlyList<Guid> entityIds, CancellationToken cancellationToken) =>
            Task.FromResult(DownstreamNeedsById);

        public Task<bool> HasEntityTechnicalAsync(Guid entityId, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<bool> HasEntityFingerprintAsync(Guid entityId, FingerprintAlgorithm algorithm, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<bool> HasEntityFileAsync(Guid entityId, EntityFileRole role, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<bool> HasSubtitlesExtractedAsync(Guid entityId, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task UpsertEntityTechnicalAsync(Guid entityId, double? duration, int? width, int? height, double? frameRate, int? bitRate, int? sampleRate, int? channels, string? codec, string? container, string? format, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task UpsertMediaSourceAsync(Guid entityId, string path, MediaSourceProbeData source, IReadOnlyList<MediaStreamProbeData> streams, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task UpsertTrickplayInfoAsync(Guid entityId, TrickplayInfoData info, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task UpsertEntityFileAsync(Guid entityId, EntityFileRole role, string path, string? mimeType, long? sizeBytes, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task UpsertEntityFingerprintAsync(Guid entityId, FingerprintAlgorithm algorithm, string value, Guid? entityFileId, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<Guid?> GetSourceFileIdAsync(Guid entityId, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<string?> GetSourceFilePathAsync(Guid entityId, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task MarkSubtitlesExtractedAsync(Guid entityId, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task UpsertSubtitleAsync(Guid entityId, string language, string? label, string format, EntitySubtitleSource source, string storagePath, string sourceFormat, int streamIndex, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task UpsertAudioTrackTagsAsync(Guid entityId, string? artist, string? album, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<EntityTechnicalData?> GetEntityTechnicalAsync(Guid entityId, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlyList<EntityRefreshTarget>> GetEntityTreeAsync(Guid entityId, CancellationToken cancellationToken) =>
            throw new NotSupportedException();
    }

    private sealed class NoopFileDiscovery : IFileDiscovery {
        public Task<IReadOnlyList<string>> DiscoverFilesAsync(string rootPath, MediaCategory category, bool recursive, CancellationToken cancellationToken) =>
            throw new NotSupportedException();

        public Task<IReadOnlyDictionary<string, IReadOnlyList<string>>> DiscoverFilesByDirectoryAsync(string rootPath, MediaCategory category, bool recursive, CancellationToken cancellationToken) =>
            throw new NotSupportedException();
    }

    private sealed class RecordingFileDiscovery(IReadOnlyList<string> files) : IFileDiscovery {
        public Task<IReadOnlyList<string>> DiscoverFilesAsync(
            string rootPath, MediaCategory category, bool recursive, CancellationToken cancellationToken) =>
            Task.FromResult(files);

        public Task<IReadOnlyDictionary<string, IReadOnlyList<string>>> DiscoverFilesByDirectoryAsync(
            string rootPath, MediaCategory category, bool recursive, CancellationToken cancellationToken) =>
            throw new NotSupportedException();
    }

    private sealed class NoopJobQueue : IJobQueueService {
        public Task<IReadOnlyList<JobRunSnapshot>> ListAsync(CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<JobRunSnapshot>>([]);
        public Task<JobRunSnapshot> EnqueueAsync(JobType type, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<JobRunSnapshot> EnqueueAsync(EnqueueJobRequest request, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<bool> HasPendingAsync(JobType type, string? targetEntityId, CancellationToken cancellationToken) => Task.FromResult(false);
        public Task<int> EnqueueBatchAsync(IReadOnlyList<EnqueueJobRequest> requests, CancellationToken cancellationToken) => Task.FromResult(0);
        public Task<int> CancelAsync(JobType? type, CancellationToken cancellationToken) => Task.FromResult(0);
        public Task<bool> CancelRunAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(false);
        public Task<int> ClearFailuresAsync(JobType? type, CancellationToken cancellationToken) => Task.FromResult(0);
        public Task<JobRunSnapshot?> ClaimNextAsync(string workerId, CancellationToken cancellationToken) => Task.FromResult<JobRunSnapshot?>(null);
        public Task UpdateProgressAsync(Guid id, int progress, string? message, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task CompleteAsync(Guid id, string? message, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task FailAsync(Guid id, string message, TimeSpan retryDelay, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task<IReadOnlyList<JobQueueCount>> GetQueueCountsAsync(CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<JobQueueCount>>([]);
        public Task<int> PruneHistoryAsync(TimeSpan retention, CancellationToken cancellationToken) => Task.FromResult(0);
    }

    private sealed class RecordingJobQueue : IJobQueueService {
        public List<EnqueueJobRequest> Enqueued { get; } = [];

        public Task<IReadOnlyList<JobRunSnapshot>> ListAsync(CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<JobRunSnapshot>>([]);
        public Task<JobRunSnapshot> EnqueueAsync(JobType type, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<JobRunSnapshot> EnqueueAsync(EnqueueJobRequest request, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<bool> HasPendingAsync(JobType type, string? targetEntityId, CancellationToken cancellationToken) => Task.FromResult(false);
        public Task<int> EnqueueBatchAsync(IReadOnlyList<EnqueueJobRequest> requests, CancellationToken cancellationToken) {
            Enqueued.AddRange(requests);
            return Task.FromResult(requests.Count);
        }
        public Task<int> CancelAsync(JobType? type, CancellationToken cancellationToken) => Task.FromResult(0);
        public Task<bool> CancelRunAsync(Guid id, CancellationToken cancellationToken) => Task.FromResult(false);
        public Task<int> ClearFailuresAsync(JobType? type, CancellationToken cancellationToken) => Task.FromResult(0);
        public Task<JobRunSnapshot?> ClaimNextAsync(string workerId, CancellationToken cancellationToken) => Task.FromResult<JobRunSnapshot?>(null);
        public Task UpdateProgressAsync(Guid id, int progress, string? message, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task CompleteAsync(Guid id, string? message, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task FailAsync(Guid id, string message, TimeSpan retryDelay, CancellationToken cancellationToken) => Task.CompletedTask;
        public Task<IReadOnlyList<JobQueueCount>> GetQueueCountsAsync(CancellationToken cancellationToken) => Task.FromResult<IReadOnlyList<JobQueueCount>>([]);
        public Task<int> PruneHistoryAsync(TimeSpan retention, CancellationToken cancellationToken) => Task.FromResult(0);
    }
}
