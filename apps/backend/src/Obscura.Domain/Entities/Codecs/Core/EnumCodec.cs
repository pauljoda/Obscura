namespace Obscura.Domain.Entities;

/// <summary>
/// Base implementation for enum codecs backed by explicit value-to-code mappings.
/// </summary>
/// <typeparam name="TValue">Closed-set enum type handled by the codec.</typeparam>
public abstract class EnumCodec<TValue> : ICodec<TValue>
    where TValue : struct, Enum {
    private readonly IReadOnlyDictionary<TValue, string> _encode;
    private readonly IReadOnlyDictionary<string, TValue> _decode;

    /// <summary>
    /// Creates a codec from the supplied enum mappings.
    /// </summary>
    /// <param name="codes">Complete enum-to-code map for the closed set.</param>
    protected EnumCodec(IReadOnlyDictionary<TValue, string> codes) {
        _encode = codes;
        _decode = codes.ToDictionary(
            pair => Normalize(pair.Value),
            pair => pair.Key,
            StringComparer.OrdinalIgnoreCase);
    }

    /// <inheritdoc />
    public Type ValueType => typeof(TValue);

    /// <inheritdoc />
    public string Encode(TValue value) {
        if (_encode.TryGetValue(value, out var code)) {
            return code;
        }

        throw new ArgumentOutOfRangeException(nameof(value), value, $"Unsupported {typeof(TValue).Name} value.");
    }

    /// <inheritdoc />
    public TValue Decode(string code) {
        if (TryDecode(code, out var value)) {
            return value;
        }

        throw new ArgumentOutOfRangeException(nameof(code), code, $"Unsupported {typeof(TValue).Name} code.");
    }

    /// <inheritdoc />
    public bool TryDecode(string code, out TValue value) {
        if (string.IsNullOrWhiteSpace(code)) {
            value = default;
            return false;
        }

        return _decode.TryGetValue(Normalize(code), out value);
    }

    /// <inheritdoc />
    public string EncodeObject(object value) {
        if (value is TValue typedValue) {
            return Encode(typedValue);
        }

        throw new ArgumentException($"Expected {typeof(TValue).Name}.", nameof(value));
    }

    /// <inheritdoc />
    public object DecodeObject(string code) => Decode(code);

    private static string Normalize(string code) => code.Trim().ToLowerInvariant();
}
