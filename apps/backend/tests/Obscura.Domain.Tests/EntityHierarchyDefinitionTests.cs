using Obscura.Domain.Entities;

namespace Obscura.Domain.Tests;

public sealed class EntityHierarchyDefinitionTests
{
    [Fact]
    public void StructuralEntityKindsAreRegistered()
    {
        var kinds = IEntityKind.All.Select(kind => kind.Value).ToHashSet();

        Assert.Contains(EntityKindCode.VideoSeason, kinds);
        Assert.Contains(EntityKindCode.BookVolume, kinds);
        Assert.Contains(EntityKindCode.BookChapter, kinds);
        Assert.Contains(EntityKindCode.BookPage, kinds);
    }

    [Fact]
    public void SemanticHierarchyRelationshipsAreRegisteredWithoutDuplicateCodes()
    {
        Assert.Equal("season", IEntityRelationship.Season.Code);
        Assert.Equal("volume", IEntityRelationship.Volume.Code);
        Assert.Equal("chapter", IEntityRelationship.Chapter.Code);
        Assert.Equal("page", IEntityRelationship.Page.Code);

        var duplicateCodes = IEntityRelationship.All
            .GroupBy(relationship => relationship.Code, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToArray();

        Assert.Empty(duplicateCodes);
    }

    [Fact]
    public void HierarchyDefinitionsDescribeSeriesAndBookLayerPaths()
    {
        var series = EntityHierarchyDefinitions.Require(IEntityKind.VideoSeries);
        Assert.Contains(series.Layers, layer =>
            layer.ParentKind == IEntityKind.VideoSeries &&
            layer.ChildKind == IEntityKind.VideoSeason &&
            layer.Relationship == IEntityRelationship.Season);
        Assert.Contains(series.Layers, layer =>
            layer.ParentKind == IEntityKind.VideoSeason &&
            layer.ChildKind == IEntityKind.Video &&
            layer.Relationship == IEntityRelationship.Episode);
        Assert.Contains(series.Layers, layer =>
            layer.ParentKind == IEntityKind.VideoSeries &&
            layer.ChildKind == IEntityKind.Video &&
            layer.Relationship == IEntityRelationship.Episode);

        var book = EntityHierarchyDefinitions.Require(IEntityKind.Book);
        Assert.Contains(book.Layers, layer =>
            layer.ParentKind == IEntityKind.Book &&
            layer.ChildKind == IEntityKind.BookVolume &&
            layer.Relationship == IEntityRelationship.Volume);
        Assert.Contains(book.Layers, layer =>
            layer.ParentKind == IEntityKind.BookVolume &&
            layer.ChildKind == IEntityKind.BookChapter &&
            layer.Relationship == IEntityRelationship.Chapter);
        Assert.Contains(book.Layers, layer =>
            layer.ParentKind == IEntityKind.Book &&
            layer.ChildKind == IEntityKind.BookChapter &&
            layer.Relationship == IEntityRelationship.Chapter);
        Assert.Contains(book.Layers, layer =>
            layer.ParentKind == IEntityKind.BookChapter &&
            layer.ChildKind == IEntityKind.BookPage &&
            layer.Relationship == IEntityRelationship.Page);
    }

    [Fact]
    public void DefinitionsValidateAllowedParentChildRelationships()
    {
        Assert.True(EntityHierarchyDefinitions.IsAllowed(
            IEntityKind.Book,
            IEntityKind.BookChapter,
            IEntityRelationship.Chapter));
        Assert.True(EntityHierarchyDefinitions.IsAllowed(
            IEntityKind.VideoSeason,
            IEntityKind.Video,
            IEntityRelationship.Episode));

        Assert.False(EntityHierarchyDefinitions.IsAllowed(
            IEntityKind.BookPage,
            IEntityKind.BookChapter,
            IEntityRelationship.Chapter));
        Assert.False(EntityHierarchyDefinitions.IsAllowed(
            IEntityKind.Collection,
            IEntityKind.Video,
            IEntityRelationship.CollectionItem));
    }
}
