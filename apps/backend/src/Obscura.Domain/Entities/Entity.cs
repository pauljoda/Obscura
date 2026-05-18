using Obscura.Domain.Capabilities;

namespace Obscura.Domain.Entities;

/// <summary>
/// Abstract root for anything Obscura can display, organize, rate, tag, or relate to other objects.
/// </summary>
public abstract class Entity {
    private readonly List<EntityCapability> _capabilities = [];
    private readonly List<EntityChild> _children = [];
    private readonly List<EntityRelationship> _relationships = [];

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
        IEnumerable<EntityChild>? children = null,
        IEnumerable<EntityRelationship>? relationships = null,
        Guid? parentEntityId = null,
        int? sortOrder = null) {
        Id = id;
        Title = string.IsNullOrWhiteSpace(title)
            ? throw new ArgumentException("Entity title cannot be empty.", nameof(title))
            : title;
        ParentEntityId = parentEntityId;
        SortOrder = sortOrder;

        foreach (var capability in capabilities ?? []) {
            AddCapability(capability);
        }

        foreach (var child in children ?? []) {
            AddChild(child.Entity, child.Role, child.SortOrder);
        }

        foreach (var relationship in relationships ?? []) {
            AddRelationship(relationship.Entity, relationship.Role, relationship.SortOrder);
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

    /// <summary>Structural child relationships in insertion order.</summary>
    public IReadOnlyList<EntityChild> Children => _children;

    /// <summary>Structural child entities in insertion order.</summary>
    public IReadOnlyList<Entity> ChildEntities => _children.Select(child => child.Entity).ToArray();

    /// <summary>Non-structural relationships in insertion order.</summary>
    public IReadOnlyList<EntityRelationship> Relationships => _relationships;

    /// <summary>User rating capability when attached.</summary>
    public CapabilityRating? Rating => GetCapability<CapabilityRating>();

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

    /// <summary>Marker capability when attached.</summary>
    public CapabilityMarkers? MarkerCapability => GetCapability<CapabilityMarkers>();

    /// <summary>Subtitle capability when attached.</summary>
    public CapabilitySubtitles? SubtitleCapability => GetCapability<CapabilitySubtitles>();

    /// <summary>Playback state when playback capability is attached.</summary>
    public Playback? Playback => GetCapability<CapabilityPlayback>()?.Value;

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
    /// <param name="role">Relationship role.</param>
    /// <param name="sortOrder">Optional child order.</param>
    public void AddChild(Entity child, ChildRole role = ChildRole.Structural, int? sortOrder = null) {
        ArgumentNullException.ThrowIfNull(child);
        if (_children.Any(existing => existing.Entity.Id == child.Id)) {
            throw new ArgumentException($"Entity '{Id}' already has child '{child.Id}'.", nameof(child));
        }

        child.ParentEntityId = Id;
        child.SortOrder = sortOrder;
        _children.Add(new EntityChild(child, role, sortOrder));
    }

    /// <summary>
    /// Gets structural children by concrete entity type.
    /// </summary>
    /// <typeparam name="TEntity">Concrete child type to retrieve.</typeparam>
    /// <returns>Matching child entities in insertion order.</returns>
    public IReadOnlyList<TEntity> ChildrenOf<TEntity>()
        where TEntity : Entity =>
        _children.Select(child => child.Entity).OfType<TEntity>().ToArray();

    /// <summary>
    /// Gets structural children by entity kind.
    /// </summary>
    /// <param name="kind">Entity kind to retrieve.</param>
    /// <returns>Matching child entities in insertion order.</returns>
    public IReadOnlyList<Entity> ChildrenOf(EntityKind kind) =>
        _children
            .Where(child => child.Entity.Kind == kind)
            .Select(child => child.Entity)
            .ToArray();

    /// <summary>
    /// Adds a non-structural relationship.
    /// </summary>
    /// <param name="entity">Related entity.</param>
    /// <param name="role">Relationship role.</param>
    /// <param name="sortOrder">Optional display order.</param>
    public void AddRelationship(Entity entity, RelationshipRole role, int? sortOrder = null) {
        ArgumentNullException.ThrowIfNull(entity);
        _relationships.Add(new EntityRelationship(entity, role, sortOrder));
    }
}
