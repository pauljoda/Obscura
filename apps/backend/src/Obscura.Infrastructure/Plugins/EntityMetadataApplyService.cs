using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Obscura.Contracts.Plugins;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Plugins;

/// <summary>
/// Filesystem settings for artwork downloaded while applying plugin metadata.
/// </summary>
/// <param name="CacheRoot">Physical cache root served by the API under /assets.</param>
public sealed record PluginArtworkServiceOptions(string CacheRoot);

/// <summary>
/// Applies selected plugin metadata proposals into v2 entity capability rows.
/// </summary>
public sealed class EntityMetadataApplyService
{
    private readonly ObscuraDbContext _db;
    private readonly PluginArtworkServiceOptions _options;
    private readonly HttpClient _http;

    /// <summary>
    /// Creates an apply service over EF Core rows and optional artwork downloading.
    /// </summary>
    /// <param name="db">Database context that owns entity capability tables.</param>
    /// <param name="options">Filesystem settings for downloaded artwork.</param>
    /// <param name="http">Optional HTTP client for tests or configured hosts.</param>
    public EntityMetadataApplyService(
        ObscuraDbContext db,
        PluginArtworkServiceOptions options,
        HttpClient? http = null)
    {
        _db = db;
        _options = options;
        _http = http ?? new HttpClient();
    }

