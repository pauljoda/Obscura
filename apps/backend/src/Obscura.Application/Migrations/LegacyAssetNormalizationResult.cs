namespace Obscura.Application.Migrations;

/// <summary>
/// Result of normalizing legacy v1 asset paths to v2 standard format.
/// </summary>
/// <param name="PathsNormalized">Number of <c>v2.entity_files</c> rows whose path was updated.</param>
/// <param name="FilesRenamed">Number of files on disk renamed from v1 to v2 naming.</param>
public sealed record LegacyAssetNormalizationResult(int PathsNormalized, int FilesRenamed);
