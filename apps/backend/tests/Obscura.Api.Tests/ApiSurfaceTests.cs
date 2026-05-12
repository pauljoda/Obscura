using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Obscura.Contracts.Entities;
using Obscura.Contracts.Jobs;
using Obscura.Contracts.Settings;
using Obscura.Contracts.Videos;

namespace Obscura.Api.Tests;

public sealed class ApiSurfaceTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ApiSurfaceTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task EntityListEndpointReturnsAStablePagedShape()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetFromJsonAsync<EntityListResponseDto>("/api/entities?kind=video");

        Assert.NotNull(response);
        Assert.Empty(response.Items);
        Assert.Null(response.NextCursor);
    }

    [Fact]
    public async Task VideoListEndpointReturnsAStablePagedShape()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetFromJsonAsync<VideoListResponseDto>("/api/videos");

        Assert.NotNull(response);
        Assert.Empty(response.Items);
        Assert.Null(response.NextCursor);
    }

    [Fact]
    public async Task JobsEndpointReturnsAnOperationsDashboardShape()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetFromJsonAsync<JobListResponseDto>("/api/jobs");

        Assert.NotNull(response);
        Assert.Empty(response.Items);
    }

    [Fact]
    public async Task SettingsEndpointReturnsRuntimeDefaults()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetFromJsonAsync<SettingsDto>("/api/settings");

        Assert.NotNull(response);
        Assert.False(response.HideNsfw);
        Assert.True(response.EnableCastControls);
    }

    [Fact]
    public async Task MissingEntityDetailUsesProblemDetailsShape()
    {
        using var client = _factory.CreateClient();
        var id = Guid.Parse("11111111-1111-1111-1111-111111111111");

        using var response = await client.GetAsync($"/api/entities/{id}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
    }
}
