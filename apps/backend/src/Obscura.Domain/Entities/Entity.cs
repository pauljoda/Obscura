using Obscura.Domain.Capabilities;

namespace Obscura.Domain.Entities;

/// <summary>
/// Abstract root for anything Obscura can display, organize, rate, tag, or relate to other objects.
/// </summary>
public abstract class Entity {
    private readonly List<EntityCapability> _capabilities = [];
    private readonly Dictionary<EntityKind, List<Entity>> _childrenByKind = [];
    private readonly Dictionary<EntityKind, List<Entity>> _relationshipsByKind = [];

    /// <summary>
    /// Creates an entity with optional capabilities, child relationships, and non-structural relationships.
    /// </summary>
    /// <param name="id">Stable entity identifier.</param>
    /// <param name="title">Primary user-facing title.</param>
    /// <param name="capabilities">Mutable behavior modules to attach to this entity.</param>
    /// <param name="children">Structural child relationships.</param>
    /// <param name="relationships">Non-structural relationships.</param>
    /// <param name="parentEntityId">Optional structural parent identifier.</param>
    /// <param name="sortOrder">Optional structural order under the parent.</param>
    protected Entity(
        Guid id,
        string title,
        IEnumerable<EntityCapability>? capabilities = null,
        IEnumerable<Entity>? children = null,
        IEnumerable<Entity>? relationships = null,
        Guid? parentEntityId = null,
        int? sortOrder = null) {
        Id = id;
        Title = string.IsNullOrWhiteSpace(title)
            ? throw new ArgumentException("Entity title cannot be empty.", nameof(title))
            : title;
        ParentEntityId = parentEntityId;
        SortOrder = sortOrder;

        foreach (var capability in capabilities ?? CreateDefaultCapabilities()) {
            AddCapability(capability);
        }

        foreach (var child in children ?? []) {
            AddChild(child);
        }

        foreach (var relationship in relationships ?? []) {
            AddRelationship(relationship);
        }
    }

    /// <summary>Stable entity identifier.</summary>
    public Guid Id { get; }

    /// <summary>Primary user-facing title.</summary>
    public string Title { get; private set; }

    /// <summary>Closed domain kind for this concrete entity.</summary>
    public abstract EntityKind Kind { get; }

    /// <summary>Structural parent entity identifier when this entity is owned by another entity.</summary>
    public Guid? ParentEntityId { get; private set; }

    /// <summary>Optional structural order under the parent entity.</summary>
    public int? SortOrder { get; private set; }

    /// <summary>Attached capabilities in insertion order.</summary>
    public IReadOnlyList<EntityCapability> Capabilities => _capabilities;

    /// <summary>Structural child entities grouped by their concrete entity kind.</summary>
    public IReadOnlyDictionary<EntityKind, IReadOnlyList<Entity>> ChildrenByKind => Snapshot(_childrenByKind);

    /// <summary>Structural child entities in insertion order.</summary>
    public IReadOnlyList<Entity> ChildEntities => _childrenByKind.Values.SelectMany(children => children).ToArray();

    /// <summary>Non-structural related entities grouped by their concrete entity kind.</summary>
    public IReadOnlyDictionary<EntityKind, IReadOnlyList<Entity>> RelationshipsByKind => Snapshot(_relationshipsByKind);

    /// <summary>Non-structural related entities in insertion order within each kind group.</summary>
    public IReadOnlyList<Entity> Relationships => _relationshipsByKind.Values.SelectMany(relationships => relationships).ToArray();

    /// <summary>User rating capability when attached.</summary>
    public CapabilityRating? Rating => GetCapability<CapabilityRating>();

    /// <summary>User-facing boolean flag capability when attached.</summary>
    public CapabilityFlags? Flags => GetCapability<CapabilityFlags>();

    /// <summary>Description capability when attached.</summary>
    public CapabilityDescription? Description => GetCapability<CapabilityDescription>();

    /// <summary>Image capability when attached.</summary>
    public CapabilityImages? Images => GetCapability<CapabilityImages>();

    /// <summary>File capability when attached.</summary>
    public CapabilityFiles? Files => GetCapability<CapabilityFiles>();

