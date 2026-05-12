using Obscura.Contracts.System;
using Obscura.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddHealthChecks();
builder.Services.AddObscuraInfrastructure(builder.Configuration);

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/health", () =>
    Results.Ok(new HealthResponseDto("ok", "dotnet")))
    .WithName("GetHealth")
    .WithSummary("Reports that the Obscura .NET backend is ready to accept requests.");

app.MapFallback(() => Results.NotFound(new ProblemDetailsDto(
    "not_found",
    "The requested Obscura route was not found.")));

app.Run();

public partial class Program;
