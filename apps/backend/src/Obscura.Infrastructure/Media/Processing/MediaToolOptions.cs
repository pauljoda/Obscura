namespace Obscura.Infrastructure.Media.Processing;

/// <summary>
/// Resolves the ffmpeg and ffprobe executables used by media probing, playback
/// transcodes, thumbnails, preview clips, trickplay images, subtitles, and waveforms.
/// When only ffmpeg is configured, ffprobe is resolved as the companion binary in the
/// same directory so custom builds such as Jellyfin FFmpeg are used consistently.
/// </summary>
/// <param name="FfmpegPath">Executable name or absolute path for ffmpeg.</param>
/// <param name="ConfiguredFfprobePath">Optional executable name or absolute path for ffprobe.</param>
public sealed record MediaToolOptions(
    string FfmpegPath = "ffmpeg",
    string? ConfiguredFfprobePath = null) {
    /// <summary>
    /// Gets the ffprobe executable that belongs with <see cref="FfmpegPath" /> unless
    /// an explicit ffprobe path was configured.
    /// </summary>
    public string FfprobePath => ResolveFfprobePath(FfmpegPath, ConfiguredFfprobePath);

    /// <summary>
    /// Resolves ffprobe from an explicit override or by replacing the configured
    /// ffmpeg executable name with ffprobe while preserving its directory.
    /// </summary>
    /// <param name="ffmpegPath">Executable name or absolute path for ffmpeg.</param>
    /// <param name="configuredFfprobePath">Optional executable name or absolute path for ffprobe.</param>
    /// <returns>The executable name or absolute path to use for ffprobe.</returns>
    public static string ResolveFfprobePath(string? ffmpegPath, string? configuredFfprobePath = null) {
        if (!string.IsNullOrWhiteSpace(configuredFfprobePath)) {
            return configuredFfprobePath.Trim();
        }

        var normalizedFfmpeg = string.IsNullOrWhiteSpace(ffmpegPath) ? "ffmpeg" : ffmpegPath.Trim();
        var fileName = Path.GetFileName(normalizedFfmpeg);
        var probeName = fileName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) ? "ffprobe.exe" : "ffprobe";
        var directory = Path.GetDirectoryName(normalizedFfmpeg);
        return string.IsNullOrWhiteSpace(directory) ? probeName : Path.Combine(directory, probeName);
    }
}
