using Microsoft.EntityFrameworkCore;
using Obscura.Contracts.Settings;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Settings;

public sealed class SettingsService : ISettingsService
{
    private readonly ObscuraDbContext _db;

    public SettingsService(ObscuraDbContext db)
    {
        _db = db;
    }

    public async Task<SettingsDto> GetAsync(CancellationToken cancellationToken)
    {
        var row = await EnsureRowAsync(cancellationToken);
        return ToDto(row);
    }

    public async Task<SettingsDto> UpdateAsync(SettingsUpdateRequestDto request, CancellationToken cancellationToken)
    {
        var row = await EnsureRowAsync(cancellationToken);

        if (request.HideNsfw is { } hideNsfw)
        {
            row.HideNsfw = hideNsfw;
        }

        if (request.EnableCastControls is { } enableCastControls)
        {
            row.ShowCastControls = enableCastControls;
        }

        row.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);

        return ToDto(row);
    }

    private async Task<LibrarySettingsRow> EnsureRowAsync(CancellationToken cancellationToken)
    {
        var row = await _db.LibrarySettings
            .OrderBy(settings => settings.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (row is not null)
        {
            return row;
        }

        var now = DateTimeOffset.UtcNow;
        row = new LibrarySettingsRow
        {
            Id = Guid.NewGuid(),
            CreatedAt = now,
            UpdatedAt = now
        };

        _db.LibrarySettings.Add(row);
        await _db.SaveChangesAsync(cancellationToken);

        return row;
    }

    private static SettingsDto ToDto(LibrarySettingsRow row)
    {
        return new SettingsDto(
            HideNsfw: row.HideNsfw,
            EnableCastControls: row.ShowCastControls);
    }
}
