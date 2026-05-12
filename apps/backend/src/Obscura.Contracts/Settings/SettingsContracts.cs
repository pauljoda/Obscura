namespace Obscura.Contracts.Settings;

public sealed record SettingsResponse(
    bool HideNsfw,
    bool EnableCastControls);

public sealed record SettingsUpdateRequest(
    bool? HideNsfw,
    bool? EnableCastControls);
