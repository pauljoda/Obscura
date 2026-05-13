namespace Obscura.Domain.Capabilities;

/// <summary>
/// Shared technical metadata for media-like entities.
/// </summary>
public sealed record CapabilityTechnical(
    TimeSpan? Duration = null,
    int? Width = null,
    int? Height = null,
    double? FrameRate = null,
    int? BitRate = null,
    int? SampleRate = null,
    int? Channels = null,
    string? Codec = null,
    string? Container = null,
    string? Format = null) : ICapability<CapabilityTechnical>
{
    /// <inheritdoc />
    public static ICapabilityKind<CapabilityTechnical> CapabilityKind { get; } = new CapabilityKind<CapabilityTechnical>("technical", "Technical");

    /// <inheritdoc />
    public ICapabilityKind Kind => CapabilityKind;

    /// <summary>A reusable empty technical capability.</summary>
    public static CapabilityTechnical Empty { get; } = new();
}
