namespace Obscura.Api.Endpoints;

public static class EndpointRouteBuilderExtensions {
    public static IEndpointRouteBuilder MapObscuraEndpoints(this IEndpointRouteBuilder routes) {
        routes.MapHealthEndpoints();
        routes.MapEntityEndpoints();
        routes.MapVideoEndpoints();
        routes.MapSeriesEndpoints();
        routes.MapImageEndpoints();
        routes.MapGalleryEndpoints();
        routes.MapBookEndpoints();
        routes.MapAudioLibraryEndpoints();
        routes.MapAudioTrackEndpoints();
        routes.MapPeopleEndpoints();
        routes.MapStudioEndpoints();
        routes.MapTagEndpoints();
        routes.MapCollectionEndpoints();
        routes.MapJellyfinPlaybackEndpoints();
        routes.MapJobEndpoints();
        routes.MapSettingsEndpoints();
        routes.MapLibraryEndpoints();
        routes.MapFilesEndpoints();
        routes.MapUserStateEndpoints();
        routes.MapPluginEndpoints();
        routes.MapIdentifyEndpoints();
        routes.MapOrganizeEndpoints();

        return routes;
    }
}
