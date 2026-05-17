using System.Diagnostics.CodeAnalysis;
using Obscura.Domain.Capabilities;

namespace Obscura.Domain.Entities;

/// <summary>
/// The root object for anything Obscura can display, organize, rate, tag, or relate to other objects.
/// </summary>
public record Entity
{
    /// <summary>
    /// Creates a global entity root with a modular list of supported capabilities.
    /// </summary>
    /// <param name="id">Stable global entity identifier.</param>
    /// <param name="kind">Code-defined entity kind that determines broad behavior and routing.</param>
    /// <param name="title">Primary user-facing title.</param>
    /// <param name="capabilities">Reusable behaviors and projections attached to this entity.</param>
    /// <exception cref="ArgumentException">Thrown when more than one capability has the same kind code.</exception>
    public Entity(
        Guid id,
        IEntityKind kind,
        string title,
        IReadOnlyList<ICapability> capabilities,
        Guid? parentEntityId = null,
        int? sortOrder = null,
        EntityChildren? children = null)
    {
        Id = id;
        Kind = kind;
        Title = title;
        Capabilities = NormalizeCapabilities(capabilities);
        ParentEntityId = parentEntityId;
        SortOrder = sortOrder;
        ChildrenByKind = children ?? EntityChildren.Empty;
    }

    /// <summary>Stable global entity identifier.</summary>
    public Guid Id { get; init; }

    /// <summary>Code-defined entity kind that determines broad behavior and routing.</summary>
    public IEntityKind Kind { get; init; }

    /// <summary>Primary user-facing title.</summary>
    public string Title { get; init; }

    /// <summary>Reusable behaviors and projections attached to this entity.</summary>
    public IReadOnlyList<ICapability> Capabilities { get; init; }

    /// <summary>Structural parent entity identifier when this entity is owned by another entity.</summary>
    public Guid? ParentEntityId { get; init; }

    /// <summary>Optional structural order under the parent entity.</summary>
    public int? SortOrder { get; init; }

    /// <summary>Grouped child projections keyed by entity kind through typed accessors.</summary>
    public EntityChildren ChildrenByKind { get; init; }

    /// <summary>Description text when supported by this entity.</summary>
    public string? Description => TryGetCapability(CapabilityRegistry.Description, out var capability) ? capability.Value : null;

    /// <summary>Images capability when supported by this entity.</summary>
    public CapabilityImages? Images => TryGetCapability(CapabilityRegistry.Images, out var capability) ? capability : null;

    /// <summary>Files capability when supported by this entity.</summary>
    public CapabilityFiles? Files => TryGetCapability(CapabilityRegistry.Files, out var capability) ? capability : null;

    /// <summary>Stats capability when supported by this entity.</summary>
    public CapabilityStats? Stats => TryGetCapability(CapabilityRegistry.Stats, out var capability) ? capability : null;

    /// <summary>Dates capability when supported by this entity.</summary>
    public CapabilityDates? Dates => TryGetCapability(CapabilityRegistry.Dates, out var capability) ? capability : null;

    /// <summary>Lifetime capability when supported by this entity.</summary>
    public CapabilityLifetime? Lifetime => TryGetCapability(CapabilityRegistry.Lifetime, out var capability) ? capability : null;

    /// <summary>Technical metadata capability when supported by this entity.</summary>
    public CapabilityTechnical? Technical => TryGetCapability(CapabilityRegistry.Technical, out var capability) ? capability : null;

    /// <summary>Source provenance capability when supported by this entity.</summary>
    public CapabilitySource? Source => TryGetCapability(CapabilityRegistry.Source, out var capability) ? capability : null;

    /// <summary>Progress capability when supported by this entity.</summary>
    public CapabilityProgress? Progress => TryGetCapability(CapabilityRegistry.Progress, out var capability) ? capability : null;

    /// <summary>Position capability when supported by this entity.</summary>
    public CapabilityPosition? Position => TryGetCapability(CapabilityRegistry.Position, out var capability) ? capability : null;

    /// <summary>Classification capability when supported by this entity.</summary>
    public CapabilityClassification? Classification => TryGetCapability(CapabilityRegistry.Classification, out var capability) ? capability : null;

