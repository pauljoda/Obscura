namespace Obscura.Infrastructure.Backups;

public interface IDatabaseBackupService
{
    Task<DatabaseBackupResult> CreateBackupAsync(CancellationToken cancellationToken);
}
