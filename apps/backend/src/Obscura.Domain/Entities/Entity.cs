using Obscura.Domain.Capabilities;

namespace Obscura.Domain.Entities;

/// <summary>
/// The root object for anything Obscura can display, organize, rate, tag, or relate to other objects.
/// </summary>
/// <param name="Id">Stable global entity identifier.</param>
/// <param name="Kind">Code-defined entity kind that determines broad behavior and routing.</param>
/// <param name="Title">Primary user-facing title.</param>
/// <param name="Subtitle">Optional secondary text for cards and detail headers.</param>
/// <param name="Capabilities">Reusable behaviors and projections attached to this entity.</param>
public sealed record Entity(
    Guid Id,
    EntityKind Kind,
    string Title,
    string? Subtitle,
    EntityCapabilities Capabilities);
