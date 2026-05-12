using System.Reflection;

namespace Obscura.Domain.Registries;

/// <summary>
/// Base implementation for registries keyed by stable lowercase domain codes.
/// </summary>
/// <typeparam name="TItem">Contract implemented by each discovered registry value.</typeparam>
public abstract class CodeRegistry<TItem> : DiscoveredRegistry<TItem, string>
{
    private readonly Func<TItem, string> _codeSelector;
    private readonly string _itemName;
    private readonly string _implementationName;

    /// <summary>
    /// Creates a code registry that discovers values from the supplied assembly.
    /// </summary>
    /// <param name="assembly">Assembly containing registry value implementations.</param>
    /// <param name="codeSelector">Function that reads the stable code from each item.</param>
    /// <param name="itemName">Human-readable registry item name used in diagnostics.</param>
    /// <param name="implementationName">Implementation contract name used in diagnostics.</param>
    protected CodeRegistry(
        Assembly assembly,
        Func<TItem, string> codeSelector,
        string itemName,
        string implementationName)
        : base(assembly, codeSelector, StringComparer.OrdinalIgnoreCase)
    {
        _codeSelector = codeSelector;
        _itemName = itemName;
        _implementationName = implementationName;
    }

    /// <summary>
    /// Attempts to look up an item by stable code.
    /// </summary>
    /// <param name="code">Stable code from storage, an API contract, or a route.</param>
    /// <param name="item">The registered item when the method returns true.</param>
    /// <returns><see langword="true" /> when the code is registered; otherwise <see langword="false" />.</returns>
    protected bool TryGetCode(string? code, out TItem item)
    {
        if (code is not null && TryGetItem(code, out item))
        {
            return true;
        }

        item = default!;
        return false;
    }

    /// <summary>
    /// Looks up an item by stable code and fails when the code is unknown.
    /// </summary>
    /// <param name="code">Stable code from storage, an API contract, or a route.</param>
    /// <returns>The registered item.</returns>
    protected TItem RequireCode(string code) =>
        RequireItem(code, missingCode =>
            $"Unknown {_itemName} code '{missingCode}'. Add an {_implementationName} implementation before using it.");

    /// <inheritdoc />
    protected override IEnumerable<TItem> OrderItems(IEnumerable<TItem> items) =>
        items.OrderBy(_codeSelector, StringComparer.Ordinal);
}
