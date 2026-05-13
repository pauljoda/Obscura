using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations;

/// <inheritdoc />
public partial class RemoveGalleryPhotographer : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "photographer",
            schema: "v2",
            table: "gallery_details");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "photographer",
            schema: "v2",
            table: "gallery_details",
            type: "text",
            nullable: true);
    }
}
