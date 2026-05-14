namespace Obscura.Application.Jobs.Ports;

/// <summary>
/// Port for generating thumbnails, previews, sprites, waveforms, and extracting subtitles.
/// </summary>
public interface IMediaAssetGenerator
{
    Task<bool> GenerateVideoThumbnailAsync(
        string inputPath, string outputPath, double seekSeconds,
        int width, int height, int quality, CancellationToken cancellationToken);

    Task<bool> GeneratePreviewClipAsync(
        string inputPath, string outputPath,
        double startSeconds, int durationSeconds, CancellationToken cancellationToken);

    Task<bool> ExtractTrickplayFrameAsync(
        string inputPath, string outputPath, double seekSeconds,
        int width, int height, int jpegQuality, CancellationToken cancellationToken);

    Task<bool> GenerateImageThumbnailAsync(
        string inputPath, string outputPath,
        int targetWidth, int quality, CancellationToken cancellationToken);

    Task<IReadOnlyList<string>> ExtractSubtitlesAsync(
        string inputPath, string outputDir,
        IReadOnlyList<SubtitleStreamData> streams, CancellationToken cancellationToken);

    Task<int[]?> GenerateWaveformDataAsync(
        string inputPath, double durationSeconds, int pixelsPerSecond, CancellationToken cancellationToken);

    string VideoThumbnailPath(Guid entityId);
    string VideoPreviewPath(Guid entityId);
    string VideoSpritePath(Guid entityId);
    string VideoTrickplayVttPath(Guid entityId);
    string TrickplayFrameDir(Guid entityId);
    string ImageThumbnailPath(Guid entityId);
    string BookPageThumbnailPath(Guid entityId);
    string AudioWaveformPath(Guid entityId);
    string SubtitleDir(Guid entityId);

    string VideoThumbnailUrl(Guid entityId);
    string VideoPreviewUrl(Guid entityId);
    string VideoTrickplayVttUrl(Guid entityId);
    string ImageThumbnailUrl(Guid entityId);
    string BookPageThumbnailUrl(Guid entityId);
    string AudioWaveformUrl(Guid entityId);
    string SubtitleUrl(Guid entityId, string fileName);
}
