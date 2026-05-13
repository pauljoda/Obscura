using Microsoft.AspNetCore.Mvc;
using Obscura.Application.Jobs;
using Obscura.Application.Jobs.Ports;
using Obscura.Contracts.Jobs;
using Obscura.Domain.Entities;

namespace Obscura.Api.Endpoints;

public static class JobEndpoints
{
    public static RouteGroupBuilder MapJobEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/jobs")
            .WithTags("Jobs");

        group.MapGet("/", async (
            JobService jobs,
            CancellationToken cancellationToken) =>
            await jobs.ListAsync(cancellationToken))
            .WithName("ListJobs")
            .WithSummary("Lists Obscura background job runs for the operations dashboard.");

        group.MapPost("/{type}", async (
            JobTypeRoute type,
            JobService jobs,
            CancellationToken cancellationToken) =>
        {
            var response = await jobs.CreateAsync(type.Value, cancellationToken);

            return Results.Accepted($"/api/jobs/{response.Job.Id}", response);
        })
            .WithName("CreateJob")
            .WithSummary("Queues a background job run.");

        group.MapDelete("/", async (
            [FromQuery] string? type,
            JobService jobs,
            CancellationToken cancellationToken) =>
        {
            if (!TryDecodeJobType(type, out var jobType))
            {
                return Results.BadRequest(new { message = $"Unknown job type '{type}'." });
            }

            return Results.Ok(await jobs.CancelAsync(jobType, cancellationToken));
        })
            .WithName("CancelJobs")
            .WithSummary("Cancels queued or running job runs.");

        group.MapDelete("/{id:guid}", async (
            Guid id,
            JobService jobs,
            CancellationToken cancellationToken) =>
            Results.Ok(await jobs.CancelRunAsync(id, cancellationToken)))
            .WithName("CancelJobRun")
            .WithSummary("Cancels one queued or running job run.");

        group.MapPost("/failures/clear", async (
            [FromQuery] string? type,
            JobService jobs,
            CancellationToken cancellationToken) =>
        {
            if (!TryDecodeJobType(type, out var jobType))
            {
                return Results.BadRequest(new { message = $"Unknown job type '{type}'." });
            }

            return Results.Ok(await jobs.ClearFailuresAsync(jobType, cancellationToken));
        })
            .WithName("ClearJobFailures")
            .WithSummary("Clears failed job runs from the operations dashboard.");

        group.MapPost("/rebuild-previews", async (
            IMaintenancePersistence maintenance,
            IJobQueueService queue,
            CancellationToken cancellationToken) =>
        {
            int enqueued = 0, skipped = 0;

            (IEntityKind Kind, JobType JobType)[] previewKinds =
            [
                (EntityKindRegistry.Video, JobType.GeneratePreview),
                (EntityKindRegistry.Image, JobType.GenerateImageThumbnail),
                (EntityKindRegistry.BookPage, JobType.GenerateBookPageThumbnail),
                (EntityKindRegistry.AudioTrack, JobType.GenerateAudioWaveform)
            ];

            foreach (var (kind, jobType) in previewKinds)
            {
                var entityIds = await maintenance.GetActiveEntityIdsByKindAsync(kind, cancellationToken);
                foreach (var entityId in entityIds)
                {
                    var id = entityId.ToString();
                    if (await queue.HasPendingAsync(jobType, id, cancellationToken))
                    {
                        skipped++;
                        continue;
                    }

                    await queue.EnqueueAsync(new EnqueueJobRequest(
                        Type: jobType,
                        TargetEntityKind: kind.Code,
                        TargetEntityId: id), cancellationToken);
                    enqueued++;
                }
            }

            return Results.Ok(new BulkJobResponse(enqueued, skipped));
        })
            .WithName("RebuildPreviews")
            .WithSummary("Queues preview generation for all media entities.");

        group.MapPost("/backfill-fingerprints", async (
            IMaintenancePersistence maintenance,
            ILibraryScanPersistence scanPersistence,
            IJobQueueService queue,
            CancellationToken cancellationToken) =>
        {
            int enqueued = 0, skipped = 0;

            (IEntityKind Kind, JobType JobType)[] fingerprintKinds =
            [
                (EntityKindRegistry.Video, JobType.FingerprintVideo),
                (EntityKindRegistry.Image, JobType.FingerprintImage),
                (EntityKindRegistry.AudioTrack, JobType.FingerprintAudio)
            ];

            foreach (var (kind, jobType) in fingerprintKinds)
            {
                var entityIds = await maintenance.GetActiveEntityIdsByKindAsync(kind, cancellationToken);
                foreach (var entityId in entityIds)
                {
                    if (await scanPersistence.HasEntityFingerprintAsync(
                        entityId, FingerprintAlgorithm.Md5, cancellationToken))
                    {
                        skipped++;
                        continue;
                    }

                    var id = entityId.ToString();
                    if (await queue.HasPendingAsync(jobType, id, cancellationToken))
                    {
                        skipped++;
                        continue;
                    }

                    await queue.EnqueueAsync(new EnqueueJobRequest(
                        Type: jobType,
                        TargetEntityKind: kind.Code,
                        TargetEntityId: id), cancellationToken);
                    enqueued++;
                }
            }

            return Results.Ok(new BulkJobResponse(enqueued, skipped));
        })
            .WithName("BackfillFingerprints")
            .WithSummary("Queues fingerprint generation for entities that lack one.");

        return group;
    }

    private static bool TryDecodeJobType(string? value, out JobType? type)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            type = null;
            return true;
        }

        if (value.TryDecodeAs<JobType>(out var decoded))
        {
            type = decoded;
            return true;
        }

        type = null;
        return false;
    }
}

/// <summary>
/// Route-bound job type value that decodes public job codes at the HTTP edge.
/// </summary>
/// <param name="Value">Typed job operation resolved from the route segment.</param>
public readonly record struct JobTypeRoute(JobType Value)
{
    /// <summary>
    /// Attempts to parse a route segment into a known typed job operation.
    /// </summary>
    /// <param name="value">Route segment supplied by the API caller.</param>
    /// <param name="provider">Format provider supplied by the minimal API binder.</param>
    /// <param name="result">Parsed route value when the segment is known.</param>
    /// <returns>True when the route segment maps to a registered job type.</returns>
    public static bool TryParse(string? value, IFormatProvider? provider, out JobTypeRoute result)
    {
        if (value is not null && value.TryDecodeAs<JobType>(out var type))
        {
            result = new JobTypeRoute(type);
            return true;
        }

        result = default;
        return false;
    }
}
