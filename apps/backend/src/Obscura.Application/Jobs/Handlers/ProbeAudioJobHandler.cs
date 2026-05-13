using Microsoft.Extensions.Logging;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Probes an audio file via ffprobe to extract duration, codec, bitrate, sample rate, channels,
/// and embedded tags (artist, album, title), then chains waveform generation if enabled.
/// </summary>
public sealed class ProbeAudioJobHandler(
    ILogger<ProbeAudioJobHandler> logger,
    IMediaProbe mediaProbe,
    ILibraryScanPersistence persistence) : IJobHandler
{
    public JobType Type => JobType.ProbeAudio;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        var entityId = ParseEntityId(context.Job.TargetEntityId);
        if (entityId is null)
        {
            logger.LogWarning("ProbeAudio: no target entity ID");
            return;
        }

        var filePath = await persistence.GetSourceFilePathAsync(entityId.Value, cancellationToken);
        if (filePath is null || !File.Exists(filePath))
        {
            logger.LogWarning("ProbeAudio: source file not found for {EntityId}", entityId);
            return;
        }

        await context.ReportProgressAsync(10, "Probing audio metadata", cancellationToken);

        var probe = await mediaProbe.ProbeAudioAsync(filePath, cancellationToken);
        if (probe is null)
        {
            logger.LogWarning("ProbeAudio: ffprobe failed for {Path}", filePath);
            return;
        }

        await persistence.UpsertEntityTechnicalAsync(entityId.Value,
            probe.DurationSeconds, null, null, null, probe.BitRate,
            probe.SampleRate, probe.Channels, probe.Codec, probe.Container, null,
            cancellationToken);

        if (probe.Artist is not null || probe.Album is not null)
        {
            await persistence.UpsertAudioTrackTagsAsync(entityId.Value, probe.Artist, probe.Album, cancellationToken);
        }

        var settings = await persistence.GetSettingsAsync(cancellationToken);
        if (settings.AutoGeneratePreview && !await persistence.HasEntityFileAsync(entityId.Value, "waveform", cancellationToken))
        {
            await context.EnqueueIfNeededAsync(new EnqueueJobRequest(
                JobType.GenerateAudioWaveform, TargetEntityKind: "audio-track",
                TargetEntityId: entityId.Value.ToString(), TargetLabel: context.Job.TargetLabel), cancellationToken);
        }

        logger.LogInformation("ProbeAudio: {Label} — {Duration:F1}s {Codec} {SampleRate}Hz",
            context.Job.TargetLabel, probe.DurationSeconds, probe.Codec, probe.SampleRate);

        await context.ReportProgressAsync(100, "Probe complete", cancellationToken);
    }

    private static Guid? ParseEntityId(string? value) =>
        Guid.TryParse(value, out var id) ? id : null;
}
