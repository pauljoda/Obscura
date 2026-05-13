namespace Obscura.Domain.Entities;

/// <summary>
/// Closed set of provider runtime shapes supported by the backend.
/// </summary>
public enum ProviderType
{
    /// <summary>Provider implemented as first-party .NET code.</summary>
    Native,

    /// <summary>Provider launched as a separate JSON stdin/stdout process.</summary>
    ExternalProcess,

    /// <summary>Provider that adapts a Stash-compatible source during import or migration.</summary>
    StashCompat
}

/// <summary>
/// Codec for provider runtime shape codes.
/// </summary>
public sealed class ProviderTypeCodec : EnumCodec<ProviderType>
{
    public ProviderTypeCodec()
        : base(new Dictionary<ProviderType, string>
        {
            [ProviderType.Native] = "native",
            [ProviderType.ExternalProcess] = "external-process",
            [ProviderType.StashCompat] = "stash-compat"
        })
    {
    }
}
