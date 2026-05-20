using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations {
    /// <inheritdoc />
    public partial class DropDetailParentColumns : Migration {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) {
            migrationBuilder.DropForeignKey(
                name: "FK_book_chapter_details_entities_book_entity_id",
                schema: "v2",
                table: "book_chapter_details");

            migrationBuilder.DropForeignKey(
                name: "FK_book_page_details_entities_book_entity_id",
                schema: "v2",
                table: "book_page_details");

            migrationBuilder.DropForeignKey(
                name: "FK_book_page_details_entities_chapter_entity_id",
                schema: "v2",
                table: "book_page_details");

            migrationBuilder.DropForeignKey(
                name: "FK_book_volume_details_entities_book_entity_id",
                schema: "v2",
                table: "book_volume_details");

            migrationBuilder.DropForeignKey(
                name: "FK_video_season_details_entities_series_entity_id",
                schema: "v2",
                table: "video_season_details");

            migrationBuilder.DropIndex(
                name: "IX_video_season_details_series_entity_id_season_number",
                schema: "v2",
                table: "video_season_details");

            migrationBuilder.DropIndex(
                name: "IX_book_volume_details_book_entity_id",
                schema: "v2",
                table: "book_volume_details");

            migrationBuilder.DropIndex(
                name: "IX_book_page_details_book_entity_id",
                schema: "v2",
                table: "book_page_details");

            migrationBuilder.DropIndex(
                name: "IX_book_page_details_chapter_entity_id",
                schema: "v2",
                table: "book_page_details");

            migrationBuilder.DropIndex(
                name: "IX_book_chapter_details_book_entity_id",
                schema: "v2",
                table: "book_chapter_details");

            migrationBuilder.DropColumn(
                name: "series_entity_id",
                schema: "v2",
                table: "video_season_details");

            migrationBuilder.DropColumn(
                name: "parent_tag_entity_id",
                schema: "v2",
                table: "tag_details");

            migrationBuilder.DropColumn(
                name: "parent_studio_entity_id",
                schema: "v2",
                table: "studio_details");

            migrationBuilder.DropColumn(
                name: "book_entity_id",
                schema: "v2",
                table: "book_volume_details");

            migrationBuilder.DropColumn(
                name: "book_entity_id",
                schema: "v2",
                table: "book_page_details");

            migrationBuilder.DropColumn(
                name: "chapter_entity_id",
                schema: "v2",
                table: "book_page_details");

            migrationBuilder.DropColumn(
                name: "book_entity_id",
                schema: "v2",
                table: "book_chapter_details");

            migrationBuilder.DropColumn(
                name: "volume_entity_id",
                schema: "v2",
                table: "book_chapter_details");

            migrationBuilder.DropColumn(
                name: "parent_library_entity_id",
                schema: "v2",
                table: "audio_library_details");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) {
            migrationBuilder.AddColumn<Guid>(
                name: "series_entity_id",
                schema: "v2",
                table: "video_season_details",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "parent_tag_entity_id",
                schema: "v2",
                table: "tag_details",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "parent_studio_entity_id",
                schema: "v2",
                table: "studio_details",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "book_entity_id",
                schema: "v2",
                table: "book_volume_details",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "book_entity_id",
                schema: "v2",
                table: "book_page_details",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "chapter_entity_id",
                schema: "v2",
                table: "book_page_details",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "book_entity_id",
                schema: "v2",
                table: "book_chapter_details",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "volume_entity_id",
                schema: "v2",
                table: "book_chapter_details",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "parent_library_entity_id",
                schema: "v2",
                table: "audio_library_details",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_video_season_details_series_entity_id_season_number",
                schema: "v2",
                table: "video_season_details",
                columns: new[] { "series_entity_id", "season_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_book_volume_details_book_entity_id",
                schema: "v2",
                table: "book_volume_details",
                column: "book_entity_id");

            migrationBuilder.CreateIndex(
                name: "IX_book_page_details_book_entity_id",
                schema: "v2",
                table: "book_page_details",
                column: "book_entity_id");

            migrationBuilder.CreateIndex(
                name: "IX_book_page_details_chapter_entity_id",
                schema: "v2",
                table: "book_page_details",
                column: "chapter_entity_id");

            migrationBuilder.CreateIndex(
                name: "IX_book_chapter_details_book_entity_id",
                schema: "v2",
                table: "book_chapter_details",
                column: "book_entity_id");

            migrationBuilder.AddForeignKey(
                name: "FK_book_chapter_details_entities_book_entity_id",
                schema: "v2",
                table: "book_chapter_details",
                column: "book_entity_id",
                principalSchema: "v2",
                principalTable: "entities",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_book_page_details_entities_book_entity_id",
                schema: "v2",
                table: "book_page_details",
                column: "book_entity_id",
                principalSchema: "v2",
                principalTable: "entities",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_book_page_details_entities_chapter_entity_id",
                schema: "v2",
                table: "book_page_details",
                column: "chapter_entity_id",
                principalSchema: "v2",
                principalTable: "entities",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_book_volume_details_entities_book_entity_id",
                schema: "v2",
                table: "book_volume_details",
                column: "book_entity_id",
                principalSchema: "v2",
                principalTable: "entities",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_video_season_details_entities_series_entity_id",
                schema: "v2",
                table: "video_season_details",
                column: "series_entity_id",
                principalSchema: "v2",
                principalTable: "entities",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
