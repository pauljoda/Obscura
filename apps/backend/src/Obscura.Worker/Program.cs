using Obscura.Worker;
using Obscura.Infrastructure;
using Obscura.Infrastructure.Persistence;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddObscuraInfrastructure(builder.Configuration);
builder.Services.AddSingleton<IJobHandler, NoOpJobHandler>();
builder.Services.AddHostedService<QueueWorker>();

var host = builder.Build();
await ObscuraMigrationRunner.ApplyObscuraMigrationsAsync(host.Services, builder.Configuration);
host.Run();
