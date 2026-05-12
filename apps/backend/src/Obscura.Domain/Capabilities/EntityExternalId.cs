namespace Obscura.Domain.Capabilities;

public sealed record EntityExternalId(string Provider, string Value, string? Url);
