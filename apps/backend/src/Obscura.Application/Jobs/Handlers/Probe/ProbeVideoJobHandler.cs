using Obscura.Application.Jobs.Handlers;
using Microsoft.Extensions.Logging;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers.Probe;

/// <summary>
/// Probes a video file via ffprobe to extract duration, dimensions, codec, bitrate, and container
/// metadata, then stores the results in the entity's technical capability row.
/// </summary>
public sealed class ProbeVideoJobHandler(
    ILogger<ProbeVideoJobHandler> logger,
    IMediaProbe mediaProbe,
    ILibraryScanPersistence persistence) : EntityFileJobHandler(logger, persistence)
{
    public override JobType Type => JobType.ProbeVideo;

    protected override async Task ExecuteAsync(
        JobContext context, Guid entityId, string filePath, CancellationToken cancellationToken)
    {
        var timer = new JobPhaseTimer();
        await context.ReportProgressAsync(10, "Probing video metadata", cancellationToken);

        VideoProbeData? probe;
        using (timer.Phase("ffprobe"))
        {
            probe = await mediaProbe.ProbeVideoAsync(filePath, cancellationToken);
        }

        if (probe is null)
        {
            logger.LogWarning("ProbeVideo: ffprobe failed for {Path}", filePath);
            return;
        }

        using (timer.Phase("persist"))
        {
            await Persistence.UpsertEntityTechnicalAsync(entityId,
                probe.DurationSeconds, probe.Width, probe.Height, probe.FrameRate, probe.BitRate,
                probe.SampleRate, probe.Channels, probe.Codec, probe.Container, null,
                cancellationToken);
        }

        var report = timer.Finish();
        logger.LogInformation(
            "[METRICS] probe-video {Label} — {Duration:F1}s {Width}x{Height} {Codec} — {Timing}",
            context.Job.TargetLabel, probe.DurationSeconds, probe.Width, probe.Height, probe.Codec,
            report.ToLogString());

        await context.ReportProgressAsync(100, "Probe complete", cancellationToken);
    }
}
