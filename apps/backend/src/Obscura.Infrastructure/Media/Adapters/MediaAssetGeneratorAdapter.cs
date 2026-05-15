using Obscura.Infrastructure.Media.Processing;
using Obscura.Application.Jobs.Ports;

namespace Obscura.Infrastructure.Media.Adapters;

/// <summary>
/// Adapts the Infrastructure ThumbnailService and AssetPathService to the Application port interface.
/// </summary>
public sealed class MediaAssetGeneratorAdapter(ThumbnailService thumbnails, AssetPathService paths) : IMediaAssetGenerator
{
    public Task<bool> GenerateVideoThumbnailAsync(
        string inputPath, string outputPath, double seekSeconds,
        int width, int height, int quality, CancellationToken cancellationToken) =>
        thumbnails.GenerateVideoThumbnailAsync(inputPath, outputPath, seekSeconds, width, height, quality, cancellationToken);

    public Task<bool> GeneratePreviewClipAsync(
        string inputPath, string outputPath, double startSeconds, int durationSeconds, CancellationToken cancellationToken) =>
        thumbnails.GeneratePreviewClipAsync(inputPath, outputPath, startSeconds, durationSeconds, cancellationToken);

    public Task<bool> ExtractTrickplayFrameAsync(
        string inputPath, string outputPath, double seekSeconds,
        int width, int height, int jpegQuality, CancellationToken cancellationToken) =>
        thumbnails.ExtractTrickplayFrameAsync(inputPath, outputPath, seekSeconds, width, height, jpegQuality, cancellationToken);

    public Task<int> ExtractTrickplayFramesBatchAsync(
        string inputPath, string outputDir, double duration,
        int intervalSeconds, int width, int height, int jpegQuality,
        CancellationToken cancellationToken) =>
        thumbnails.ExtractTrickplayFramesBatchAsync(inputPath, outputDir, duration, intervalSeconds, width, height, jpegQuality, cancellationToken);

    public Task<bool> ComposeSpriteSheetAsync(
        string frameDir, string outputPath, int columns,
        int frameWidth, int frameHeight, int jpegQuality,
        CancellationToken cancellationToken) =>
        thumbnails.ComposeSpriteSheetAsync(frameDir, outputPath, columns, frameWidth, frameHeight, jpegQuality, cancellationToken);

    public Task<int> ComposeTiledJpegSheetsAsync(
        string frameDir,
        string outputDir,
        int columns,
        int rows,
        int frameWidth,
        int frameHeight,
        int jpegQuality,
        CancellationToken cancellationToken) =>
        thumbnails.ComposeTiledJpegSheetsAsync(frameDir, outputDir, columns, rows, frameWidth, frameHeight, jpegQuality, cancellationToken);

    public Task<(bool Thumbnail, bool Preview)> GenerateThumbnailAndPreviewAsync(
        string inputPath,
        string thumbnailPath, double thumbSeekSeconds, int thumbWidth, int thumbHeight, int thumbQuality,
        string previewPath, double previewStartSeconds, int previewDurationSeconds,
        CancellationToken cancellationToken) =>
        thumbnails.GenerateThumbnailAndPreviewAsync(inputPath, thumbnailPath, thumbSeekSeconds, thumbWidth, thumbHeight, thumbQuality,
            previewPath, previewStartSeconds, previewDurationSeconds, cancellationToken);

    public Task<bool> GenerateImageThumbnailAsync(
        string inputPath, string outputPath, int targetWidth, int quality, CancellationToken cancellationToken) =>
        thumbnails.GenerateImageThumbnailAsync(inputPath, outputPath, targetWidth, quality, cancellationToken);

    public async Task<IReadOnlyList<string>> ExtractSubtitlesAsync(
        string inputPath, string outputDir, IReadOnlyList<SubtitleStreamData> streams, CancellationToken cancellationToken)
    {
        var infraStreams = streams
            .Select(s => new SubtitleStreamInfo(s.StreamIndex, s.CodecName, s.Language, s.Title))
            .ToList();
        return await thumbnails.ExtractSubtitlesAsync(inputPath, outputDir, infraStreams, cancellationToken);
    }

    public Task<int[]?> GenerateWaveformDataAsync(
        string inputPath, double durationSeconds, int pixelsPerSecond, CancellationToken cancellationToken) =>
        thumbnails.GenerateWaveformDataAsync(inputPath, durationSeconds, pixelsPerSecond, cancellationToken);

    public string VideoThumbnailPath(Guid entityId) => paths.VideoThumbnailPath(entityId);
    public string VideoPreviewPath(Guid entityId) => paths.VideoPreviewPath(entityId);
    public string VideoSpritePath(Guid entityId) => paths.VideoSpritePath(entityId);
    public string VideoTrickplayVttPath(Guid entityId) => paths.VideoTrickplayVttPath(entityId);
    public string TrickplayFrameDir(Guid entityId) => paths.TrickplayFrameDir(entityId);
    public string TrickplayTileDir(Guid entityId, int width) => paths.TrickplayTileDir(entityId, width);
    public string ImageThumbnailPath(Guid entityId) => paths.ImageThumbnailPath(entityId);
    public string BookPageThumbnailPath(Guid entityId) => paths.BookPageThumbnailPath(entityId);
    public string AudioWaveformPath(Guid entityId) => paths.AudioWaveformPath(entityId);
    public string SubtitleDir(Guid entityId) => paths.SubtitleDir(entityId);

    public string VideoThumbnailUrl(Guid entityId) => AssetPathService.VideoThumbnailUrl(entityId);
    public string VideoPreviewUrl(Guid entityId) => AssetPathService.VideoPreviewUrl(entityId);
    public string VideoTrickplayVttUrl(Guid entityId) => AssetPathService.VideoTrickplayVttUrl(entityId);
    public string TrickplayPlaylistUrl(Guid entityId, int width) => AssetPathService.TrickplayPlaylistUrl(entityId, width);
    public string ImageThumbnailUrl(Guid entityId) => AssetPathService.ImageThumbnailUrl(entityId);
    public string BookPageThumbnailUrl(Guid entityId) => AssetPathService.BookPageThumbnailUrl(entityId);
    public string AudioWaveformUrl(Guid entityId) => AssetPathService.AudioWaveformUrl(entityId);
    public string SubtitleUrl(Guid entityId, string fileName) => AssetPathService.SubtitleUrl(entityId, fileName);
}
