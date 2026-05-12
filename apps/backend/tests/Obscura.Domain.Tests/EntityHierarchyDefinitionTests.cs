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
        Assert.Equal("gallery-image", EntityRelationshipRegistry.GalleryImage.Code);
        Assert.Equal("nested-gallery", EntityRelationshipRegistry.NestedGallery.Code);
        Assert.Equal("audio-track", EntityRelationshipRegistry.AudioTrack.Code);
        Assert.Equal("nested-audio-library", EntityRelationshipRegistry.NestedAudioLibrary.Code);
        Assert.Equal("volume", EntityRelationshipRegistry.Volume.Code);
        Assert.Equal("chapter", EntityRelationshipRegistry.Chapter.Code);
        Assert.Equal("page", EntityRelationshipRegistry.Page.Code);
        Assert.Equal("nested-tag", EntityRelationshipRegistry.NestedTag.Code);
        Assert.Equal("nested-studio", EntityRelationshipRegistry.NestedStudio.Code);

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
            layer.ParentKind == EntityKindRegistry.VideoSeries &&
            layer.ChildKind == EntityKindRegistry.VideoSeason &&
            layer.Relationship == EntityRelationshipRegistry.Season);
        Assert.Contains(series.Layers, layer =>
            layer.ParentKind == EntityKindRegistry.VideoSeason &&
            layer.ChildKind == EntityKindRegistry.Video &&
            layer.Relationship == EntityRelationshipRegistry.Episode);
        Assert.Contains(series.Layers, layer =>
            layer.ParentKind == EntityKindRegistry.VideoSeries &&
            layer.ChildKind == EntityKindRegistry.Video &&
            layer.Relationship == EntityRelationshipRegistry.Episode);

        var book = EntityHierarchyDefinitions.Require(EntityKindRegistry.Book);
        Assert.Contains(book.Layers, layer =>
            layer.ParentKind == EntityKindRegistry.Book &&
            layer.ChildKind == EntityKindRegistry.BookVolume &&
            layer.Relationship == EntityRelationshipRegistry.Volume);
        Assert.Contains(book.Layers, layer =>
            layer.ParentKind == EntityKindRegistry.BookVolume &&
            layer.ChildKind == EntityKindRegistry.BookChapter &&
            layer.Relationship == EntityRelationshipRegistry.Chapter);
        Assert.Contains(book.Layers, layer =>
            layer.ParentKind == EntityKindRegistry.Book &&
            layer.ChildKind == EntityKindRegistry.BookChapter &&
            layer.Relationship == EntityRelationshipRegistry.Chapter);
        Assert.Contains(book.Layers, layer =>
            layer.ParentKind == EntityKindRegistry.BookChapter &&
            layer.ChildKind == EntityKindRegistry.BookPage &&
            layer.Relationship == EntityRelationshipRegistry.Page);
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
