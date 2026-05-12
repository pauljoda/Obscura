using Obscura.Domain.Entities;

namespace Obscura.Domain.Tests;

public sealed class EntityHierarchyDefinitionTests
{
    [Fact]
    public void StructuralEntityKindsAreRegistered()
    {
        var kinds = EntityKinds.All.Select(kind => kind.Value).ToHashSet();

        Assert.Contains(EntityKindCode.VideoSeason, kinds);
        Assert.Contains(EntityKindCode.BookVolume, kinds);
        Assert.Contains(EntityKindCode.BookChapter, kinds);
        Assert.Contains(EntityKindCode.BookPage, kinds);
    }

    [Fact]
    public void SemanticHierarchyRelationshipsAreRegisteredWithoutDuplicateCodes()
    {
        Assert.Equal("season", EntityRelationships.Season.Code);
        Assert.Equal("volume", EntityRelationships.Volume.Code);
        Assert.Equal("chapter", EntityRelationships.Chapter.Code);
        Assert.Equal("page", EntityRelationships.Page.Code);

        var duplicateCodes = EntityRelationships.All
            .GroupBy(relationship => relationship.Code, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToArray();

        Assert.Empty(duplicateCodes);
    }

    [Fact]
    public void HierarchyDefinitionsDescribeSeriesAndBookLayerPaths()
    {
        var series = EntityHierarchyDefinitions.Require(EntityKinds.VideoSeries);
        Assert.Contains(series.Layers, layer =>
            layer.ParentKind == EntityKinds.VideoSeries &&
            layer.ChildKind == EntityKinds.VideoSeason &&
            layer.Relationship == EntityRelationships.Season);
        Assert.Contains(series.Layers, layer =>
            layer.ParentKind == EntityKinds.VideoSeason &&
            layer.ChildKind == EntityKinds.Video &&
            layer.Relationship == EntityRelationships.Episode);
        Assert.Contains(series.Layers, layer =>
            layer.ParentKind == EntityKinds.VideoSeries &&
            layer.ChildKind == EntityKinds.Video &&
            layer.Relationship == EntityRelationships.Episode);

        var book = EntityHierarchyDefinitions.Require(EntityKinds.Book);
        Assert.Contains(book.Layers, layer =>
            layer.ParentKind == EntityKinds.Book &&
            layer.ChildKind == EntityKinds.BookVolume &&
            layer.Relationship == EntityRelationships.Volume);
        Assert.Contains(book.Layers, layer =>
            layer.ParentKind == EntityKinds.BookVolume &&
            layer.ChildKind == EntityKinds.BookChapter &&
            layer.Relationship == EntityRelationships.Chapter);
        Assert.Contains(book.Layers, layer =>
            layer.ParentKind == EntityKinds.Book &&
            layer.ChildKind == EntityKinds.BookChapter &&
            layer.Relationship == EntityRelationships.Chapter);
        Assert.Contains(book.Layers, layer =>
            layer.ParentKind == EntityKinds.BookChapter &&
            layer.ChildKind == EntityKinds.BookPage &&
            layer.Relationship == EntityRelationships.Page);
    }

    [Fact]
    public void DefinitionsValidateAllowedParentChildRelationships()
    {
        Assert.True(EntityHierarchyDefinitions.IsAllowed(
            EntityKinds.Book,
            EntityKinds.BookChapter,
            EntityRelationships.Chapter));
        Assert.True(EntityHierarchyDefinitions.IsAllowed(
            EntityKinds.VideoSeason,
            EntityKinds.Video,
            EntityRelationships.Episode));

        Assert.False(EntityHierarchyDefinitions.IsAllowed(
            EntityKinds.BookPage,
            EntityKinds.BookChapter,
            EntityRelationships.Chapter));
        Assert.False(EntityHierarchyDefinitions.IsAllowed(
            EntityKinds.Collection,
            EntityKinds.Video,
            EntityRelationships.CollectionItem));
    }
}