    /// <summary>Marker capability when supported by this entity.</summary>
    public CapabilityMarkers? MarkerCapability => TryGetCapability(CapabilityRegistry.Markers, out var capability) ? capability : null;

    /// <summary>Subtitle capability when supported by this entity.</summary>
    public CapabilitySubtitles? SubtitleCapability => TryGetCapability(CapabilityRegistry.Subtitles, out var capability) ? capability : null;

    /// <summary>Playback capability when supported by this entity.</summary>
    public CapabilityPlayback? PlaybackCapability => TryGetCapability(CapabilityRegistry.Playback, out var capability) ? capability : null;

    /// <summary>
    /// Checks whether this entity supports a capability kind.
    /// </summary>
    /// <param name="kind">Capability kind to look up.</param>
    /// <returns><see langword="true" /> when the entity includes the capability kind, even if the capability data is empty.</returns>
    public bool HasCapability(ICapabilityKind kind) =>
        Capabilities.Any(capability => string.Equals(
            capability.Kind.Code,
            kind.Code,
            StringComparison.OrdinalIgnoreCase));

    /// <summary>
    /// Gets a supported capability by kind.
    /// </summary>
    /// <typeparam name="TCapability">Concrete capability type represented by the kind.</typeparam>
    /// <param name="kind">Typed capability kind to retrieve.</param>
    /// <returns>The supported capability instance.</returns>
    /// <exception cref="InvalidOperationException">Thrown when this entity does not support the capability kind.</exception>
    public TCapability GetCapability<TCapability>(ICapabilityKind<TCapability> kind)
        where TCapability : class, ICapability
    {
        if (TryGetCapability(kind, out var capability))
        {
            return capability;
        }

        throw new InvalidOperationException($"Entity '{Id}' does not support capability '{kind.Code}'.");
    }

    /// <summary>
    /// Attempts to get a supported capability by kind.
    /// </summary>
    /// <typeparam name="TCapability">Concrete capability type represented by the kind.</typeparam>
    /// <param name="kind">Typed capability kind to retrieve.</param>
    /// <param name="capability">The supported capability when the method returns true.</param>
    /// <returns><see langword="true" /> when this entity supports the capability kind; otherwise <see langword="false" />.</returns>
    public bool TryGetCapability<TCapability>(
        ICapabilityKind<TCapability> kind,
        [NotNullWhen(true)] out TCapability? capability)
        where TCapability : class, ICapability
    {
        var match = Capabilities.FirstOrDefault(capability => string.Equals(
            capability.Kind.Code,
            kind.Code,
            StringComparison.OrdinalIgnoreCase));

        if (match is TCapability typed)
        {
            capability = typed;
            return true;
        }

        capability = null;
        return false;
    }

    /// <summary>
    /// Returns a copy of the entity with one explicit capability added or replaced by kind.
    /// </summary>
    /// <typeparam name="TCapability">Concrete capability type represented by the kind.</typeparam>
    /// <param name="kind">Capability kind to replace.</param>
    /// <param name="capability">Capability value to attach to the entity.</param>
    /// <returns>A new entity with the supplied capability in its explicit capability list.</returns>
    public Entity WithCapability<TCapability>(
        ICapabilityKind<TCapability> kind,
        TCapability capability)
        where TCapability : class, ICapability
    {
        ArgumentNullException.ThrowIfNull(kind);
        ArgumentNullException.ThrowIfNull(capability);

        var next = Capabilities
            .Where(existing => !string.Equals(
                existing.Kind.Code,
                kind.Code,
                StringComparison.OrdinalIgnoreCase))
            .Append(capability)
            .ToArray();

        return this with { Capabilities = next };
    }

    private static IReadOnlyList<ICapability> NormalizeCapabilities(IReadOnlyList<ICapability> capabilities)
    {
        ArgumentNullException.ThrowIfNull(capabilities);

        var duplicates = capabilities
            .GroupBy(capability => capability.Kind.Code, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToArray();
        if (duplicates.Length > 0)
        {
            throw new ArgumentException(
                $"Entity capabilities contain duplicate kind codes: {string.Join(", ", duplicates)}.",
                nameof(capabilities));
        }

        return capabilities.ToArray();
    }
}