    /// <summary>Stats capability when attached.</summary>
    public CapabilityStats? Stats => GetCapability<CapabilityStats>();

    /// <summary>Dates capability when attached.</summary>
    public CapabilityDates? Dates => GetCapability<CapabilityDates>();

    /// <summary>Lifetime capability when attached.</summary>
    public CapabilityLifetime? Lifetime => GetCapability<CapabilityLifetime>();

    /// <summary>Technical metadata capability when attached.</summary>
    public CapabilityTechnical? Technical => GetCapability<CapabilityTechnical>();

    /// <summary>Source provenance capability when attached.</summary>
    public CapabilitySource? Source => GetCapability<CapabilitySource>();

    /// <summary>Progress capability when attached.</summary>
    public CapabilityProgress? Progress => GetCapability<CapabilityProgress>();

    /// <summary>Position capability when attached.</summary>
    public CapabilityPosition? Position => GetCapability<CapabilityPosition>();

    /// <summary>Classification capability when attached.</summary>
    public CapabilityClassification? Classification => GetCapability<CapabilityClassification>();

    /// <summary>Credits capability when attached.</summary>
    public CapabilityCredits? Credits => GetCapability<CapabilityCredits>();

    /// <summary>Marker capability when attached.</summary>
    public CapabilityMarkers? MarkerCapability => GetCapability<CapabilityMarkers>();

    /// <summary>Playback capability when attached.</summary>
    public CapabilityPlayback? PlaybackCapability => GetCapability<CapabilityPlayback>();

    /// <summary>Subtitle capability when attached.</summary>
    public CapabilitySubtitles? SubtitleCapability => GetCapability<CapabilitySubtitles>();

    /// <summary>Playback state when playback capability is attached.</summary>
    public Playback? Playback => PlaybackCapability?.Value;

    /// <summary>
    /// Updates the title while preserving entity identity.
    /// </summary>
    /// <param name="title">New non-empty title.</param>
    public void Rename(string title) {
        Title = string.IsNullOrWhiteSpace(title)
            ? throw new ArgumentException("Entity title cannot be empty.", nameof(title))
            : title;
    }

    /// <summary>
    /// Creates fresh default capabilities for this concrete entity type.
    /// Implementations must not read derived instance state because this method is called from the base constructor.
    /// </summary>
    /// <returns>Fresh capability instances for a new entity.</returns>
    protected abstract IEnumerable<EntityCapability> CreateDefaultCapabilities();

    /// <summary>
    /// Gets an attached capability by concrete type.
    /// </summary>
    /// <typeparam name="TCapability">Concrete capability type to retrieve.</typeparam>
    /// <returns>The attached capability instance, or null when missing.</returns>
    public TCapability? GetCapability<TCapability>()
        where TCapability : EntityCapability =>
        _capabilities.OfType<TCapability>().SingleOrDefault();

    /// <summary>
    /// Gets an attached capability by concrete type or throws when missing.
    /// </summary>
    /// <typeparam name="TCapability">Concrete capability type to retrieve.</typeparam>
    /// <returns>The attached capability instance.</returns>
    public TCapability RequireCapability<TCapability>()
        where TCapability : EntityCapability =>
        GetCapability<TCapability>()
            ?? throw new InvalidOperationException($"Entity '{Id}' does not have capability '{typeof(TCapability).Name}'.");

    /// <summary>
    /// Checks whether a concrete capability type is attached.
    /// </summary>
    /// <typeparam name="TCapability">Concrete capability type to check.</typeparam>
    /// <returns>True when the capability is attached; otherwise false.</returns>
    public bool HasCapability<TCapability>()
        where TCapability : EntityCapability =>
        GetCapability<TCapability>() is not null;

    /// <summary>
    /// Attaches a capability instance to this entity.
    /// </summary>
    /// <param name="capability">Capability instance to attach.</param>
    /// <exception cref="ArgumentException">Thrown when this entity already has a capability of the same kind.</exception>
    public void AddCapability(EntityCapability capability) {
        ArgumentNullException.ThrowIfNull(capability);
        if (_capabilities.Any(existing => existing.Kind == capability.Kind)) {
            throw new ArgumentException($"Entity '{Id}' already has capability {capability.Kind}.", nameof(capability));
        }

        capability.AttachTo(this);
        _capabilities.Add(capability);
    }

