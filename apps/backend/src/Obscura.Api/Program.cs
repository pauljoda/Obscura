using Obscura.Api;
using Obscura.Api.Endpoints;
using Obscura.Api.Serialization;
using Obscura.Application;
using Obscura.Contracts.System;
using Obscura.Infrastructure;
using Obscura.Infrastructure.Persistence;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

var configuredStaticWebRoot = builder.Configuration["OBSCURA_STATIC_WEB_ROOT"] ??
    builder.Configuration["Obscura:StaticWebRoot"];
var resolvedStaticWebRoot = ResolveStaticWebRoot(
    configuredStaticWebRoot,
    builder.Environment.ContentRootPath);
var staticFileProvider = resolvedStaticWebRoot is not null
    ? new PhysicalFileProvider(resolvedStaticWebRoot)
    : null;

var dataDir = ResolvePath(builder.Configuration["OBSCURA_DATA_DIR"] ??
    builder.Configuration["Obscura:DataDir"] ??
    "/data", builder.Environment.ContentRootPath);
var cacheDir = ResolvePath(builder.Configuration["OBSCURA_CACHE_DIR"] ??
    builder.Configuration["Obscura:CacheDir"] ??
    Path.Combine(dataDir, "cache"), builder.Environment.ContentRootPath);

builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new CodecJsonConverterFactory()));
builder.Services.AddOpenApi(options => {
    // Nested types like CapabilitySource.Item share the simple name "Item"
    // with siblings in other capabilities. Use the declaring chain so each
    // nested record gets a unique OpenAPI schema id.
    options.CreateSchemaReferenceId = type => {
        if (type.Type is { IsNested: true } nested) {
            var declaring = nested.DeclaringType;
            var prefix = string.Empty;
            while (declaring is not null) {
                prefix = declaring.Name + prefix;
                declaring = declaring.DeclaringType;
            }
            return prefix + nested.Name;
        }
        return Microsoft.AspNetCore.OpenApi.OpenApiOptions.CreateDefaultSchemaReferenceId(type);
    };
});
builder.Services.AddHealthChecks();
builder.Services.AddCors(options => {
    options.AddPolicy("ObscuraDevCors", policy => {
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
builder.Services.AddObscuraApplication();
builder.Services.AddObscuraInfrastructure(builder.Configuration, builder.Environment.ContentRootPath);

var app = builder.Build();

if (app.Environment.IsDevelopment()) {
    app.MapOpenApi();
    app.UseCors("ObscuraDevCors");
    if (staticFileProvider is null) {
        app.UseSpaDevServer("http://localhost:5173");
    }
}

if (staticFileProvider is not null) {
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = staticFileProvider });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = staticFileProvider });
} else {
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

if (Directory.Exists(cacheDir)) {
    app.UseStaticFiles(new StaticFileOptions {
        FileProvider = new PhysicalFileProvider(cacheDir),
        RequestPath = "/assets",
        ServeUnknownFileTypes = false,
    });
}

app.MapGet("/api/health", () =>
    Results.Ok(new HealthResponse("ok", "dotnet")))
    .WithName("GetHealth")
    .WithSummary("Reports that the Obscura .NET backend is ready to accept requests.");

app.MapVideoEndpoints();
app.MapEntityEndpoints();
app.MapJellyfinPlaybackEndpoints();
app.MapJobEndpoints();
app.MapSettingsEndpoints();
app.MapUserStateEndpoints();
app.MapPluginEndpoints();
app.MapIdentifyEndpoints();
app.MapOrganizeEndpoints();

var staticIndexPath = resolvedStaticWebRoot is not null
    ? Path.Combine(resolvedStaticWebRoot, "index.html")
    : Path.Combine(app.Environment.WebRootPath ?? string.Empty, "index.html");

if (File.Exists(staticIndexPath)) {
    app.MapFallback(async () =>
        Results.Content(await File.ReadAllTextAsync(staticIndexPath), "text/html"));
} else {
    app.MapFallback(() => Results.NotFound(new ApiProblem(
        "not_found",
        "The requested Obscura route was not found.")));
}

await ObscuraMigrationRunner.ApplyObscuraMigrationsAsync(app.Services, app.Configuration);

app.Run();

static string? ResolveStaticWebRoot(string? configuredPath, string contentRootPath) {
    if (string.IsNullOrWhiteSpace(configuredPath)) {
        return null;
    }

    var candidates = Path.IsPathRooted(configuredPath)
        ? [configuredPath]
        : new[]
        {
            Path.GetFullPath(Path.Combine(contentRootPath, configuredPath)),
            Path.GetFullPath(configuredPath)
        };

    return candidates.FirstOrDefault(Directory.Exists);
}

static string ResolvePath(string path, string basePath) =>
    Path.GetFullPath(Path.IsPathRooted(path)
        ? path
        : Path.Combine(basePath, path));

public partial class Program;
