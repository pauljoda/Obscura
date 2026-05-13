using Microsoft.Extensions.Logging;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Probes a video file via ffprobe to extract duration, dimensions, codec, bitrate, and container
/// metadata, then stores the results in the entity's technical capability row.
/// </summary>
public sealed class ProbeVideoJobHandler(
    ILogger<ProbeVideoJobHandler> logger,
    IMediaProbe mediaProbe,
    ILibraryScanPersistence persistence) : IJobHandler
{
    public JobType Type => JobType.ProbeVideo;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        var entityId = ParseEntityId(context.Job.TargetEntityId);
        if (entityId is null)
        {
            logger.LogWarning("ProbeVideo: no target entity ID");
            return;
        }

        var filePath = await persistence.GetSourceFilePathAsync(entityId.Value, cancellationToken);
        if (filePath is null || !File.Exists(filePath))
        {
            logger.LogWarning("ProbeVideo: source file not found for {EntityId}", entityId);
            return;
        }

        await context.ReportProgressAsync(10, "Probing video metadata", cancellationToken);

        var probe = await mediaProbe.ProbeVideoAsync(filePath, cancellationToken);
        if (probe is null)
        {
            logger.LogWarning("ProbeVideo: ffprobe failed for {Path}", filePath);
            return;
        }

        await persistence.UpsertEntityTechnicalAsync(entityId.Value,
            probe.DurationSeconds, probe.Width, probe.Height, probe.FrameRate, probe.BitRate,
            probe.SampleRate, probe.Channels, probe.Codec, probe.Container, null,
            cancellationToken);

        logger.LogInformation("ProbeVideo: {Label} — {Duration:F1}s {Width}x{Height} {Codec}",
            context.Job.TargetLabel, probe.DurationSeconds, probe.Width, probe.Height, probe.Codec);

        await context.ReportProgressAsync(100, "Probe complete", cancellationToken);
    }

    private static Guid? ParseEntityId(string? value) =>
        Guid.TryParse(value, out var id) ? id : null;
}
