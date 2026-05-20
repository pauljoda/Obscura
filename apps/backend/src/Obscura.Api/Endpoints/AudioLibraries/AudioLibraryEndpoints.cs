using Obscura.Contracts.Entities;
using Obscura.Contracts.Media;

namespace Obscura.Api.Endpoints;

public static class AudioLibraryEndpoints {
    public static RouteGroupBuilder MapAudioLibraryEndpoints(this IEndpointRouteBuilder routes) =>
        routes.MapEntityKindRoutes(
            "/api/audio-libraries",
            "audio-library",
            "Audio",
            "ListAudioLibraries",
            "GetAudioLibrary",
            typeof(EntityListResponse),
            typeof(AudioLibraryDetail));
}
