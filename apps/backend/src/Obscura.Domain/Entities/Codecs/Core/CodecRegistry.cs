using Obscura.Domain.Registries;

namespace Obscura.Domain.Entities;

/// <summary>
/// Discovers and exposes codecs for closed-set enum values.
/// </summary>
public sealed class CodecRegistry : AbstractRegistry<ICodec, Type> {
    private static readonly CodecRegistry Registry = new();

    private CodecRegistry()
        : base(typeof(CodecRegistry).Assembly, codec => codec.ValueType) {
    }

    /// <summary>
    /// Gets the codec for a closed-set enum type.
    /// </summary>
    /// <typeparam name="TValue">Enum value type to encode or decode.</typeparam>
    /// <returns>Registered codec for the enum type.</returns>
    public static ICodec<TValue> Get<TValue>()
        where TValue : struct, Enum {
        if (Registry.TryGetKey(typeof(TValue), out var codec) && codec is ICodec<TValue> typedCodec) {
            return typedCodec;
        }

        throw new InvalidOperationException($"No codec is registered for {typeof(TValue).Name}.");
    }
}
