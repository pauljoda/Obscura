using Obscura.Contracts.Plugins;
using Obscura.Infrastructure.Plugins;

namespace Obscura.Api.Endpoints;

internal static class IdentifyProviderEndpoints {
    internal static RouteGroupBuilder MapIdentifyProviderEndpoints(this RouteGroupBuilder group) {
        group.MapGet("/providers", async (
            string? kind,
            IdentifyPluginService identify,
            CancellationToken cancellationToken) =>
            Results.Ok(await identify.ListProvidersAsync(kind, cancellationToken)))
            .WithName("ListIdentifyProviders")
            .WithSummary("Lists compatible v2 providers that can identify the requested entity kind.")
            .Produces<IReadOnlyList<PluginProvider>>();

        return group;
    }
}
