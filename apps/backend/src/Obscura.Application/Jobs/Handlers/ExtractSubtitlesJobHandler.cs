using Microsoft.Extensions.Logging;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers;

/// <summary>
/// Probes a video file for embedded text subtitle streams, extracts them to WebVTT files,
/// and records them in the entity_subtitles table.
/// </summary>
public sealed class ExtractSubtitlesJobHandler(
    ILogger<ExtractSubtitlesJobHandler> logger,
    IMediaProbe mediaProbe,
    IMediaAssetGenerator assets,
    ILibraryScanPersistence persistence) : IJobHandler
{
    public JobType Type => JobType.ExtractSubtitles;

    public async Task HandleAsync(JobContext context, CancellationToken cancellationToken)
    {
        var entityId = ParseEntityId(context.Job.TargetEntityId);
        if (entityId is null) return;

        var filePath = await persistence.GetSourceFilePathAsync(entityId.Value, cancellationToken);
        if (filePath is null || !File.Exists(filePath))
        {
            logger.LogWarning("ExtractSubtitles: source file not found for {EntityId}", entityId);
            await persistence.MarkSubtitlesExtractedAsync(entityId.Value, cancellationToken);
            return;
        }

        await context.ReportProgressAsync(10, "Probing subtitle streams", cancellationToken);

        var streams = await mediaProbe.ProbeSubtitleStreamsAsync(filePath, cancellationToken);
        if (streams.Count == 0)
        {
            logger.LogInformation("ExtractSubtitles: no text subtitles in {Label}", context.Job.TargetLabel);
            await persistence.MarkSubtitlesExtractedAsync(entityId.Value, cancellationToken);
            await context.ReportProgressAsync(100, "No subtitles found", cancellationToken);
            return;
        }

        await context.ReportProgressAsync(30, $"Extracting {streams.Count} subtitle streams", cancellationToken);

        var outputDir = assets.SubtitleDir(entityId.Value);
        var extractedPaths = await assets.ExtractSubtitlesAsync(filePath, outputDir, streams, cancellationToken);

        await context.ReportProgressAsync(80, "Recording subtitle tracks", cancellationToken);

        foreach (var path in extractedPaths)
        {
            var fileName = Path.GetFileNameWithoutExtension(path);
            var parts = fileName.Split('-');
            var language = parts.Length >= 2 ? parts[1] : "und";
            var indexStr = parts.Length >= 3 ? parts[2] : "0";
            int.TryParse(indexStr, out var streamIndex);

            var matchingStream = streams.FirstOrDefault(s => s.StreamIndex.ToString() == indexStr);
            var label = matchingStream?.Title;

            await persistence.UpsertSubtitleAsync(entityId.Value, language, label, "vtt",
                "embedded", path, matchingStream?.CodecName ?? "unknown", streamIndex, cancellationToken);
        }

        await persistence.MarkSubtitlesExtractedAsync(entityId.Value, cancellationToken);

        logger.LogInformation("ExtractSubtitles: extracted {Count} subtitle tracks from {Label}",
            extractedPaths.Count, context.Job.TargetLabel);

        await context.ReportProgressAsync(100, $"Extracted {extractedPaths.Count} subtitles", cancellationToken);
    }

    private static Guid? ParseEntityId(string? value) =>
        Guid.TryParse(value, out var id) ? id : null;
}
