using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations {
    /// <inheritdoc />
    public partial class DropEmptyDetailRowTables : Migration {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) {
            migrationBuilder.DropTable(
                name: "audio_library_details",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "book_page_details",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "book_volume_details",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "image_details",
                schema: "v2");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) {
            migrationBuilder.CreateTable(
                name: "audio_library_details",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_audio_library_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_audio_library_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "book_page_details",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_book_page_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_book_page_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "book_volume_details",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_book_volume_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_book_volume_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "image_details",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_image_details", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_image_details_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });
        }
    }
}
