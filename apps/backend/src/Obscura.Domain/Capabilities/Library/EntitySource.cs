namespace Obscura.Domain.Capabilities;

/// <summary>
/// Source provenance path or library reference attached to an entity.
/// </summary>
/// <param name="Code">Stable source code, such as library-root, folder, relative, file, archive, or zip.</param>
/// <param name="Value">Path, identifier, or source value.</param>
public sealed record EntitySource(string Code, string Value);
