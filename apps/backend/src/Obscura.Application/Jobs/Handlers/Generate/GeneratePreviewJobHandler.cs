using Obscura.Application.Jobs.Handlers;
using Microsoft.Extensions.Logging;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers.Generate;

/// <summary>
/// Generates video thumbnails, preview clips, and trickplay sprites via ffmpeg.
/// Optimized for throughput: uses batch trickplay extraction (single ffmpeg pass)
/// and combined thumbnail+preview generation.
/// </summary>
public sealed class GeneratePreviewJobHandler(
    ILogger<GeneratePreviewJobHandler> logger,
    IMediaAssetGenerator assets,
    ILibraryScanPersistence persistence) : EntityFileJobHandler(logger, persistence)
{
    public override JobType Type => JobType.GeneratePreview;

    protected override async Task ExecuteAsync(
        JobContext context, Guid entityId, string filePath, CancellationToken cancellationToken)
    {
        var timer = new JobPhaseTimer();
        var settings = await Persistence.GetSettingsAsync(cancellationToken);

        var (duration, width, height) = await GetDimensionsAsync(entityId, cancellationToken);

        using (timer.Phase("thumbnail+preview"))
        {
            await context.ReportProgressAsync(10, "Generating thumbnail and preview", cancellationToken);
            await GenerateThumbnailAndPreviewAsync(entityId, filePath, settings, duration, width, height, cancellationToken);
        }

        if (settings.GenerateTrickplay)
        {
            using (timer.Phase("trickplay"))
            {
                await context.ReportProgressAsync(50, "Generating trickplay sprites", cancellationToken);
                await GenerateTrickplayBatchAsync(entityId, filePath, settings, duration, width, height, cancellationToken);
            }
        }

        var report = timer.Finish();
        logger.LogInformation(
            "[METRICS] generate-preview {Label} — {Timing}",
            context.Job.TargetLabel, report.ToLogString());
        await context.ReportProgressAsync(100, "Preview complete", cancellationToken);
    }

    private async Task GenerateThumbnailAndPreviewAsync(
        Guid entityId, string filePath, LibrarySettingsData settings,
        double? duration, int? width, int? height, CancellationToken cancellationToken)
    {
        var thumbPath = assets.VideoThumbnailPath(entityId);
        var previewPath = assets.VideoPreviewPath(entityId);

        var seekTime = ComputeSeekTime(duration);
        var thumbWidth = ScaleWidth(width ?? 1920, settings.ThumbnailQuality);
        var thumbHeight = ScaleHeight(height ?? 1080, width ?? 1920, thumbWidth);

        var clipDuration = Math.Max(4, settings.PreviewClipDurationSeconds);
        var previewStart = (duration ?? 0) > clipDuration ? (duration!.Value * 0.1) : 0;

        var (thumbOk, previewOk) = await assets.GenerateThumbnailAndPreviewAsync(
            filePath,
            thumbPath, seekTime, thumbWidth, thumbHeight, QualityToJpeg(settings.ThumbnailQuality),
            previewPath, previewStart, clipDuration,
            cancellationToken);

        if (thumbOk)
        {
            var size = new FileInfo(thumbPath).Length;
            await Persistence.UpsertEntityFileAsync(entityId, EntityFileRole.Thumbnail,
                assets.VideoThumbnailUrl(entityId), "image/jpeg", size, cancellationToken);
        }

        if (previewOk)
        {
            var size = new FileInfo(previewPath).Length;
            await Persistence.UpsertEntityFileAsync(entityId, EntityFileRole.Preview,
                assets.VideoPreviewUrl(entityId), "video/mp4", size, cancellationToken);
        }
    }

    private async Task GenerateTrickplayBatchAsync(
        Guid entityId, string filePath, LibrarySettingsData settings,
        double? duration, int? width, int? height, CancellationToken cancellationToken)
    {
        if (duration is null or <= 0) return;

        var interval = Math.Max(3, settings.TrickplayIntervalSeconds);
        var frameCount = (int)(duration.Value / interval);
        if (frameCount < 1) return;

        var (frameWidth, frameHeight) = ComputeTrickplayDimensions(
            width ?? 1920, height ?? 1080, settings.TrickplayQuality);

        var frameDir = assets.TrickplayFrameDir(entityId);

        var extractedCount = await assets.ExtractTrickplayFramesBatchAsync(
            filePath, frameDir, duration.Value, interval,
            frameWidth, frameHeight, QualityToJpeg(settings.TrickplayQuality),
            cancellationToken);

        if (extractedCount == 0)
        {
            logger.LogWarning("Trickplay batch extraction produced zero frames for {EntityId}", entityId);
            return;
        }

        logger.LogInformation(
            "Trickplay: extracted {Count} frames in single pass (expected {Expected})",
            extractedCount, frameCount);

        var vttPath = assets.VideoTrickplayVttPath(entityId);
        await WriteTrickplayVttAsync(entityId, vttPath, extractedCount, interval, frameWidth, frameHeight, cancellationToken);

        await Persistence.UpsertEntityFileAsync(entityId, EntityFileRole.Trickplay,
            assets.VideoTrickplayVttUrl(entityId), "text/vtt", null, cancellationToken);
    }

    private static async Task WriteTrickplayVttAsync(
        Guid entityId, string vttPath, int frameCount, int interval,
        int frameWidth, int frameHeight, CancellationToken cancellationToken)
    {
        const int columns = 5;
        var lines = new List<string> { "WEBVTT", "" };

        for (var i = 0; i < frameCount; i++)
        {
            var start = TimeSpan.FromSeconds(i * interval);
            var end = TimeSpan.FromSeconds((i + 1) * interval);
            var col = i % columns;
            var row = i / columns;
            var x = col * frameWidth;
            var y = row * frameHeight;

            lines.Add($"{FormatVttTime(start)} --> {FormatVttTime(end)}");
            lines.Add($"/assets/videos/{entityId}/sprite#xywh={x},{y},{frameWidth},{frameHeight}");
            lines.Add("");
        }

        Directory.CreateDirectory(Path.GetDirectoryName(vttPath)!);
        await File.WriteAllLinesAsync(vttPath, lines, cancellationToken);
    }

    private async Task<(double? Duration, int? Width, int? Height)> GetDimensionsAsync(
        Guid entityId, CancellationToken cancellationToken)
    {
        var tech = await Persistence.GetEntityTechnicalAsync(entityId, cancellationToken);
        if (tech is null)
            return (null, null, null);

        return (tech.DurationSeconds, tech.Width, tech.Height);
    }

    private static double ComputeSeekTime(double? duration)
    {
        var seekTime = Math.Max(0, (duration ?? 10) * 0.18);
        if (duration is not null && seekTime > duration.Value - 0.5)
            seekTime = Math.Max(0, duration.Value - 0.5);
        return seekTime;
    }

    private static int ScaleWidth(int sourceWidth, int quality)
    {
        var min = 320;
        var max = sourceWidth;
        var factor = Math.Clamp(quality, 1, 31);
        return min + (max - min) * (31 - factor) / 30;
    }

    private static int ScaleHeight(int sourceHeight, int sourceWidth, int targetWidth)
    {
        if (sourceWidth == 0) return sourceHeight;
        return targetWidth * sourceHeight / sourceWidth;
    }

    /// <summary>
    /// Trickplay frames are small scrubber-preview thumbnails, not full-resolution images.
    /// Capped at 320×180 regardless of source resolution (matching v1 behavior).
    /// Quality 1 (best) = 320w, quality 5 (lowest) = 160w.
    /// </summary>
    private static (int Width, int Height) ComputeTrickplayDimensions(int sourceWidth, int sourceHeight, int quality)
    {
        const int maxWidth = 320;
        const int minWidth = 160;
        var q = Math.Clamp(quality, 1, 5);
        var targetWidth = maxWidth - (q - 1) * (maxWidth - minWidth) / 4;
        targetWidth = targetWidth / 2 * 2;

        var targetHeight = sourceWidth > 0
            ? targetWidth * sourceHeight / sourceWidth
            : targetWidth * 9 / 16;
        targetHeight = targetHeight / 2 * 2;

        return (targetWidth, Math.Max(2, targetHeight));
    }

    private static int QualityToJpeg(int quality) => Math.Clamp(quality, 1, 10);

    private static string FormatVttTime(TimeSpan ts) =>
        $"{(int)ts.TotalHours:D2}:{ts.Minutes:D2}:{ts.Seconds:D2}.{ts.Milliseconds:D3}";
}
