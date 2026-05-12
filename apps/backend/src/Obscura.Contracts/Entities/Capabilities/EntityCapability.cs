using System.Text.Json.Serialization;

namespace Obscura.Contracts.Entities;

/// <summary>
/// Base API contract for a modular entity capability.
/// </summary>
[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(RatingCapability), "rating")]
[JsonDerivedType(typeof(TagsCapability), "tags")]
[JsonDerivedType(typeof(CreditsCapability), "credits")]
[JsonDerivedType(typeof(StudioCapability), "studio")]
[JsonDerivedType(typeof(ImagesCapability), "images")]
[JsonDerivedType(typeof(DescriptionCapability), "description")]
[JsonDerivedType(typeof(LinksCapability), "links")]
[JsonDerivedType(typeof(FlagsCapability), "flags")]
[JsonDerivedType(typeof(FilesCapability), "files")]
[JsonDerivedType(typeof(CountersCapability), "counters")]
[JsonDerivedType(typeof(FingerprintsCapability), "fingerprints")]
public abstract record EntityCapability;
