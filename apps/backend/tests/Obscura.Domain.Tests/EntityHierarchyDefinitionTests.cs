using Obscura.Domain.Entities;

namespace Obscura.Domain.Tests;

public sealed class EntityHierarchyDefinitionTests
{
    [Fact]
    public void StructuralEntityKindsAreRegistered()
    {
        var kinds = EntityKind.All.Select(kind => kind.Value).ToHashSet();

        Assert.Contains(EntityKindCode.VideoSeason, kinds);
        Assert.Contains(EntityKindCode.BookVolume, kinds);
        Assert.Contains(EntityKindCode.BookChapter, kinds);
        Assert.Contains(EntityKindCode.BookPage, kinds);
    }

    [Fact]
    public void SemanticHierarchyRelationshipsAreRegisteredWithoutDuplicateCodes()
    {
        Assert.Equal("season", EntityRelationship.Season.Code);
        Assert.Equal("volume", EntityRelationship.Volume.Code);
        Assert.Equal("chapter", EntityRelationship.Chapter.Code);
        Assert.Equal("page", EntityRelationship.Page.Code);

        var duplicateCodes = EntityRelationship.All
            .GroupBy(relationship => relationship.Code, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToArray();

        Assert.Empty(duplicateCodes);
    }

    [Fact]
    public void HierarchyDefinitionsDescribeSeriesAndBookLayerPaths()
    {
        var series = EntityHierarchyDefinitions.Require(EntityKind.VideoSeries);
        Assert.Contains(series.Layers, layer =>
            layer.ParentKind == EntityKind.VideoSeries &&
            layer.ChildKind == EntityKind.VideoSeason &&
            layer.Relationship == EntityRelationship.Season);
        Assert.Contains(series.Layers, layer =>
            layer.ParentKind == EntityKind.VideoSeason &&
            layer.ChildKind == EntityKind.Video &&
            layer.Relationship == EntityRelationship.Episode);
        Assert.Contains(series.Layers, layer =>
            layer.ParentKind == EntityKind.VideoSeries &&
            layer.ChildKind == EntityKind.Video &&
            layer.Relationship == EntityRelationship.Episode);

        var book = EntityHierarchyDefinitions.Require(EntityKind.Book);
        Assert.Contains(book.Layers, layer =>
            layer.ParentKind == EntityKind.Book &&
            layer.ChildKind == EntityKind.BookVolume &&
            layer.Relationship == EntityRelationship.Volume);
        Assert.Contains(book.Layers, layer =>
            layer.ParentKind == EntityKind.BookVolume &&
            layer.ChildKind == EntityKind.BookChapter &&
            layer.Relationship == EntityRelationship.Chapter);
        Assert.Contains(book.Layers, layer =>
            layer.ParentKind == EntityKind.Book &&
            layer.ChildKind == EntityKind.BookChapter &&
            layer.Relationship == EntityRelationship.Chapter);
        Assert.Contains(book.Layers, layer =>
            layer.ParentKind == EntityKind.BookChapter &&
            layer.ChildKind == EntityKind.BookPage &&
            layer.Relationship == EntityRelationship.Page);
    }

    [Fact]
    public void DefinitionsValidateAllowedParentChildRelationships()
    {
        Assert.True(EntityHierarchyDefinitions.IsAllowed(
            EntityKind.Book,
            EntityKind.BookChapter,
            EntityRelationship.Chapter));
        Assert.True(EntityHierarchyDefinitions.IsAllowed(
            EntityKind.VideoSeason,
            EntityKind.Video,
            EntityRelationship.Episode));

        Assert.False(EntityHierarchyDefinitions.IsAllowed(
            EntityKind.BookPage,
            EntityKind.BookChapter,
            EntityRelationship.Chapter));
        Assert.False(EntityHierarchyDefinitions.IsAllowed(
            EntityKind.Collection,
            EntityKind.Video,
            EntityRelationship.CollectionItem));
    }
}
