using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations {
    /// <inheritdoc />
    public partial class AddCapabilityFirstTables : Migration {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) {
            migrationBuilder.CreateTable(
                name: "entity_stats",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    value = table.Column<int>(type: "integer", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_entity_stats", x => new { x.entity_id, x.code });
                    table.CheckConstraint("ck_entity_stats_value", "value >= 0");
                    table.ForeignKey(
                        name: "FK_entity_stats_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entity_dates",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    value = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    sortable_value = table.Column<DateOnly>(type: "date", nullable: true),
                    precision = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_entity_dates", x => new { x.entity_id, x.code });
                    table.ForeignKey(
                        name: "FK_entity_dates_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entity_technical",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    duration_seconds = table.Column<double>(type: "double precision", nullable: true),
                    width = table.Column<int>(type: "integer", nullable: true),
                    height = table.Column<int>(type: "integer", nullable: true),
                    frame_rate = table.Column<double>(type: "double precision", nullable: true),
                    bit_rate = table.Column<int>(type: "integer", nullable: true),
                    sample_rate = table.Column<int>(type: "integer", nullable: true),
                    channels = table.Column<int>(type: "integer", nullable: true),
                    codec = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    container = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    format = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_entity_technical", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_entity_technical_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entity_sources",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    value = table.Column<string>(type: "text", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_entity_sources", x => new { x.entity_id, x.code });
                    table.ForeignKey(
                        name: "FK_entity_sources_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entity_progress",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    current_entity_id = table.Column<Guid>(type: "uuid", nullable: true),
                    unit = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    index = table.Column<int>(type: "integer", nullable: false),
                    total = table.Column<int>(type: "integer", nullable: false),
                    mode = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_entity_progress", x => x.entity_id);
                    table.CheckConstraint("ck_entity_progress_bounds", "index >= 0 AND total >= 0");
                    table.ForeignKey(
                        name: "FK_entity_progress_entities_current_entity_id",
                        column: x => x.current_entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_entity_progress_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entity_positions",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    value = table.Column<int>(type: "integer", nullable: false),
                    label = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_entity_positions", x => new { x.entity_id, x.code });
                    table.ForeignKey(
                        name: "FK_entity_positions_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "entity_classifications",
                schema: "v2",
                columns: table => new {
                    entity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    value = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    system = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table => {
                    table.PrimaryKey("PK_entity_classifications", x => x.entity_id);
                    table.ForeignKey(
                        name: "FK_entity_classifications_entities_entity_id",
                        column: x => x.entity_id,
                        principalSchema: "v2",
                        principalTable: "entities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_entity_progress_current_entity_id",
                schema: "v2",
                table: "entity_progress",
                column: "current_entity_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) {
            migrationBuilder.DropTable(name: "entity_classifications", schema: "v2");
            migrationBuilder.DropTable(name: "entity_dates", schema: "v2");
            migrationBuilder.DropTable(name: "entity_positions", schema: "v2");
            migrationBuilder.DropTable(name: "entity_progress", schema: "v2");
            migrationBuilder.DropTable(name: "entity_sources", schema: "v2");
            migrationBuilder.DropTable(name: "entity_stats", schema: "v2");
            migrationBuilder.DropTable(name: "entity_technical", schema: "v2");
        }
    }
}
