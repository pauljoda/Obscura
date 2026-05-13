namespace Obscura.Infrastructure.Media;

/// <summary>
/// Computes storage paths for generated assets (thumbnails, previews, waveforms, subtitles).
/// All generated assets live under the configured data directory.
/// </summary>
public sealed class AssetPathService
{
    private readonly string _dataDir;

    public AssetPathService(string dataDir)
    {
        _dataDir = dataDir;
    }

    public string VideoThumbnailPath(Guid entityId) =>
        Path.Combine(_dataDir, "cache", "videos", entityId.ToString(), "thumb.jpg");

    public string VideoPreviewPath(Guid entityId) =>
        Path.Combine(_dataDir, "cache", "videos", entityId.ToString(), "preview.mp4");

    public string VideoSpritePath(Guid entityId) =>
        Path.Combine(_dataDir, "cache", "videos", entityId.ToString(), "sprite.jpg");

    public string VideoTrickplayVttPath(Guid entityId) =>
        Path.Combine(_dataDir, "cache", "videos", entityId.ToString(), "trickplay.vtt");

    public string TrickplayFrameDir(Guid entityId) =>
        Path.Combine(_dataDir, "cache", "videos", entityId.ToString(), "trickplay-frames");

    public string ImageThumbnailPath(Guid entityId) =>
        Path.Combine(_dataDir, "cache", "images", entityId.ToString(), "thumb.jpg");

    public string BookPageThumbnailPath(Guid entityId) =>
        Path.Combine(_dataDir, "cache", "book-pages", entityId.ToString(), "thumb.jpg");

    public string AudioWaveformPath(Guid entityId) =>
        Path.Combine(_dataDir, "cache", "audio-tracks", entityId.ToString(), "waveform.json");

    public string SubtitleDir(Guid entityId) =>
        Path.Combine(_dataDir, "cache", "videos", entityId.ToString(), "subtitles");
}
