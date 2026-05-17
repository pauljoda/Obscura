using System.Text.Json.Serialization;

namespace Obscura.Contracts.Entities;

/// <summary>
/// Base API contract for a modular entity capability.
/// </summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(RatingCapability), "rating")]
[JsonDerivedType(typeof(ImagesCapability), "images")]
[JsonDerivedType(typeof(DescriptionCapability), "description")]
[JsonDerivedType(typeof(LinksCapability), "links")]
[JsonDerivedType(typeof(FlagsCapability), "flags")]
[JsonDerivedType(typeof(FilesCapability), "files")]
[JsonDerivedType(typeof(CountersCapability), "counters")]
[JsonDerivedType(typeof(FingerprintsCapability), "fingerprints")]
[JsonDerivedType(typeof(MarkersCapability), "markers")]
[JsonDerivedType(typeof(SubtitlesCapability), "subtitles")]
[JsonDerivedType(typeof(StatsCapability), "stats")]
[JsonDerivedType(typeof(DatesCapability), "dates")]
[JsonDerivedType(typeof(LifetimeCapability), "lifetime")]
[JsonDerivedType(typeof(TechnicalCapability), "technical")]
[JsonDerivedType(typeof(SourceCapability), "source")]
[JsonDerivedType(typeof(ProgressCapability), "progress")]
[JsonDerivedType(typeof(PositionCapability), "position")]
[JsonDerivedType(typeof(ClassificationCapability), "classification")]
[JsonDerivedType(typeof(PlaybackCapability), "playback")]
public abstract record EntityCapability;
