using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLibraryRootIdToMediaDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "library_root_id",
                schema: "v2",
                table: "gallery_details",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "library_root_id",
                schema: "v2",
                table: "book_details",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "audio_library_details",
                schema: "v2",
                columns: table => new
                {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    library_root_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audio_library_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_audio_library_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_audio_library_details_library_roots_library_root_id",
                        column: x => x.library_root_id,
                        principalSchema: "v2",
                        principalTable: "library_roots",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_gallery_details_library_root_id",
                schema: "v2",
                table: "gallery_details",
                column: "library_root_id");

            migrationBuilder.CreateIndex(
                name: "IX_book_details_library_root_id",
                schema: "v2",
                table: "book_details",
                column: "library_root_id");

            migrationBuilder.CreateIndex(
                name: "IX_audio_library_details_library_root_id",
                schema: "v2",
                table: "audio_library_details",
                column: "library_root_id");

            migrationBuilder.AddForeignKey(
                name: "FK_book_details_library_roots_library_root_id",
                schema: "v2",
                table: "book_details",
                column: "library_root_id",
                principalSchema: "v2",
                principalTable: "library_roots",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_gallery_details_library_roots_library_root_id",
                schema: "v2",
                table: "gallery_details",
                column: "library_root_id",
                principalSchema: "v2",
                principalTable: "library_roots",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_book_details_library_roots_library_root_id",
                schema: "v2",
                table: "book_details");

            migrationBuilder.DropForeignKey(
                name: "FK_gallery_details_library_roots_library_root_id",
                schema: "v2",
                table: "gallery_details");

            migrationBuilder.DropTable(
                name: "audio_library_details",
                schema: "v2");

            migrationBuilder.DropIndex(
                name: "IX_gallery_details_library_root_id",
                schema: "v2",
                table: "gallery_details");

            migrationBuilder.DropIndex(
                name: "IX_book_details_library_root_id",
                schema: "v2",
                table: "book_details");

            migrationBuilder.DropColumn(
                name: "library_root_id",
                schema: "v2",
                table: "gallery_details");

            migrationBuilder.DropColumn(
                name: "library_root_id",
                schema: "v2",
                table: "book_details");
        }
    }
}
