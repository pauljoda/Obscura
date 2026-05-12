namespace Obscura.Domain.Capabilities;

public sealed record Links(
    IReadOnlyList<EntityUrl> Urls,
    IReadOnlyList<EntityExternalId> ExternalIds)
{
    public static Links Empty { get; } = new([], []);
}