    /// <summary>
    /// Removes a capability by concrete type and detaches it from this entity.
    /// </summary>
    /// <typeparam name="TCapability">Concrete capability type to remove.</typeparam>
    /// <returns>True when a capability was removed; otherwise false.</returns>
    public bool RemoveCapability<TCapability>()
        where TCapability : EntityCapability {
        var capability = GetCapability<TCapability>();
        if (capability is null) {
            return false;
        }

        capability.DetachFrom(this);
        return _capabilities.Remove(capability);
    }

    /// <summary>
    /// Adds a structural child relationship.
    /// </summary>
    /// <param name="child">Child entity.</param>
    /// <param name="sortOrder">Optional child order.</param>
    public void AddChild(Entity child, int? sortOrder = null) {
        ArgumentNullException.ThrowIfNull(child);
        if (_childrenByKind.Values.SelectMany(children => children).Any(existing => existing.Id == child.Id)) {
            throw new ArgumentException($"Entity '{Id}' already has child '{child.Id}'.", nameof(child));
        }

        child.ParentEntityId = Id;
        child.SortOrder = sortOrder;
        AddToKindMap(_childrenByKind, child);
    }

    /// <summary>
    /// Gets structural children by concrete entity type.
    /// </summary>
    /// <typeparam name="TEntity">Concrete child type to retrieve.</typeparam>
    /// <returns>Matching child entities in insertion order.</returns>
    public IReadOnlyList<TEntity> ChildrenOf<TEntity>()
        where TEntity : Entity =>
        ChildrenOf(EntityKindCatalog.Require(typeof(TEntity))).OfType<TEntity>().ToArray();

    /// <summary>
    /// Gets structural children by entity kind.
    /// </summary>
    /// <param name="kind">Entity kind to retrieve.</param>
    /// <returns>Matching child entities in insertion order.</returns>
    public IReadOnlyList<Entity> ChildrenOf(EntityKind kind) =>
        _childrenByKind.TryGetValue(kind, out var children)
            ? children.ToArray()
            : [];

    /// <summary>
    /// Adds a non-structural relationship.
    /// </summary>
    /// <param name="entity">Related entity.</param>
    public void AddRelationship(Entity entity) {
        ArgumentNullException.ThrowIfNull(entity);
        if (_relationshipsByKind.Values.SelectMany(relationships => relationships).Any(existing => existing.Id == entity.Id)) {
            throw new ArgumentException($"Entity '{Id}' already has relationship '{entity.Id}'.", nameof(entity));
        }

        AddToKindMap(_relationshipsByKind, entity);
    }

    /// <summary>
    /// Gets non-structural relationships by concrete entity type.
    /// </summary>
    /// <typeparam name="TEntity">Concrete relationship type to retrieve.</typeparam>
    /// <returns>Matching related entities in insertion order.</returns>
    public IReadOnlyList<TEntity> RelationshipsOf<TEntity>()
        where TEntity : Entity =>
        RelationshipsOf(EntityKindCatalog.Require(typeof(TEntity))).OfType<TEntity>().ToArray();

    /// <summary>
    /// Gets non-structural relationships by entity kind.
    /// </summary>
    /// <param name="kind">Entity kind to retrieve.</param>
    /// <returns>Matching related entities in insertion order.</returns>
    public IReadOnlyList<Entity> RelationshipsOf(EntityKind kind) =>
        _relationshipsByKind.TryGetValue(kind, out var relationships)
            ? relationships.ToArray()
            : [];

    private static void AddToKindMap(Dictionary<EntityKind, List<Entity>> map, Entity entity) {
        if (!map.TryGetValue(entity.Kind, out var bucket)) {
            bucket = [];
            map.Add(entity.Kind, bucket);
        }

        bucket.Add(entity);
    }

    private static IReadOnlyDictionary<EntityKind, IReadOnlyList<Entity>> Snapshot(Dictionary<EntityKind, List<Entity>> map) =>
        map.ToDictionary(
            pair => pair.Key,
            pair => (IReadOnlyList<Entity>)pair.Value.ToArray());
}
