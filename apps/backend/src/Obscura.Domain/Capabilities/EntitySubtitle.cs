namespace Obscura.Domain.Capabilities;

public sealed record EntitySubtitle(
    Guid Id,
    string Language,
    string? Label,
    string Format,
    string Source,
    string StoragePath,
    string SourceFormat,
    string? SourcePath,
    bool IsDefault);
