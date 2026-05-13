using Microsoft.EntityFrameworkCore;
using Obscura.Application.Migrations;
using Obscura.Infrastructure.Backups;
using Obscura.Infrastructure.Persistence;

namespace Obscura.Infrastructure.FreshStart;

public sealed class V2FreshStartService : IV2FreshStartService
{
    private readonly ObscuraDbContext _db;
    private readonly IDatabaseBackupService _backupService;

    public V2FreshStartService(
        ObscuraDbContext db,
        IDatabaseBackupService backupService)
    {
        _db = db;
        _backupService = backupService;
    }

    public async Task<V2FreshStartResult> PrepareAsync(CancellationToken cancellationToken)
    {
        var backup = await _backupService.CreateBackupAsync(cancellationToken);

        await _db.Database.ExecuteSqlRawAsync(FreshStartSql.PreserveConfiguration, cancellationToken);
        var preservedRoots = await _db.LibraryRoots.CountAsync(cancellationToken);
        var preservedSettings = await _db.LibrarySettings.AnyAsync(cancellationToken);

        return new V2FreshStartResult(
            backup.BackupPath,
            preservedRoots,
            preservedSettings,
            MediaReset: true);
    }
}
