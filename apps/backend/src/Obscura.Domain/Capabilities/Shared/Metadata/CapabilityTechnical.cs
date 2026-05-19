namespace Obscura.Domain.Capabilities;

/// <summary>
/// Mutable technical metadata capability for media-like entities.
/// </summary>
public sealed class CapabilityTechnical : EntityCapability {
    /// <inheritdoc />

    /// <summary>Media duration when known.</summary>
    public TimeSpan? Duration { get; set; }

    /// <summary>Pixel width when known.</summary>
    public int? Width { get; set; }

    /// <summary>Pixel height when known.</summary>
    public int? Height { get; set; }

    /// <summary>Video frame rate when known.</summary>
    public double? FrameRate { get; set; }

    /// <summary>Media bit rate when known.</summary>
    public int? BitRate { get; set; }

    /// <summary>Audio sample rate when known.</summary>
    public int? SampleRate { get; set; }

    /// <summary>Audio channel count when known.</summary>
    public int? Channels { get; set; }

    /// <summary>Primary codec when known.</summary>
    public string? Codec { get; set; }

    /// <summary>Container name when known.</summary>
    public string? Container { get; set; }

    /// <summary>Format name when known.</summary>
    public string? Format { get; set; }
}
