using Obscura.Domain.Entities;

namespace Obscura.Domain.Media;

public sealed record VideoSeries(
    Entity Entity,
    string? Summary,
    IReadOnlyList<Entity> Children,
    IReadOnlyList<Entity> Videos,
    string RenderingMode);
