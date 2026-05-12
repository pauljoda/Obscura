using Obscura.Domain.Capabilities;

namespace Obscura.Domain.Entities;

public sealed record Entity(
    Guid Id,
    EntityKind Kind,
    string Title,
    string? Subtitle,
    EntityCapabilities Capabilities);
