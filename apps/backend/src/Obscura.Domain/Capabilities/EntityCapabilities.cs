using Obscura.Domain.Entities;

namespace Obscura.Domain.Capabilities;

public sealed record EntityCapabilities(
    Rating? Rating,
    Tags Tags,
    Credits Credits,
    EntityReference? Studio,
    Images Images,
    Links Links,
    EntityFlags Flags,
    Files Files)
{
    public static EntityCapabilities Empty { get; } = new(
        null,
        Tags.Empty,
        Credits.Empty,
        null,
        Images.Empty,
        Links.Empty,
        EntityFlags.Empty,
        Files.Empty);
}
