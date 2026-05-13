using Obscura.Application.Jobs.Handlers;
using Microsoft.Extensions.Logging;
using Obscura.Application.Jobs.Ports;
using Obscura.Domain.Entities;

namespace Obscura.Application.Jobs.Handlers.Generate;

/// <summary>
/// Generates video thumbnails, preview clips, and trickplay sprites via ffmpeg.
/// Reads the entity's technical metadata for duration/dimensions to compute seek points and scaling.
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
        var settings = await Persistence.GetSettingsAsync(cancellationToken);

        await context.ReportProgressAsync(10, "Generating thumbnail", cancellationToken);
        await GenerateThumbnailAsync(entityId, filePath, settings, cancellationToken);

        await context.ReportProgressAsync(40, "Generating preview clip", cancellationToken);
        await GeneratePreviewClipAsync(entityId, filePath, settings, cancellationToken);

        if (settings.GenerateTrickplay)
        {
            await context.ReportProgressAsync(60, "Generating trickplay sprites", cancellationToken);
            await GenerateTrickplayAsync(entityId, filePath, settings, cancellationToken);
        }

        logger.LogInformation("GeneratePreview: completed for {Label}", context.Job.TargetLabel);
        await context.ReportProgressAsync(100, "Preview complete", cancellationToken);
    }

    private async Task GenerateThumbnailAsync(Guid entityId, string filePath, LibrarySettingsData settings, CancellationToken cancellationToken)
    {
        var thumbPath = assets.VideoThumbnailPath(entityId);

        var (duration, width, height) = await GetDimensionsAsync(entityId, cancellationToken);
        var seekTime = Math.Max(0, (duration ?? 10) * 0.18);
        if (duration is not null && seekTime > duration.Value - 0.5)
            seekTime = Math.Max(0, duration.Value - 0.5);

        var thumbWidth = ScaleWidth(width ?? 1920, settings.ThumbnailQuality);
        var thumbHeight = ScaleHeight(height ?? 1080, width ?? 1920, thumbWidth);

        var success = await assets.GenerateVideoThumbnailAsync(
            filePath, thumbPath, seekTime, thumbWidth, thumbHeight,
            QualityToJpeg(settings.ThumbnailQuality), cancellationToken);

        if (success)
        {
            var size = new FileInfo(thumbPath).Length;
            await Persistence.UpsertEntityFileAsync(entityId, EntityFileRole.Thumbnail, thumbPath, "image/jpeg", size, cancellationToken);
        }
    }

    private async Task GeneratePreviewClipAsync(Guid entityId, string filePath, LibrarySettingsData settings, CancellationToken cancellationToken)
    {
        var previewPath = assets.VideoPreviewPath(entityId);
        var (duration, _, _) = await GetDimensionsAsync(entityId, cancellationToken);
        var clipDuration = Math.Max(4, settings.PreviewClipDurationSeconds);
        var startTime = (duration ?? 0) > clipDuration ? (duration!.Value * 0.1) : 0;

        var success = await assets.GeneratePreviewClipAsync(
            filePath, previewPath, startTime, clipDuration, cancellationToken);

        if (success)
        {
            var size = new FileInfo(previewPath).Length;
            await Persistence.UpsertEntityFileAsync(entityId, EntityFileRole.Preview, previewPath, "video/mp4", size, cancellationToken);
        }
    }

    private async Task GenerateTrickplayAsync(Guid entityId, string filePath, LibrarySettingsData settings, CancellationToken cancellationToken)
    {
        var (duration, width, height) = await GetDimensionsAsync(entityId, cancellationToken);
        if (duration is null or <= 0) return;

        var interval = Math.Max(3, settings.TrickplayIntervalSeconds);
        var frameCount = (int)(duration.Value / interval);
        if (frameCount < 1) return;

        var frameWidth = ScaleWidth(width ?? 1920, settings.TrickplayQuality);
        var frameHeight = ScaleHeight(height ?? 1080, width ?? 1920, frameWidth);
        frameWidth = frameWidth / 2 * 2;
        frameHeight = frameHeight / 2 * 2;

        var frameDir = assets.TrickplayFrameDir(entityId);
        Directory.CreateDirectory(frameDir);

        var jpegQuality = QualityToJpeg(settings.TrickplayQuality);

        for (var i = 0; i < frameCount; i++)
        {
            var seekTime = (i + 0.5) * interval;
            seekTime = Math.Min(seekTime, duration.Value - 0.5);
            var framePath = Path.Combine(frameDir, $"frame-{i:D5}.jpg");

            await assets.ExtractTrickplayFrameAsync(
                filePath, framePath, seekTime, frameWidth, frameHeight, jpegQuality, cancellationToken);
        }

        var vttPath = assets.VideoTrickplayVttPath(entityId);
        await WriteTrickplayVttAsync(entityId, vttPath, frameCount, interval, frameWidth, frameHeight, cancellationToken);

        await Persistence.UpsertEntityFileAsync(entityId, EntityFileRole.Trickplay, vttPath, "text/vtt", null, cancellationToken);
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

    private async Task<(double? Duration, int? Width, int? Height)> GetDimensionsAsync(Guid entityId, CancellationToken cancellationToken)
    {
        var tech = await Persistence.GetEntityTechnicalAsync(entityId, cancellationToken);
        if (tech is null)
            return (null, null, null);

        return (tech.DurationSeconds, tech.Width, tech.Height);
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

    private static int QualityToJpeg(int quality) => Math.Clamp(quality, 1, 10);

    private static string FormatVttTime(TimeSpan ts) =>
        $"{(int)ts.TotalHours:D2}:{ts.Minutes:D2}:{ts.Seconds:D2}.{ts.Milliseconds:D3}";
}
