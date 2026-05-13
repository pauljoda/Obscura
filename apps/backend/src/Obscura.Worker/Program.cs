using Obscura.Application;
using Obscura.Infrastructure;
using Obscura.Infrastructure.Persistence;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddObscuraApplication();
builder.Services.AddObscuraWorkerApplication();
builder.Services.AddObscuraInfrastructure(builder.Configuration);

var host = builder.Build();
await ObscuraMigrationRunner.ApplyObscuraMigrationsAsync(host.Services, builder.Configuration);
host.Run();
