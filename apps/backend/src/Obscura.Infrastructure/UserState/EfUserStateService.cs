using Microsoft.EntityFrameworkCore;
using Obscura.Application.UserState;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.UserState;

/// <summary>
/// EF-backed browser user-state store for the single-user UI shell.
/// </summary>
public sealed class EfUserStateService(ObscuraDbContext db) : IUserStateService
{
    private const string PlaylistSessionKey = "ui:playlist-session";

    /// <inheritdoc />
    public async Task<string?> GetPlaylistSessionJsonAsync(CancellationToken cancellationToken)
    {
        var row = await db.UiPreferences.AsNoTracking()
            .FirstOrDefaultAsync(pref => pref.Key == PlaylistSessionKey, cancellationToken);

        return string.IsNullOrWhiteSpace(row?.ValueJson) ? null : row.ValueJson;
    }

    /// <inheritdoc />
    public async Task SavePlaylistSessionJsonAsync(string valueJson, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var row = await db.UiPreferences.FindAsync([PlaylistSessionKey], cancellationToken);
        if (row is null)
        {
            db.UiPreferences.Add(new UiPreferenceRow
            {
                Key = PlaylistSessionKey,
                ValueJson = valueJson,
                UpdatedAt = now
            });
        }
        else
        {
            row.ValueJson = valueJson;
            row.UpdatedAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task ClearPlaylistSessionAsync(CancellationToken cancellationToken)
    {
        var row = await db.UiPreferences.FindAsync([PlaylistSessionKey], cancellationToken);
        if (row is null)
        {
            return;
        }

        db.UiPreferences.Remove(row);
        await db.SaveChangesAsync(cancellationToken);
    }
}
