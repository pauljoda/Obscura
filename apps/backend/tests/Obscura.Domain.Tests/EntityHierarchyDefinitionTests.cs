using Obscura.Domain.Entities;

namespace Obscura.Domain.Tests;

public sealed class EntityHierarchyDefinitionTests
{
    [Fact]
    public void StructuralEntityKindsAreRegistered()
    {
        var kinds = EntityKindRegistry.All.Select(kind => kind.Code).ToHashSet(StringComparer.OrdinalIgnoreCase);

        Assert.Contains("video-season", kinds);
        Assert.Contains("book-volume", kinds);
        Assert.Contains("book-chapter", kinds);
        Assert.Contains("book-page", kinds);
    }

    [Fact]
    public void SemanticHierarchyRelationshipsAreRegisteredWithoutDuplicateCodes()
    {
        Assert.Equal("season", EntityRelationshipRegistry.Season.Code);
        Assert.Equal("episode", EntityRelationshipRegistry.Episode.Code);
        Assert.Equal("gallery", EntityRelationshipRegistry.Gallery.Code);
        Assert.Equal("audio-library", EntityRelationshipRegistry.AudioLibrary.Code);
        Assert.Equal("volume", EntityRelationshipRegistry.Volume.Code);
        Assert.Equal("chapter", EntityRelationshipRegistry.Chapter.Code);
        Assert.Equal("page", EntityRelationshipRegistry.Page.Code);
        Assert.Equal("tag", EntityRelationshipRegistry.Tag.Code);
        Assert.Equal("studio", EntityRelationshipRegistry.Studio.Code);

        Assert.DoesNotContain(EntityRelationshipRegistry.All, relationship =>
            relationship.Code.StartsWith("nested-", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(EntityRelationshipRegistry.All, relationship =>
            relationship.Code is "gallery-image" or "image");
        Assert.DoesNotContain(EntityRelationshipRegistry.All, relationship =>
            relationship.Code == "audio-track");

        var duplicateCodes = EntityRelationshipRegistry.All
            .GroupBy(relationship => relationship.Code, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToArray();

        Assert.Empty(duplicateCodes);
    }

    [Fact]
    public void HierarchyDefinitionsDescribeSeriesAndBookLayerPaths()
    {
        var series = EntityHierarchyDefinitions.Require(EntityKindRegistry.VideoSeries);
        Assert.Contains(series.Layers, layer =>
            layer.RootKind == EntityKindRegistry.VideoSeries &&
            layer.ParentKind == EntityKindRegistry.VideoSeries &&
            layer.ChildKind == EntityKindRegistry.VideoSeason &&
            layer.Relationship == EntityRelationshipRegistry.Season);
        Assert.Contains(series.Layers, layer =>
            layer.RootKind == EntityKindRegistry.VideoSeries &&
            layer.ParentKind == EntityKindRegistry.VideoSeason &&
            layer.ChildKind == EntityKindRegistry.Video &&
            layer.Relationship == EntityRelationshipRegistry.Episode);
        Assert.Contains(series.Layers, layer =>
            layer.RootKind == EntityKindRegistry.VideoSeries &&
            layer.ParentKind == EntityKindRegistry.VideoSeries &&
            layer.ChildKind == EntityKindRegistry.Video &&
            layer.Relationship == EntityRelationshipRegistry.Episode);

        var book = EntityHierarchyDefinitions.Require(EntityKindRegistry.Book);
        Assert.Contains(book.Layers, layer =>
            layer.RootKind == EntityKindRegistry.Book &&
            layer.ParentKind == EntityKindRegistry.Book &&
            layer.ChildKind == EntityKindRegistry.BookVolume &&
            layer.Relationship == EntityRelationshipRegistry.Volume);
        Assert.Contains(book.Layers, layer =>
            layer.RootKind == EntityKindRegistry.Book &&
            layer.ParentKind == EntityKindRegistry.BookVolume &&
            layer.ChildKind == EntityKindRegistry.BookChapter &&
            layer.Relationship == EntityRelationshipRegistry.Chapter);
        Assert.Contains(book.Layers, layer =>
            layer.RootKind == EntityKindRegistry.Book &&
            layer.ParentKind == EntityKindRegistry.Book &&
            layer.ChildKind == EntityKindRegistry.BookChapter &&
            layer.Relationship == EntityRelationshipRegistry.Chapter);
        Assert.Contains(book.Layers, layer =>
            layer.RootKind == EntityKindRegistry.Book &&
            layer.ParentKind == EntityKindRegistry.BookChapter &&
            layer.ChildKind == EntityKindRegistry.BookPage &&
            layer.Relationship == EntityRelationshipRegistry.Page);
    }

    [Fact]
    public void GalleryAndAudioLibraryRelationshipsCoverTheirChildShapes()
    {
        var gallery = EntityHierarchyDefinitions.Require(EntityKindRegistry.Gallery);
        Assert.Contains(gallery.Layers, layer =>
            layer.ParentKind == EntityKindRegistry.Gallery &&
            layer.ChildKind == EntityKindRegistry.Gallery &&
            layer.Relationship == EntityRelationshipRegistry.Gallery);
        Assert.Contains(gallery.Layers, layer =>
            layer.ParentKind == EntityKindRegistry.Gallery &&
            layer.ChildKind == EntityKindRegistry.Image &&
            layer.Relationship == EntityRelationshipRegistry.Gallery);

        var audio = EntityHierarchyDefinitions.Require(EntityKindRegistry.AudioLibrary);
        Assert.Contains(audio.Layers, layer =>
            layer.ParentKind == EntityKindRegistry.AudioLibrary &&
            layer.ChildKind == EntityKindRegistry.AudioLibrary &&
            layer.Relationship == EntityRelationshipRegistry.AudioLibrary);
        Assert.Contains(audio.Layers, layer =>
            layer.ParentKind == EntityKindRegistry.AudioLibrary &&
            layer.ChildKind == EntityKindRegistry.AudioTrack &&
            layer.Relationship == EntityRelationshipRegistry.AudioLibrary);
    }

    [Fact]
    public void DefinitionsValidateAllowedParentChildRelationships()
    {
        Assert.True(EntityHierarchyDefinitions.IsAllowed(
            EntityKindRegistry.Book,
            EntityKindRegistry.BookChapter,
            EntityRelationshipRegistry.Chapter));
        Assert.True(EntityHierarchyDefinitions.IsAllowed(
            EntityKindRegistry.VideoSeason,
            EntityKindRegistry.Video,
            EntityRelationshipRegistry.Episode));

        Assert.False(EntityHierarchyDefinitions.IsAllowed(
            EntityKindRegistry.BookPage,
            EntityKindRegistry.BookChapter,
            EntityRelationshipRegistry.Chapter));
        Assert.False(EntityHierarchyDefinitions.IsAllowed(
            EntityKindRegistry.Collection,
            EntityKindRegistry.Video,
            EntityRelationshipRegistry.CollectionItem));
    }
}
