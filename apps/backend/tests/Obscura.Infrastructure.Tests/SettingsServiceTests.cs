using Microsoft.EntityFrameworkCore;
using Obscura.Contracts.Settings;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Settings;

namespace Obscura.Infrastructure.Tests;

public sealed class SettingsServiceTests
{
    [Fact]
    public async Task GetCreatesDefaultRowWhenFreshStartHasNotPreservedSettings()
    {
        await using var db = CreateContext();
        var service = new SettingsService(db);

        var settings = await service.GetAsync(CancellationToken.None);

        Assert.False(settings.HideNsfw);
        Assert.True(settings.EnableCastControls);
        Assert.Equal(1, await db.LibrarySettings.CountAsync());
    }

    [Fact]
    public async Task UpdatePersistsSettingsToV2LibrarySettings()
    {
        await using var db = CreateContext();
        var service = new SettingsService(db);

        await service.UpdateAsync(new SettingsUpdateRequest(true, false), CancellationToken.None);
        var settings = await service.GetAsync(CancellationToken.None);

        Assert.True(settings.HideNsfw);
        Assert.False(settings.EnableCastControls);
    }

    [Fact]
    public async Task UpdateLibrarySettingsPersistsPreferredAudioLanguages()
    {
        await using var db = CreateContext();
        var service = new SettingsService(db);

        var settings = await service.UpdateLibrarySettingsAsync(
            new LibrarySettingsUpdateRequest(
                null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, "ja,jpn", null, null, null, null, null, null),
            CancellationToken.None);

        Assert.Equal("ja,jpn", settings.AudioPreferredLanguages);
        Assert.Equal("ja,jpn", (await db.LibrarySettings.SingleAsync()).AudioPreferredLanguages);
    }

    private static ObscuraDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ObscuraDbContext>()
            .UseInMemoryDatabase($"settings-{Guid.NewGuid():N}")
            .Options;

        return new ObscuraDbContext(options);
    }
}
