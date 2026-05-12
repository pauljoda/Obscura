namespace Obscura.Contracts.Settings;

public sealed record SettingsDto(
    bool HideNsfw,
    bool EnableCastControls);

public sealed record SettingsUpdateRequestDto(
    bool? HideNsfw,
    bool? EnableCastControls);
