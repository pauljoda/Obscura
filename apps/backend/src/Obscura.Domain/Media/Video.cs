using Obscura.Domain.Capabilities;
using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

public sealed record Video(
    Entity Entity,
    string? Summary,
    TimeSpan? Duration,
    int? Width,
    int? Height,
    Markers Markers,
    Subtitles Subtitles);
