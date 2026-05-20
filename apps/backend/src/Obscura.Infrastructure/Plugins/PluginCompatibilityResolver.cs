using Obscura.Contracts.Plugins;

namespace Obscura.Infrastructure.Plugins;

/// <summary>
/// Selects plugin artifacts that are safe for the current Obscura build.
/// </summary>
public static class PluginCompatibilityResolver {
    /// <summary>
    /// Finds the newest v2 dotnet-process artifact for a plugin that supports the current app version.
    /// </summary>
    /// <param name="entries">Community index entries to search.</param>
    /// <param name="pluginId">Plugin identifier requested by the app.</param>
    /// <param name="currentAppVersion">Current Obscura version with any dev suffix already removed.</param>
    /// <returns>The latest compatible artifact, or null when none can run.</returns>
    public static PluginIndexEntryV2? LatestCompatible(
        IEnumerable<PluginIndexEntryV2> entries,
        string pluginId,
        Version currentAppVersion) {
        ArgumentNullException.ThrowIfNull(entries);
        ArgumentException.ThrowIfNullOrWhiteSpace(pluginId);
        ArgumentNullException.ThrowIfNull(currentAppVersion);

        return entries
            .Where(entry => string.Equals(entry.Id, pluginId, StringComparison.OrdinalIgnoreCase))
            .Where(IsV2DotnetProcess)
            .Where(entry => SupportsAppVersion(entry.Compat, currentAppVersion))
            .OrderByDescending(entry => ParseVersion(entry.Version))
            .FirstOrDefault();
    }

    private static bool IsV2DotnetProcess(PluginIndexEntryV2 entry) =>
        entry.ManifestVersion == 2 &&
        string.Equals(entry.Runtime, "dotnet-process", StringComparison.OrdinalIgnoreCase) &&
        entry.ApiTags.Any(tag => string.Equals(tag, "v2", StringComparison.OrdinalIgnoreCase));

    private static bool SupportsAppVersion(PluginCompatibility compatibility, Version current) {
        var min = ParseVersion(compatibility.ObscuraMin);
        if (current < min) {
            return false;
        }

        if (string.IsNullOrWhiteSpace(compatibility.ObscuraMax)) {
            return true;
        }

        var max = ParseVersion(compatibility.ObscuraMax);
        return current <= max;
    }

    private static Version ParseVersion(string value) {
        var normalized = value.Split('-', 2)[0];
        return Version.TryParse(normalized, out var version)
            ? version
            : new Version(0, 0, 0);
    }
}
