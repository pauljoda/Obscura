using Microsoft.EntityFrameworkCore;
using Obscura.Domain.Entities;
using Obscura.Infrastructure.Persistence.Entities;

namespace Obscura.Infrastructure.Persistence;

internal static partial class ExpandedV2ModelConfiguration
{
    public static void ConfigureExpandedV2Model(this ModelBuilder modelBuilder)
    {
        ConfigureEntityCapabilities(modelBuilder);
        ConfigureMediaDetails(modelBuilder);
        ConfigureTaxonomyDetails(modelBuilder);
        ConfigureCollections(modelBuilder);
        ConfigureSystemTables(modelBuilder);
    }
}
