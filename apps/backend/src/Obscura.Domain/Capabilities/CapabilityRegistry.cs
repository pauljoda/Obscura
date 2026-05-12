namespace Obscura.Domain.Capabilities;

/// <summary>
/// Discovers and exposes code-defined entity capability kinds.
/// </summary>
public static class CapabilityRegistry
{
    private static readonly Lazy<IReadOnlyList<ICapabilityKind>> DiscoveredCapabilities = new(DiscoverCapabilities);

    private static readonly Lazy<IReadOnlyDictionary<string, ICapabilityKind>> ByCode = new(() => All.ToDictionary(
        capability => capability.Code,
        StringComparer.OrdinalIgnoreCase));

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
    public static IReadOnlyList<ICapabilityKind> All => DiscoveredCapabilities.Value;

    /// <summary>
    /// Looks up a capability kind by stable code.
    /// </summary>
    /// <param name="code">Capability code from storage, API input, or a discriminator.</param>
    /// <param name="capability">The matched capability kind when the method returns true.</param>
    /// <returns>True when the code is known; otherwise false.</returns>
    public static bool TryGet(string? code, out ICapabilityKind capability)
    {
        if (code is not null && ByCode.Value.TryGetValue(code, out var match))
        {
            capability = match;
            return true;
        }

        capability = default!;
        return false;
    }

    /// <summary>
    /// Looks up a capability kind by code and fails when the code is unknown.
    /// </summary>
    /// <param name="code">Capability code from storage, API input, or a discriminator.</param>
    /// <returns>The registered capability kind.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the capability code is not registered.</exception>
    public static ICapabilityKind Require(string code)
    {
        if (TryGet(code, out var capability))
        {
            return capability;
        }

        throw new InvalidOperationException($"Unknown capability code '{code}'. Add an {nameof(ICapabilityKind)} implementation before using it.");
    }

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

    private static IReadOnlyList<ICapabilityKind> DiscoverCapabilities() =>
        typeof(CapabilityRegistry)
            .Assembly
            .GetTypes()
            .Where(type =>
                !type.IsAbstract &&
                !type.IsInterface &&
                typeof(ICapabilityKind).IsAssignableFrom(type) &&
                type.GetConstructor(Type.EmptyTypes) is not null)
            .Select(type => (ICapabilityKind)Activator.CreateInstance(type)!)
            .OrderBy(capability => capability.Code, StringComparer.Ordinal)
            .ToArray();
}
