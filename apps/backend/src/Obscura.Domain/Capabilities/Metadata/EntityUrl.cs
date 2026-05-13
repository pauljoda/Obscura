namespace Obscura.Domain.Capabilities;

/// <summary>
/// Stores a user-visible URL associated with an entity.
/// </summary>
/// <param name="Url">Absolute external URL.</param>
/// <param name="Label">Optional label for display, such as a provider or site name.</param>
public sealed record EntityUrl(string Url, string? Label);
