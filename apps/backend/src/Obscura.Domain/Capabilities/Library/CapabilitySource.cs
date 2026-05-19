namespace Obscura.Domain.Capabilities;

/// <summary>
/// Mutable source capability for library, file, and import provenance values.
/// </summary>
public sealed class CapabilitySource(IEnumerable<CapabilitySource.Item>? items = null)
    : CollectionCapability<CapabilitySource.Item, string>(items, StringComparer.Ordinal) {
    /// <summary>
    /// Source provenance path or library reference attached to an entity.
    /// </summary>
    /// <param name="Code">Stable source code, such as library-root, folder, relative, file, archive, or zip.</param>
    /// <param name="Value">Path, identifier, or source value.</param>
    public sealed record Item(string Code, string Value) : ICapabilityItem<string> {
        /// <inheritdoc />
        public string Key => Code;
    }

    /// <summary>Adds a provenance entry. Multiple entries may share a source code.</summary>
    /// <param name="code">Stable source code.</param>
    /// <param name="value">Path, identifier, or source value.</param>
    public void Add(string code, string value) => AddItem(new Item(code, value));

    /// <summary>Removes every provenance entry with the supplied source code.</summary>
    /// <param name="code">Source code to remove.</param>
    /// <returns>True when at least one entry was removed.</returns>
    public bool RemoveByCode(string code) => Remove(code);
}
