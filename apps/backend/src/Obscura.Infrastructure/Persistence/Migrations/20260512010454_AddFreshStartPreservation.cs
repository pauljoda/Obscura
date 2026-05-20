using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations {
    /// <inheritdoc />
    public partial class AddFreshStartPreservation : Migration {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) {
            migrationBuilder.CreateTable(
                name: "database_backups",
                schema: "v2",
                columns: table => new {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    backup_path = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    error = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table => {
                    table.PrimaryKey("PK_database_backups", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "library_roots",
                schema: "v2",
                columns: table => new {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    path = table.Column<string>(type: "text", nullable: false),
                    label = table.Column<string>(type: "text", nullable: false),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    recursive = table.Column<bool>(type: "boolean", nullable: false),
                    scan_videos = table.Column<bool>(type: "boolean", nullable: false),
                    scan_images = table.Column<bool>(type: "boolean", nullable: false),
                    scan_audio = table.Column<bool>(type: "boolean", nullable: false),
                    scan_books = table.Column<bool>(type: "boolean", nullable: false),
                    is_nsfw = table.Column<bool>(type: "boolean", nullable: false),
                    last_scanned_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_library_roots", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "library_settings",
                schema: "v2",
                columns: table => new {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    auto_scan_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    scan_interval_minutes = table.Column<int>(type: "integer", nullable: false),
                    auto_generate_metadata = table.Column<bool>(type: "boolean", nullable: false),
                    auto_generate_fingerprints = table.Column<bool>(type: "boolean", nullable: false),
                    generate_phash = table.Column<bool>(type: "boolean", nullable: false),
                    auto_generate_preview = table.Column<bool>(type: "boolean", nullable: false),
                    generate_trickplay = table.Column<bool>(type: "boolean", nullable: false),
                    trickplay_interval_seconds = table.Column<int>(type: "integer", nullable: false),
                    preview_clip_duration_seconds = table.Column<int>(type: "integer", nullable: false),
                    thumbnail_quality = table.Column<int>(type: "integer", nullable: false),
                    trickplay_quality = table.Column<int>(type: "integer", nullable: false),
                    background_worker_concurrency = table.Column<int>(type: "integer", nullable: false),
                    nsfw_lan_auto_enable = table.Column<bool>(type: "boolean", nullable: false),
                    metadata_storage_dedicated = table.Column<bool>(type: "boolean", nullable: false),
                    subtitles_auto_enable = table.Column<bool>(type: "boolean", nullable: false),
                    subtitles_preferred_languages = table.Column<string>(type: "text", nullable: false),
                    subtitle_style = table.Column<string>(type: "text", nullable: false),
                    subtitle_font_scale = table.Column<float>(type: "real", nullable: false),
                    subtitle_position_percent = table.Column<float>(type: "real", nullable: false),
                    subtitle_opacity = table.Column<float>(type: "real", nullable: false),
                    default_playback_mode = table.Column<string>(type: "text", nullable: false),
                    show_cast_controls = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_library_settings", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_library_roots_path",
                schema: "v2",
                table: "library_roots",
                column: "path",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) {
            migrationBuilder.DropTable(
                name: "database_backups",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "library_roots",
                schema: "v2");

            migrationBuilder.DropTable(
                name: "library_settings",
                schema: "v2");
        }
    }
}
