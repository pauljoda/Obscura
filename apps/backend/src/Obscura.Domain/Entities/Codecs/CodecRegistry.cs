using System.Reflection;

namespace Obscura.Domain.Entities;

/// <summary>
/// Discovers and exposes codecs for closed-set enum values.
/// </summary>
public static class CodecRegistry
{
    private static readonly Lazy<IReadOnlyDictionary<Type, ICodec>> DiscoveredCodecs = new(DiscoverCodecs);

    /// <summary>
    /// Gets the codec for a closed-set enum type.
    /// </summary>
    /// <typeparam name="TValue">Enum value type to encode or decode.</typeparam>
    /// <returns>Registered codec for the enum type.</returns>
    public static ICodec<TValue> Get<TValue>()
        where TValue : struct, Enum
    {
        if (DiscoveredCodecs.Value.TryGetValue(typeof(TValue), out var codec) && codec is ICodec<TValue> typedCodec)
        {
            return typedCodec;
        }

        throw new InvalidOperationException($"No codec is registered for {typeof(TValue).Name}.");
    }

    /// <summary>
    /// Encodes a closed-set enum value with its discovered codec.
    /// </summary>
    /// <typeparam name="TValue">Enum value type to encode.</typeparam>
    /// <param name="value">Enum value to encode.</param>
    /// <returns>Stable text code used by database rows and HTTP contracts.</returns>
    public static string ToCode<TValue>(this TValue value)
        where TValue : struct, Enum =>
        Get<TValue>().Encode(value);

    /// <summary>
    /// Decodes a stable text code with the codec registered for <typeparamref name="TValue" />.
    /// </summary>
    /// <typeparam name="TValue">Enum value type to decode.</typeparam>
    /// <param name="code">Text code from storage or API input.</param>
    /// <returns>Enum value represented by the code.</returns>
    public static TValue DecodeAs<TValue>(this string code)
        where TValue : struct, Enum =>
        Get<TValue>().Decode(code);

    /// <summary>
    /// Attempts to decode a stable text code with the codec registered for <typeparamref name="TValue" />.
    /// </summary>
    /// <typeparam name="TValue">Enum value type to decode.</typeparam>
    /// <param name="code">Text code from storage or API input.</param>
    /// <param name="value">Decoded enum value when the code is known.</param>
    /// <returns><see langword="true" /> when the code was recognized; otherwise <see langword="false" />.</returns>
    public static bool TryDecodeAs<TValue>(this string code, out TValue value)
        where TValue : struct, Enum =>
        Get<TValue>().TryDecode(code, out value);

    private static IReadOnlyDictionary<Type, ICodec> DiscoverCodecs()
    {
        var codecs = typeof(CodecRegistry)
            .Assembly
            .GetTypes()
            .Where(type =>
                !type.IsAbstract &&
                !type.IsInterface &&
                typeof(ICodec).IsAssignableFrom(type) &&
                type.GetConstructor(BindingFlags.Public | BindingFlags.Instance, Type.EmptyTypes) is not null)
            .Select(type => (ICodec)Activator.CreateInstance(type)!)
            .ToArray();

        return codecs.ToDictionary(codec => codec.ValueType);
    }
}
