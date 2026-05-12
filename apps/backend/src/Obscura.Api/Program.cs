using Obscura.Api.Endpoints;
using Obscura.Contracts.System;
using Obscura.Infrastructure;
using Obscura.Infrastructure.Persistence;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

var configuredStaticWebRoot = builder.Configuration["OBSCURA_STATIC_WEB_ROOT"] ??
    builder.Configuration["Obscura:StaticWebRoot"];
var staticFileProvider = !string.IsNullOrWhiteSpace(configuredStaticWebRoot) &&
    Directory.Exists(configuredStaticWebRoot)
        ? new PhysicalFileProvider(configuredStaticWebRoot)
        : null;

builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();
builder.Services.AddCors(options =>
{
    options.AddPolicy("ObscuraDevCors", policy =>
    {
        policy
            .AllowAnyHeader()
            .AllowAnyMethod()
            .SetIsOriginAllowed(origin =>
                Uri.TryCreate(origin, UriKind.Absolute, out var uri) &&
                (uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
                 uri.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase) ||
                 uri.Host.Equals("::1", StringComparison.OrdinalIgnoreCase)));
    });
});
builder.Services.AddObscuraInfrastructure(builder.Configuration);

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseCors("ObscuraDevCors");
}

if (staticFileProvider is not null)
{
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = staticFileProvider });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = staticFileProvider });
}
else
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.MapGet("/api/health", () =>
    Results.Ok(new HealthResponseDto("ok", "dotnet")))
    .WithName("GetHealth")
    .WithSummary("Reports that the Obscura .NET backend is ready to accept requests.");

app.MapEntityEndpoints();
app.MapCollectionEndpoints();
app.MapMediaEndpoints();
app.MapSeriesEndpoints();
app.MapVideoEndpoints();
app.MapJobEndpoints();
app.MapSettingsEndpoints();
app.MapSystemEndpoints();
app.MapTaxonomyEndpoints();

var staticIndexPath = staticFileProvider is not null
    ? Path.Combine(configuredStaticWebRoot!, "index.html")
    : Path.Combine(app.Environment.WebRootPath ?? string.Empty, "index.html");

if (File.Exists(staticIndexPath))
{
    app.MapFallback(async () =>
        Results.Content(await File.ReadAllTextAsync(staticIndexPath), "text/html"));
}
else
{
    app.MapFallback(() => Results.NotFound(new ProblemDetailsDto(
        "not_found",
        "The requested Obscura route was not found.")));
}

await ObscuraMigrationRunner.ApplyObscuraMigrationsAsync(app.Services, app.Configuration);

app.Run();

public partial class Program;
