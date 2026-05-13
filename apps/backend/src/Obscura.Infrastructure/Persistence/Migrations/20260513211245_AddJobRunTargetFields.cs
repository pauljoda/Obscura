using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Obscura.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddJobRunTargetFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "target_entity_id",
                schema: "v2",
                table: "job_runs",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "target_entity_kind",
                schema: "v2",
                table: "job_runs",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "target_label",
                schema: "v2",
                table: "job_runs",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_job_runs_dedup",
                schema: "v2",
                table: "job_runs",
                columns: new[] { "type", "target_entity_id", "status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_job_runs_dedup",
                schema: "v2",
                table: "job_runs");

            migrationBuilder.DropColumn(
                name: "target_entity_id",
                schema: "v2",
                table: "job_runs");

            migrationBuilder.DropColumn(
                name: "target_entity_kind",
                schema: "v2",
                table: "job_runs");

            migrationBuilder.DropColumn(
                name: "target_label",
                schema: "v2",
                table: "job_runs");
        }
    }
}
