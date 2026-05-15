using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMediaPlaybackSpine : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "media_sources",
                schema: "v2",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_file_id = table.Column<Guid>(type: "uuid", nullable: true),
                    path = table.Column<string>(type: "text", nullable: false),
                    protocol = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    container = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    name = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    size_bytes = table.Column<long>(type: "bigint", nullable: true),
                    duration_seconds = table.Column<double>(type: "double precision", nullable: true),
                    bit_rate = table.Column<int>(type: "integer", nullable: true),
                    video_codec = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    audio_codec = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    width = table.Column<int>(type: "integer", nullable: true),
                    height = table.Column<int>(type: "integer", nullable: true),
                    frame_rate = table.Column<double>(type: "double precision", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_media_sources", x => x.id);
                    table.ForeignKey(
                        name: "FK_media_sources_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_media_sources_entity_files_entity_file_id",
                        column: x => x.entity_file_id,
                        principalSchema: "v2",
                        principalTable: "entity_files",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "trickplay_infos",
                schema: "v2",
                columns: table => new
                {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    width = table.Column<int>(type: "integer", nullable: false),
                    height = table.Column<int>(type: "integer", nullable: false),
                    tile_width = table.Column<int>(type: "integer", nullable: false),
                    tile_height = table.Column<int>(type: "integer", nullable: false),
                    thumbnail_count = table.Column<int>(type: "integer", nullable: false),
                    interval_seconds = table.Column<double>(type: "double precision", nullable: false),
                    bandwidth = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_trickplay_infos", x => new { x.entity_id, x.width });
                    table.CheckConstraint("ck_trickplay_infos_height", "height > 0");
                    table.CheckConstraint("ck_trickplay_infos_interval", "interval_seconds > 0");
                    table.CheckConstraint("ck_trickplay_infos_thumbnail_count", "thumbnail_count >= 0");
                    table.CheckConstraint("ck_trickplay_infos_tiles", "tile_width > 0 AND tile_height > 0");
                    table.CheckConstraint("ck_trickplay_infos_width", "width > 0");
                    table.ForeignKey(
                        name: "FK_trickplay_infos_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "media_streams",
                schema: "v2",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    media_source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    stream_index = table.Column<int>(type: "integer", nullable: false),
                    type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    codec = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    language = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    title = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    width = table.Column<int>(type: "integer", nullable: true),
                    height = table.Column<int>(type: "integer", nullable: true),
                    frame_rate = table.Column<double>(type: "double precision", nullable: true),
                    bit_rate = table.Column<int>(type: "integer", nullable: true),
                    sample_rate = table.Column<int>(type: "integer", nullable: true),
                    channels = table.Column<int>(type: "integer", nullable: true),
                    is_default = table.Column<bool>(type: "boolean", nullable: false),
                    is_forced = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_media_streams", x => x.id);
                    table.ForeignKey(
                        name: "FK_media_streams_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_media_streams_media_sources_media_source_id",
                        column: x => x.media_source_id,
                        principalSchema: "v2",
                        principalTable: "media_sources",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_media_sources_entity_file_id",
                schema: "v2",
                table: "media_sources",
                column: "entity_file_id");

            migrationBuilder.CreateIndex(
                name: "IX_media_sources_entity_id_path",
                schema: "v2",
                table: "media_sources",
                columns: new[] { "entity_id", "path" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_media_streams_entity_id",
                schema: "v2",
                table: "media_streams",
                column: "entity_id");

            migrationBuilder.CreateIndex(
                name: "IX_media_streams_media_source_id_stream_index",
                schema: "v2",
                table: "media_streams",
                columns: new[] { "media_source_id", "stream_index" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "media_streams",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "trickplay_infos",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "media_sources",
                schema: "v2");
        }
    }
}
