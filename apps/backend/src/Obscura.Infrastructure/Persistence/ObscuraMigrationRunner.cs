using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Obscura.Infrastructure.Persistence;

public static class ObscuraMigrationRunner
{
    public static async Task ApplyObscuraMigrationsAsync(
        IServiceProvider services,
        IConfiguration configuration,
        CancellationToken cancellationToken = default)
    {
        if (!ShouldApply(configuration))
        {
            return;
        }

        await using var scope = services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ObscuraDbContext>();
        await db.Database.MigrateAsync(cancellationToken);
    }

    private static bool ShouldApply(IConfiguration configuration)
    {
        if (AppDomain.CurrentDomain
            .GetAssemblies()
            .Any(assembly => assembly.GetName().Name == "Microsoft.AspNetCore.Mvc.Testing"))
        {
            return false;
        }

        var configured = configuration["Obscura:ApplyMigrations"];
        return configured is null || bool.TryParse(configured, out var enabled) && enabled;
    }
}
