using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;
using Obscura.Infrastructure.Processes;

namespace Obscura.Infrastructure.Backups;

/// <summary>
/// Creates PostgreSQL dump backups before destructive v2 migration reset operations.
/// </summary>
public sealed class DatabaseBackupService
{
    private readonly ObscuraDbContext _db;
    private readonly ProcessExecutor _processExecutor;
    private readonly string _connectionString;
    private readonly string _dataDir;

    /// <summary>
    /// Creates the backup service.
    /// </summary>
    /// <param name="db">Database context used to record backup attempts.</param>
    /// <param name="processExecutor">Process runner used to invoke pg_dump.</param>
    /// <param name="options">Backup connection and filesystem options.</param>
    public DatabaseBackupService(
        ObscuraDbContext db,
        ProcessExecutor processExecutor,
        DatabaseBackupServiceOptions options)
    {
        _db = db;
        _processExecutor = processExecutor;
        _connectionString = options.ConnectionString;
        _dataDir = options.DataDir;
    }

    /// <summary>
    /// Creates a timestamped pg_dump file and records the result in the v2 backup table.
    /// </summary>
    /// <param name="cancellationToken">Token used to cancel backup creation.</param>
    /// <returns>Backup path when pg_dump exits successfully.</returns>
    public async Task<DatabaseBackupResult> CreateBackupAsync(CancellationToken cancellationToken)
    {
        var plan = PostgresBackupPlan.Create(_dataDir, DateTimeOffset.UtcNow);
        Directory.CreateDirectory(Path.GetDirectoryName(plan.BackupPath)!);

        var row = new DatabaseBackupRow
        {
            Id = Guid.NewGuid(),
            BackupPath = plan.BackupPath,
            Status = DatabaseBackupStatus.Running,
            CreatedAt = DateTimeOffset.UtcNow
        };

        _db.DatabaseBackups.Add(row);
        await _db.SaveChangesAsync(cancellationToken);

        var environment = PostgresEnvironment.FromConnectionString(_connectionString);
        var process = await _processExecutor.RunAsync(plan.FileName, plan.Arguments, environment, cancellationToken);

        row.CompletedAt = DateTimeOffset.UtcNow;
        row.Status = process.ExitCode == 0 ? DatabaseBackupStatus.Completed : DatabaseBackupStatus.Failed;
        row.Error = process.ExitCode == 0 ? null : $"pg_dump exited with code {process.ExitCode}.";
        await _db.SaveChangesAsync(cancellationToken);

        if (process.ExitCode != 0)
        {
            throw new InvalidOperationException(row.Error);
        }

        return new DatabaseBackupResult(plan.BackupPath);
    }
}
