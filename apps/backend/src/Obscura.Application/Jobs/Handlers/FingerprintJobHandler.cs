using Microsoft.Extensions.Logging;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Computes MD5 and oshash fingerprints for an entity's source file and stores them
/// as entity file fingerprint records. Registered once per media type via factory DI.
/// </summary>
public sealed class FingerprintJobHandler(
    JobType jobType,
    ILogger<FingerprintJobHandler> logger,
    IMediaHashing hashing,
    ILibraryScanPersistence persistence) : EntityFileJobHandler(logger, persistence)
{
    public override JobType Type => jobType;

    protected override async Task ExecuteAsync(
        JobContext context, Guid entityId, string filePath, CancellationToken cancellationToken)
    {
        await context.ReportProgressAsync(10, "Computing hashes", cancellationToken);

        var hashes = await hashing.ComputeHashesAsync(filePath, cancellationToken);
        var sourceFileId = await Persistence.GetSourceFileIdAsync(entityId, cancellationToken);

        await context.ReportProgressAsync(80, "Storing fingerprints", cancellationToken);

        await Persistence.UpsertEntityFingerprintAsync(entityId, "md5", hashes.Md5, sourceFileId, cancellationToken);
        await Persistence.UpsertEntityFingerprintAsync(entityId, "oshash", hashes.Oshash, sourceFileId, cancellationToken);

        logger.LogInformation("{JobType}: {Label} — md5={Md5}", Type.ToCode(), context.Job.TargetLabel, hashes.Md5[..8]);

        await context.ReportProgressAsync(100, "Fingerprint complete", cancellationToken);
    }
}
