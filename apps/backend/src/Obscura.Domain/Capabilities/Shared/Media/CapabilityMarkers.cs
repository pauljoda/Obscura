namespace Obscura.Domain.Capabilities;

/// <summary>
/// Mutable marker capability for timeline, page, or navigation markers.
/// </summary>
public sealed class CapabilityMarkers : EntityCapability {
    public CapabilityMarkers(IReadOnlyList<EntityMarker>? items = null) {
        Items = items?.ToArray() ?? [];
    }

    public IReadOnlyList<EntityMarker> Items { get; private set; }

    /// <summary>
    /// Adds a marker and returns its stable identifier.
    /// </summary>
    public Guid Add(string title, double seconds, double? endSeconds = null) {
        var marker = new EntityMarker(Guid.NewGuid(), NormalizeTitle(title), ClampSeconds(seconds), ClampEndSeconds(seconds, endSeconds));
        Items = Items.Append(marker).OrderBy(item => item.Seconds).ToArray();
        return marker.Id;
    }

    /// <summary>
    /// Updates an existing marker.
    /// </summary>
    public bool Update(Guid markerId, string title, double seconds, double? endSeconds = null) {
        if (!Items.Any(item => item.Id == markerId)) {
            return false;
        }

        var next = new EntityMarker(markerId, NormalizeTitle(title), ClampSeconds(seconds), ClampEndSeconds(seconds, endSeconds));
        Items = Items.Select(item => item.Id == markerId ? next : item).OrderBy(item => item.Seconds).ToArray();
        return true;
    }

    /// <summary>
    /// Deletes an existing marker.
    /// </summary>
    public bool Delete(Guid markerId) {
        var next = Items.Where(item => item.Id != markerId).ToArray();
        if (next.Length == Items.Count) {
            return false;
        }

        Items = next;
        return true;
    }

    private static string NormalizeTitle(string title) =>
        string.IsNullOrWhiteSpace(title)
            ? throw new ArgumentException("Marker title cannot be empty.", nameof(title))
            : title.Trim();

    private static double ClampSeconds(double seconds) =>
        double.IsFinite(seconds) ? Math.Max(0, seconds) : 0;

    private static double? ClampEndSeconds(double seconds, double? endSeconds) =>
        endSeconds is null ? null : Math.Max(ClampSeconds(seconds), ClampSeconds(endSeconds.Value));
}