    /// <summary>
    /// Applies selected fields from a proposal to an existing entity.
    /// </summary>
    /// <param name="entityId">Entity receiving metadata.</param>
    /// <param name="proposal">Plugin proposal chosen by the user.</param>
    /// <param name="selectedFields">Field keys selected in the review UI.</param>
    /// <param name="selectedImages">Optional role-to-remote-URL artwork selections.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>True when the entity exists and was updated.</returns>
    public async Task<bool> ApplyAsync(
        Guid entityId,
        EntityMetadataProposal proposal,
        IReadOnlyCollection<string> selectedFields,
        IReadOnlyDictionary<string, string?>? selectedImages,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(proposal);
        ArgumentNullException.ThrowIfNull(selectedFields);

        var entity = await _db.Entities
            .FirstOrDefaultAsync(row => row.Id == entityId && row.DeletedAt == null, cancellationToken);
        if (entity is null)
        {
            return false;
        }

        var selected = selectedFields.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var patch = proposal.Patch;
        var now = DateTimeOffset.UtcNow;

        if (selected.Contains("title") && !string.IsNullOrWhiteSpace(patch.Title))
        {
            entity.Title = patch.Title.Trim();
        }

        if (selected.Contains("description"))
        {
            await UpsertDescriptionAsync(entityId, patch.Description, now, cancellationToken);
        }

        if (selected.Contains("externalIds"))
        {
            await UpsertExternalIdsAsync(entityId, patch.ExternalIds, patch.Urls, now, cancellationToken);
        }

        if (selected.Contains("urls"))
        {
            await UpsertUrlsAsync(entityId, patch.Urls, now, cancellationToken);
        }

        if (selected.Contains("tags"))
        {
            await ReplaceTagsAsync(entityId, patch.Tags, now, cancellationToken);
        }

        if (selected.Contains("studio") && !string.IsNullOrWhiteSpace(patch.Studio))
        {
            await SetStudioAsync(entityId, patch.Studio, now, cancellationToken);
        }

        if (selected.Contains("credits"))
        {
            await ReplaceCreditsAsync(entityId, patch.Credits, now, cancellationToken);
        }

        if (selected.Contains("dates"))
        {
            await UpsertDatesAsync(entityId, patch.Dates, now, cancellationToken);
        }

        if (selected.Contains("counters"))
        {
            await UpsertCountersAsync(entityId, patch.Counters, now, cancellationToken);
        }

        if (selected.Contains("stats"))
        {
            await UpsertStatsAsync(entityId, patch.Stats, now, cancellationToken);
        }

        if (selected.Contains("positions"))
        {
            await UpsertPositionsAsync(entityId, patch.Positions, now, cancellationToken);
        }

        if (selected.Contains("classification"))
        {
            await UpsertClassificationAsync(entityId, patch.Classification, now, cancellationToken);
        }

        if (selected.Contains("images") && selectedImages is not null)
        {
            await DownloadSelectedImagesAsync(entityId, selectedImages, now, cancellationToken);
        }

        if (proposal.Children.Count > 0 && (selected.Contains("credits") || selected.Contains("studio")))
        {
            await CascadeChildImagesAsync(proposal.Children, now, cancellationToken);
        }

        entity.UpdatedAt = now;
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private async Task UpsertDescriptionAsync(Guid entityId, string? value, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var existing = await _db.EntityDescriptions.FindAsync([entityId], cancellationToken);
        if (string.IsNullOrWhiteSpace(value))
        {
            if (existing is not null)
            {
                _db.EntityDescriptions.Remove(existing);
            }
            return;
        }

        if (existing is null)
        {
            _db.EntityDescriptions.Add(new EntityDescriptionRow { EntityId = entityId, Value = value.Trim(), UpdatedAt = now });
        }
        else
        {
            existing.Value = value.Trim();
            existing.UpdatedAt = now;
        }
    }

    private async Task UpsertExternalIdsAsync(
        Guid entityId,
        IReadOnlyDictionary<string, string> externalIds,
        IReadOnlyList<string> urls,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        foreach (var (provider, rawValue) in externalIds)
        {
            if (string.IsNullOrWhiteSpace(provider) || string.IsNullOrWhiteSpace(rawValue))
            {
                continue;
            }

            var existing = await _db.EntityExternalIds
                .FirstOrDefaultAsync(row => row.EntityId == entityId && row.Provider == provider, cancellationToken);
            var url = urls.FirstOrDefault(candidate => candidate.Contains(rawValue, StringComparison.OrdinalIgnoreCase));
            if (existing is null)
            {
                _db.EntityExternalIds.Add(new EntityExternalIdRow
                {
                    Id = Guid.NewGuid(),
                    EntityId = entityId,
                    Provider = provider.Trim(),
                    Value = rawValue.Trim(),
                    Url = url,
                    CreatedAt = now,
                    UpdatedAt = now
                });
            }
            else
            {
                existing.Value = rawValue.Trim();
                existing.Url = url ?? existing.Url;
                existing.UpdatedAt = now;
            }
        }
    }

    private async Task UpsertUrlsAsync(Guid entityId, IReadOnlyList<string> urls, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var existing = await _db.EntityUrls
            .Where(row => row.EntityId == entityId)
            .Select(row => row.Url)
            .ToArrayAsync(cancellationToken);
        var seen = existing.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var sortOrder = existing.Length;

        foreach (var url in urls.Where(url => !string.IsNullOrWhiteSpace(url)).Select(url => url.Trim()))
        {
            if (!seen.Add(url))
            {
                continue;
            }

            _db.EntityUrls.Add(new EntityUrlRow
            {
                Id = Guid.NewGuid(),
                EntityId = entityId,
                Url = url,
                SortOrder = sortOrder++,
                CreatedAt = now
            });
        }
    }

    private async Task ReplaceTagsAsync(Guid entityId, IReadOnlyList<string> tags, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var existingLinks = await _db.EntityTagLinks.Where(row => row.EntityId == entityId).ToArrayAsync(cancellationToken);
        _db.EntityTagLinks.RemoveRange(existingLinks);

        foreach (var name in tags.Where(value => !string.IsNullOrWhiteSpace(value)).Select(value => value.Trim()).Distinct(StringComparer.OrdinalIgnoreCase))
        {
            var tag = await FindEntityByKindAndTitleAsync("tag", name, cancellationToken)
                ?? CreateEntity("tag", name, now);
            _db.EntityTagLinks.Add(new EntityTagLinkRow { EntityId = entityId, TagId = tag.Id, CreatedAt = now });
        }
    }

    private async Task SetStudioAsync(Guid entityId, string studioName, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var studio = await FindEntityByKindAndTitleAsync("studio", studioName.Trim(), cancellationToken)
            ?? CreateEntity("studio", studioName.Trim(), now);
        var existing = await _db.EntityStudioLinks.FindAsync([entityId], cancellationToken);
        if (existing is null)
        {
            _db.EntityStudioLinks.Add(new EntityStudioLinkRow { EntityId = entityId, StudioId = studio.Id, CreatedAt = now });
        }
        else
        {
            existing.StudioId = studio.Id;
        }
    }

    private async Task ReplaceCreditsAsync(Guid entityId, IReadOnlyList<CreditPatch> credits, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var existing = await _db.EntityCreditLinks.Where(row => row.EntityId == entityId).ToArrayAsync(cancellationToken);
        _db.EntityCreditLinks.RemoveRange(existing);

        var order = 0;
        foreach (var credit in credits.Where(credit => !string.IsNullOrWhiteSpace(credit.Name)))
        {
            var person = await FindEntityByKindAndTitleAsync("person", credit.Name.Trim(), cancellationToken)
                ?? CreateEntity("person", credit.Name.Trim(), now);
            _db.EntityCreditLinks.Add(new EntityCreditLinkRow
            {
                EntityId = entityId,
                PersonEntityId = person.Id,
                Role = EntityCreditRole.Person,
                Character = string.IsNullOrWhiteSpace(credit.Character) ? null : credit.Character.Trim(),
                SortOrder = credit.SortOrder ?? order++,
                CreatedAt = now
            });
        }
    }

    private async Task UpsertDatesAsync(Guid entityId, IReadOnlyDictionary<string, string> dates, DateTimeOffset now, CancellationToken cancellationToken)
    {
        foreach (var (code, value) in dates.Where(pair => !string.IsNullOrWhiteSpace(pair.Key) && !string.IsNullOrWhiteSpace(pair.Value)))
        {
            var existing = await _db.EntityDates.FindAsync([entityId, code], cancellationToken);
            if (existing is null)
            {
                _db.EntityDates.Add(new EntityDateRow { EntityId = entityId, Code = code, Value = value, SortableValue = ParseDateOnly(value), UpdatedAt = now });
            }
            else
            {
                existing.Value = value;
                existing.SortableValue = ParseDateOnly(value);
                existing.UpdatedAt = now;
            }
        }
    }

    private async Task UpsertCountersAsync(Guid entityId, IReadOnlyDictionary<string, int> counters, DateTimeOffset now, CancellationToken cancellationToken)
    {
        foreach (var (code, value) in counters)
        {
            var existing = await _db.EntityCounters.FindAsync([entityId, code], cancellationToken);
            if (existing is null)
            {
                _db.EntityCounters.Add(new EntityCounterRow { EntityId = entityId, Code = code, Value = value, UpdatedAt = now });
            }
            else
            {
                existing.Value = value;
                existing.UpdatedAt = now;
            }
        }
    }

    private async Task UpsertStatsAsync(Guid entityId, IReadOnlyDictionary<string, int> stats, DateTimeOffset now, CancellationToken cancellationToken)
    {
        foreach (var (code, value) in stats)
        {
            var existing = await _db.EntityStats.FindAsync([entityId, code], cancellationToken);
            if (existing is null)
            {
                _db.EntityStats.Add(new EntityStatRow { EntityId = entityId, Code = code, Value = value, UpdatedAt = now });
            }
            else
            {
                existing.Value = value;
                existing.UpdatedAt = now;
            }
        }
    }

    private async Task UpsertPositionsAsync(Guid entityId, IReadOnlyDictionary<string, int> positions, DateTimeOffset now, CancellationToken cancellationToken)
    {
        foreach (var (code, value) in positions)
        {
            var existing = await _db.EntityPositions.FindAsync([entityId, code], cancellationToken);
            if (existing is null)
            {
                _db.EntityPositions.Add(new EntityPositionRow { EntityId = entityId, Code = code, Value = value, UpdatedAt = now });
            }
            else
            {
                existing.Value = value;
                existing.UpdatedAt = now;
            }
        }
    }

    private async Task UpsertClassificationAsync(Guid entityId, string? value, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var existing = await _db.EntityClassifications.FindAsync([entityId], cancellationToken);
        if (existing is null)
        {
            _db.EntityClassifications.Add(new EntityClassificationRow { EntityId = entityId, Value = value, System = "plugin", UpdatedAt = now });
        }
        else
        {
            existing.Value = value;
            existing.System = "plugin";
            existing.UpdatedAt = now;
        }
    }

    private async Task DownloadSelectedImagesAsync(
        Guid entityId,
        IReadOnlyDictionary<string, string?> selectedImages,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        foreach (var (roleCode, url) in selectedImages)
        {
            if (string.IsNullOrWhiteSpace(url) || !roleCode.TryDecodeAs<EntityFileRole>(out var role))
            {
                continue;
            }

            var bytes = await _http.GetByteArrayAsync(url, cancellationToken);
            var ext = ExtensionFromUrl(url);
            var relativePath = Path.Combine("plugins", "artwork", entityId.ToString(), $"{roleCode}-{ShortHash(url)}{ext}");
            var physicalPath = Path.Combine(_options.CacheRoot, relativePath);
            Directory.CreateDirectory(Path.GetDirectoryName(physicalPath)!);
            await File.WriteAllBytesAsync(physicalPath, bytes, cancellationToken);

            var publicPath = $"/assets/{relativePath.Replace(Path.DirectorySeparatorChar, '/')}";
            var existing = await _db.EntityFiles
                .FirstOrDefaultAsync(row => row.EntityId == entityId && row.Role == role, cancellationToken);
            if (existing is null)
            {
                _db.EntityFiles.Add(new EntityFileRow
                {
                    Id = Guid.NewGuid(),
                    EntityId = entityId,
                    Role = role,
                    Path = publicPath,
                    MimeType = MimeTypeFromExtension(ext),
                    CreatedAt = now,
                    UpdatedAt = now
                });
            }
            else
            {
                existing.Path = publicPath;
                existing.MimeType = MimeTypeFromExtension(ext);
                existing.UpdatedAt = now;
            }
        }
    }

    /// <summary>
    /// Downloads images from proposal children into linked Person and Studio entities
    /// that were created or resolved during credits/studio apply.
    /// </summary>
    private async Task CascadeChildImagesAsync(
        IReadOnlyList<EntityMetadataProposal> children,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        foreach (var child in children)
        {
            if (child.Images.Count == 0 || string.IsNullOrWhiteSpace(child.Patch.Title))
            {
                continue;
            }

            if (child.TargetKind is not ("person" or "studio"))
            {
                continue;
            }

            var linkedEntity = await FindEntityByKindAndTitleAsync(child.TargetKind, child.Patch.Title.Trim(), cancellationToken);
            if (linkedEntity is null)
            {
                continue;
            }

            var hasFile = await _db.EntityFiles.AnyAsync(
                row => row.EntityId == linkedEntity.Id && (row.Role == EntityFileRole.Poster || row.Role == EntityFileRole.Logo),
                cancellationToken);
            if (hasFile)
            {
                continue;
            }

            var image = child.Images.FirstOrDefault(img => img.Kind is "poster") ?? child.Images.FirstOrDefault(img => img.Kind is "logo") ?? child.Images[0];
            var role = child.TargetKind == "studio" ? EntityFileRole.Logo : EntityFileRole.Poster;

            try
            {
                var bytes = await _http.GetByteArrayAsync(image.Url, cancellationToken);
                var ext = ExtensionFromUrl(image.Url);
                var relativePath = Path.Combine("plugins", "artwork", linkedEntity.Id.ToString(), $"{role.ToString().ToLowerInvariant()}-{ShortHash(image.Url)}{ext}");
                var physicalPath = Path.Combine(_options.CacheRoot, relativePath);
                Directory.CreateDirectory(Path.GetDirectoryName(physicalPath)!);
                await File.WriteAllBytesAsync(physicalPath, bytes, cancellationToken);

                var publicPath = $"/assets/{relativePath.Replace(Path.DirectorySeparatorChar, '/')}";
                _db.EntityFiles.Add(new EntityFileRow
                {
                    Id = Guid.NewGuid(),
                    EntityId = linkedEntity.Id,
                    Role = role,
                    Path = publicPath,
                    MimeType = MimeTypeFromExtension(ext),
                    CreatedAt = now,
                    UpdatedAt = now
                });

                linkedEntity.UpdatedAt = now;
            }
            catch (HttpRequestException)
            {
            }
        }
    }

    private async Task<EntityRow?> FindEntityByKindAndTitleAsync(string kind, string title, CancellationToken cancellationToken) =>
        await _db.Entities.FirstOrDefaultAsync(
            row => row.KindCode == kind && row.Title.ToLower() == title.ToLower() && row.DeletedAt == null,
            cancellationToken);

    private EntityRow CreateEntity(string kind, string title, DateTimeOffset now)
    {
        var entity = new EntityRow
        {
            Id = Guid.NewGuid(),
            KindCode = kind,
            Title = title,
            CreatedAt = now,
            UpdatedAt = now
        };
        _db.Entities.Add(entity);
        return entity;
    }

    private static DateOnly? ParseDateOnly(string value) =>
        DateOnly.TryParse(value, out var parsed) ? parsed : null;

    private static string ShortHash(string value) =>
        Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(value)))[..12].ToLowerInvariant();

    private static string ExtensionFromUrl(string url)
    {
        var path = Uri.TryCreate(url, UriKind.Absolute, out var uri) ? uri.AbsolutePath : url;
        var ext = Path.GetExtension(path);
        return string.IsNullOrWhiteSpace(ext) ? ".jpg" : ext.ToLowerInvariant();
    }

    private static string? MimeTypeFromExtension(string ext) =>
        ext.ToLowerInvariant() switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            _ => null
        };
}
