using Obscura.Contracts.Entities;
using Obscura.Contracts.Media;

namespace Obscura.Api.Endpoints;

public static class AudioTrackEndpoints {
    public static RouteGroupBuilder MapAudioTrackEndpoints(this IEndpointRouteBuilder routes) =>
        routes.MapEntityKindRoutes(
            "/api/audio-tracks",
            "audio-track",
            "Audio",
            "ListAudioTracks",
            "GetAudioTrack",
            typeof(EntityListResponse),
            typeof(AudioTrackDetail));
}
