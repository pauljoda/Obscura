using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs;

/// <summary>
/// Application use-case service for listing, creating, and bulk-orchestrating background jobs.
/// </summary>
public sealed class JobService
{
    private readonly IJobQueueService _queue;
    private readonly IMaintenancePersistence _maintenance;
    private readonly ILibraryScanPersistence _scanPersistence;

    /// <summary>
    /// Creates a job service over the durable queue and maintenance persistence ports.
    /// </summary>
    /// <param name="queue">Queue port implemented by infrastructure persistence.</param>
    /// <param name="maintenance">Maintenance persistence port used to enumerate active entities for bulk operations.</param>
    /// <param name="scanPersistence">Library scan persistence port used to check existing fingerprints during bulk backfill.</param>
    public JobService(
        IJobQueueService queue,
        IMaintenancePersistence maintenance,
        ILibraryScanPersistence scanPersistence)
    {
        _queue = queue;
        _maintenance = maintenance;
        _scanPersistence = scanPersistence;
    }

    /// <summary>
    /// Lists recent job runs for the operations dashboard.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Application job list result.</returns>
    public async Task<JobListResult> ListAsync(CancellationToken cancellationToken)
    {
        var items = (await _queue.ListAsync(cancellationToken)).Select(ToResult).ToArray();
        var counts = (await _queue.GetQueueCountsAsync(cancellationToken))
            .Select(c => new JobQueueCountResult(c.TypeCode, c.StatusCode, c.Count))
            .ToArray();
        return new JobListResult(items, counts);
    }

    /// <summary>
    /// Creates a job from a typed queue operation.
    /// </summary>
    /// <param name="type">Typed job operation supplied by the API boundary.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Application create result for the queued job.</returns>
    public async Task<JobCreateResult> CreateAsync(JobType type, CancellationToken cancellationToken)
    {
        var job = await _queue.EnqueueAsync(type, cancellationToken);
        return new JobCreateResult(ToResult(job));
    }

    /// <summary>
    /// Cancels queued or running jobs, optionally scoped to one typed operation.
    /// </summary>
    /// <param name="type">Optional job type scope.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Count of jobs marked cancelled.</returns>
    public async Task<JobCancelResult> CancelAsync(JobType? type, CancellationToken cancellationToken)
    {
        var cancelled = await _queue.CancelAsync(type, cancellationToken);
        return new JobCancelResult(cancelled);
    }

    /// <summary>
    /// Cancels a single queued or running job by identifier.
    /// </summary>
    /// <param name="id">Job run identifier.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Response with a one-or-zero cancellation count.</returns>
    public async Task<JobCancelResult> CancelRunAsync(Guid id, CancellationToken cancellationToken)
    {
        var cancelled = await _queue.CancelRunAsync(id, cancellationToken);
        return new JobCancelResult(cancelled ? 1 : 0);
    }

    /// <summary>
    /// Clears failed jobs from the active failure list, optionally scoped to one typed operation.
    /// </summary>
    /// <param name="type">Optional job type scope.</param>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Count of failed jobs cleared.</returns>
    public async Task<JobFailureClearResult> ClearFailuresAsync(
        JobType? type,
        CancellationToken cancellationToken)
    {
        var cleared = await _queue.ClearFailuresAsync(type, cancellationToken);
        return new JobFailureClearResult(cleared);
    }

    /// <summary>
    /// Enqueues preview-asset generation jobs for every active media entity that does not
    /// already have a matching job pending. Used by the operations dashboard "rebuild previews"
    /// maintenance action.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Counts of newly enqueued jobs and entities skipped because a job was already pending.</returns>
    public async Task<BulkJobResult> RebuildPreviewsAsync(CancellationToken cancellationToken)
    {
        var previewKinds = new (EntityKind Kind, JobType JobType)[]
        {
            (EntityKind.Video, JobType.GeneratePreview),
            (EntityKind.Image, JobType.GenerateImageThumbnail),
            (EntityKind.BookPage, JobType.GenerateBookPageThumbnail),
            (EntityKind.AudioTrack, JobType.GenerateAudioWaveform),
        };

        int enqueued = 0, skipped = 0;
        foreach (var (kind, jobType) in previewKinds)
        {
            var entityIds = await _maintenance.GetActiveEntityIdsByKindAsync(kind, cancellationToken);
            foreach (var entityId in entityIds)
            {
                var id = entityId.ToString();
                if (await _queue.HasPendingAsync(jobType, id, cancellationToken))
                {
                    skipped++;
                    continue;
                }

                await _queue.EnqueueAsync(
                    new EnqueueJobRequest(
                        Type: jobType,
                        TargetEntityKind: EntityKindRegistry.ToCode(kind),
                        TargetEntityId: id),
                    cancellationToken);
                enqueued++;
            }
        }

        return new BulkJobResult(enqueued, skipped);
    }

    /// <summary>
    /// Enqueues fingerprint generation jobs for every active media entity that does not yet have a
    /// stored MD5 fingerprint and does not already have a fingerprint job pending. Used by the
    /// operations dashboard "backfill fingerprints" maintenance action.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel the operation.</param>
    /// <returns>Counts of newly enqueued jobs and entities skipped because of an existing fingerprint or pending job.</returns>
    public async Task<BulkJobResult> BackfillFingerprintsAsync(CancellationToken cancellationToken)
    {
        var fingerprintKinds = new (EntityKind Kind, JobType JobType)[]
        {
            (EntityKind.Video, JobType.FingerprintVideo),
            (EntityKind.Image, JobType.FingerprintImage),
            (EntityKind.AudioTrack, JobType.FingerprintAudio),
        };

        int enqueued = 0, skipped = 0;
        foreach (var (kind, jobType) in fingerprintKinds)
        {
            var entityIds = await _maintenance.GetActiveEntityIdsByKindAsync(kind, cancellationToken);
            foreach (var entityId in entityIds)
            {
                if (await _scanPersistence.HasEntityFingerprintAsync(
                        entityId,
                        FingerprintAlgorithm.Md5,
                        cancellationToken))
                {
                    skipped++;
                    continue;
                }

                var id = entityId.ToString();
                if (await _queue.HasPendingAsync(jobType, id, cancellationToken))
                {
                    skipped++;
                    continue;
                }

                await _queue.EnqueueAsync(
                    new EnqueueJobRequest(
                        Type: jobType,
                        TargetEntityKind: EntityKindRegistry.ToCode(kind),
                        TargetEntityId: id),
                    cancellationToken);
                enqueued++;
            }
        }

        return new BulkJobResult(enqueued, skipped);
    }

    private static JobRunResult ToResult(JobRunSnapshot job) =>
        new(
            job.Id,
            job.Type.ToCode(),
            job.Status.ToCode(),
            job.Progress,
            job.Message,
            job.TargetEntityKind,
            job.TargetEntityId,
            job.TargetLabel,
            job.CreatedAt,
            job.StartedAt,
            job.FinishedAt);
}
