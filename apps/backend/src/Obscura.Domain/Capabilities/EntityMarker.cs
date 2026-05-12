namespace Obscura.Domain.Capabilities;

public sealed record EntityMarker(Guid Id, string Title, double Seconds, double? EndSeconds);
