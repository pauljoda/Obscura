using Obscura.Worker;
using Obscura.Infrastructure;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddObscuraInfrastructure(builder.Configuration);
builder.Services.AddHostedService<QueueWorker>();

var host = builder.Build();
host.Run();
