using System.Reflection;
using Obscura.Domain.Registries;

namespace Obscura.Domain.Capabilities;

/// <summary>
/// Discovers and exposes code-defined entity capability kinds.
/// </summary>
public sealed class CapabilityRegistry : AbstractRegistry<ICapabilityKind, string>
{
    private const string CapabilityKindPropertyName = "CapabilityKind";
    private static readonly CapabilityRegistry Registry = new();

    private CapabilityRegistry()
        : base(
            typeof(CapabilityRegistry).Assembly,
            capability => capability.Code,
            StringComparer.OrdinalIgnoreCase,
            capabilities => capabilities.OrderBy(capability => capability.Code, StringComparer.Ordinal))
    {
    }

    /// <summary>Known rating capability kind.</summary>
    public static ICapabilityKind<CapabilityRating> Rating => Require<CapabilityRating>("rating");

    /// <summary>Known tags capability kind.</summary>
    public static ICapabilityKind<CapabilityTags> Tags => Require<CapabilityTags>("tags");

    /// <summary>Known credits capability kind.</summary>
    public static ICapabilityKind<CapabilityCredits> Credits => Require<CapabilityCredits>("credits");

    /// <summary>Known studio capability kind.</summary>
    public static ICapabilityKind<CapabilityStudio> Studio => Require<CapabilityStudio>("studio");

    /// <summary>Known images capability kind.</summary>
    public static ICapabilityKind<CapabilityImages> Images => Require<CapabilityImages>("images");

    /// <summary>Known links capability kind.</summary>
    public static ICapabilityKind<CapabilityLinks> Links => Require<CapabilityLinks>("links");

    /// <summary>Known flags capability kind.</summary>
    public static ICapabilityKind<CapabilityFlags> Flags => Require<CapabilityFlags>("flags");

    /// <summary>Known files capability kind.</summary>
    public static ICapabilityKind<CapabilityFiles> Files => Require<CapabilityFiles>("files");

    /// <summary>
    /// Gets every known capability kind in deterministic registry order.
    /// </summary>
    public static IReadOnlyList<ICapabilityKind> All => Registry.Items;

    /// <summary>
    /// Looks up a capability kind by stable code.
    /// </summary>
    /// <param name="code">Capability code from storage, API input, or a discriminator.</param>
    /// <param name="capability">The matched capability kind when the method returns true.</param>
    /// <returns>True when the code is known; otherwise false.</returns>
    public static bool TryGet(string? code, out ICapabilityKind capability)
        => Registry.TryGetKey(code, out capability);

    /// <summary>
    /// Looks up a capability kind by code and fails when the code is unknown.
    /// </summary>
    /// <param name="code">Capability code from storage, API input, or a discriminator.</param>
    /// <returns>The registered capability kind.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the capability code is not registered.</exception>
    public static ICapabilityKind Require(string code)
        => Registry.RequireKey(code, missingCode =>
            $"Unknown capability code '{missingCode}'. Add an {nameof(ICapability)} implementation before using it.");

    private static ICapabilityKind<TCapability> Require<TCapability>(string code)
        where TCapability : class, ICapability
    {
        var capability = Require(code);
        if (capability is ICapabilityKind<TCapability> typedCapability)
        {
            return typedCapability;
        }

        throw new InvalidOperationException($"Capability code '{code}' is not registered for {typeof(TCapability).Name}.");
    }

    /// <inheritdoc />
    protected override bool IsDiscoverableType(Type type) =>
        !type.IsAbstract &&
        !type.IsInterface &&
        typeof(ICapability).IsAssignableFrom(type) &&
        type.GetInterfaces().Any(IsTypedCapabilityInterface);

    /// <inheritdoc />
    protected override ICapabilityKind CreateItem(Type type)
    {
        var property = type.GetProperty(CapabilityKindPropertyName, BindingFlags.Public | BindingFlags.Static);
        if (property?.GetValue(null) is not ICapabilityKind capability)
        {
            throw new InvalidOperationException($"{type.Name} must expose a public static {CapabilityKindPropertyName} property.");
        }

        if (capability.CapabilityType != type)
        {
            throw new InvalidOperationException($"{type.Name} registered capability kind for {capability.CapabilityType.Name}.");
        }

        return capability;
    }

    private static bool IsTypedCapabilityInterface(Type type) =>
        type.IsGenericType && type.GetGenericTypeDefinition() == typeof(ICapability<>);
}
