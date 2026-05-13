using System.Text.Json;
using Microsoft.Extensions.Logging;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Generates audio waveform peak data by decoding to PCM via ffmpeg and computing
/// min/max sample pairs at 20 pixels per second.
/// </summary>
public sealed class GenerateAudioWaveformJobHandler(
    ILogger<GenerateAudioWaveformJobHandler> logger,
    IMediaAssetGenerator assets,
    ILibraryScanPersistence persistence) : IJobHandler
{
    public JobType Type => JobType.GenerateAudioWaveform;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        var entityId = ParseEntityId(context.Job.TargetEntityId);
        if (entityId is null) return;

        var filePath = await persistence.GetSourceFilePathAsync(entityId.Value, cancellationToken);
        if (filePath is null || !File.Exists(filePath))
        {
            logger.LogWarning("GenerateAudioWaveform: source file not found for {EntityId}", entityId);
            return;
        }

        await context.ReportProgressAsync(10, "Generating waveform data", cancellationToken);

        var probe = await GetDurationAsync(entityId.Value, cancellationToken);
        if (probe is null or <= 0)
        {
            logger.LogWarning("GenerateAudioWaveform: no duration for {EntityId}, skipping", entityId);
            return;
        }

        var waveformData = await assets.GenerateWaveformDataAsync(filePath, probe.Value, 20, cancellationToken);
        if (waveformData is null)
        {
            logger.LogWarning("GenerateAudioWaveform: PCM decode failed for {Label}", context.Job.TargetLabel);
            return;
        }

        var outputPath = assets.AudioWaveformPath(entityId.Value);
        Directory.CreateDirectory(Path.GetDirectoryName(outputPath)!);
        var json = JsonSerializer.Serialize(new { data = waveformData });
        await File.WriteAllTextAsync(outputPath, json, cancellationToken);

        var size = new FileInfo(outputPath).Length;
        await persistence.UpsertEntityFileAsync(entityId.Value, "waveform", outputPath, "application/json", size, cancellationToken);

        logger.LogInformation("GenerateAudioWaveform: created waveform for {Label} ({Pixels} pixels)",
            context.Job.TargetLabel, waveformData.Length / 2);

        await context.ReportProgressAsync(100, "Waveform complete", cancellationToken);
    }

    private async Task<double?> GetDurationAsync(Guid entityId, CancellationToken cancellationToken)
    {
        var tech = await persistence.GetEntityTechnicalAsync(entityId, cancellationToken);
        return tech?.DurationSeconds;
    }

    private static Guid? ParseEntityId(string? value) =>
        Guid.TryParse(value, out var id) ? id : null;
}
