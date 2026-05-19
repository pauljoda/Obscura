using Microsoft.EntityFrameworkCore;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.UserState;

/// <summary>
/// EF-backed browser user-state store for the single-user UI shell.
/// </summary>
public sealed class EfUserStateService(ObscuraDbContext db)
{
    private const string PlaylistSessionKey = "ui:playlist-session";

    /// <summary>
    /// Gets the current playlist session JSON document, or null when none has been saved.
    /// </summary>
    public async Task<string?> GetPlaylistSessionJsonAsync(CancellationToken cancellationToken)
    {
        var row = await db.UiPreferences.AsNoTracking()
            .FirstOrDefaultAsync(pref => pref.Key == PlaylistSessionKey, cancellationToken);

        return string.IsNullOrWhiteSpace(row?.ValueJson) ? null : row.ValueJson;
    }

    /// <summary>
    /// Saves the current playlist session JSON document.
    /// </summary>
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

    /// <summary>
    /// Clears the saved playlist session document.
    /// </summary>
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
