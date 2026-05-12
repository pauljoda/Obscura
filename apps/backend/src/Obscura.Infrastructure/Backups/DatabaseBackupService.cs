using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Backups;

public sealed class DatabaseBackupService : IDatabaseBackupService
{
    private readonly ObscuraDbContext _db;
    private readonly IProcessRunner _processRunner;
    private readonly string _connectionString;
    private readonly string _dataDir;

    public DatabaseBackupService(
        ObscuraDbContext db,
        IProcessRunner processRunner,
        DatabaseBackupServiceOptions options)
    {
        _db = db;
        _processRunner = processRunner;
        _connectionString = options.ConnectionString;
        _dataDir = options.DataDir;
    }

    public async Task<DatabaseBackupResult> CreateBackupAsync(CancellationToken cancellationToken)
    {
        var plan = PostgresBackupPlan.Create(_dataDir, DateTimeOffset.UtcNow);
        Directory.CreateDirectory(Path.GetDirectoryName(plan.BackupPath)!);

        var row = new DatabaseBackupRow
        {
            Id = Guid.NewGuid(),
            BackupPath = plan.BackupPath,
            Status = "running",
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.DatabaseBackups.Add(row);
        await _db.SaveChangesAsync(cancellationToken);

        var environment = PostgresEnvironment.FromConnectionString(_connectionString);
        var exitCode = await _processRunner.RunAsync(plan.FileName, plan.Arguments, environment, cancellationToken);

        row.CompletedAt = DateTimeOffset.UtcNow;
        row.Status = exitCode == 0 ? "completed" : "failed";
        row.Error = exitCode == 0 ? null : $"pg_dump exited with code {exitCode}.";
        await _db.SaveChangesAsync(cancellationToken);

        if (exitCode != 0)
        {
            throw new InvalidOperationException(row.Error);
        }

        return new DatabaseBackupResult(plan.BackupPath);
    }
}
