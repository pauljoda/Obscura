using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Obscura.Infrastructure.Database;

namespace Obscura.Infrastructure.Persistence;

public sealed class ObscuraDbContextFactory : IDesignTimeDbContextFactory<ObscuraDbContext>
{
    public ObscuraDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL") ??
            "Host=localhost;Port=5432;Database=obscura;Username=obscura;Password=obscura";

        var options = new DbContextOptionsBuilder<ObscuraDbContext>()
            .UseNpgsql(PostgresConnectionString.Normalize(connectionString))
            .Options;

        return new ObscuraDbContext(options);
    }
}
