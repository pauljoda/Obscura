using Microsoft.Extensions.Logging;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Computes MD5 and oshash fingerprints for a video entity and stores them
/// as entity file fingerprint records linked to the source file.
/// </summary>
public sealed class FingerprintVideoJobHandler(
    ILogger<FingerprintVideoJobHandler> logger,
    IMediaHashing hashing,
    ILibraryScanPersistence persistence) : IJobHandler
{
    public JobType Type => JobType.FingerprintVideo;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        var entityId = ParseEntityId(context.Job.TargetEntityId);
        if (entityId is null) return;

        var filePath = await persistence.GetSourceFilePathAsync(entityId.Value, cancellationToken);
        if (filePath is null || !File.Exists(filePath))
        {
            logger.LogWarning("FingerprintVideo: source file not found for {EntityId}", entityId);
            return;
        }

        await context.ReportProgressAsync(10, "Computing hashes", cancellationToken);

        var hashes = await hashing.ComputeHashesAsync(filePath, cancellationToken);
        var sourceFileId = await persistence.GetSourceFileIdAsync(entityId.Value, cancellationToken);

        await context.ReportProgressAsync(80, "Storing fingerprints", cancellationToken);

        await persistence.UpsertEntityFingerprintAsync(entityId.Value, "md5", hashes.Md5, sourceFileId, cancellationToken);
        await persistence.UpsertEntityFingerprintAsync(entityId.Value, "oshash", hashes.Oshash, sourceFileId, cancellationToken);

        logger.LogInformation("FingerprintVideo: {Label} — md5={Md5} oshash={Oshash}",
            context.Job.TargetLabel, hashes.Md5[..8], hashes.Oshash);

        await context.ReportProgressAsync(100, "Fingerprint complete", cancellationToken);
    }

    private static Guid? ParseEntityId(string? value) =>
        Guid.TryParse(value, out var id) ? id : null;
}
