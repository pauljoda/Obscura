import { Film, Images, Users, Activity, HardDrive, Clock } from "lucide-react";

const stats = [
  { label: "Scenes", value: "0", icon: Film },
  { label: "Galleries", value: "0", icon: Images },
  { label: "Performers", value: "0", icon: Users },
];

const systemStatus = [
  {
    label: "Workers",
    value: "Idle",
    ledClass: "led-idle",
    detail: "No active jobs",
  },
  {
    label: "Library",
    value: "Not configured",
    ledClass: "led-idle",
    detail: "Add library roots in Settings",
  },
  {
    label: "Storage",
    value: "—",
    ledClass: "led-idle",
    detail: "No media indexed",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1>Dashboard</h1>
        <p className="mt-1 text-text-muted text-sm">
          Library overview and system status
        </p>
      </div>

      {/* Library stats */}
      <section>
        <h4 className="text-kicker mb-3">Library</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="surface-panel p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-950">
                  <stat.icon className="h-4 w-4 text-accent-500" />
                </div>
                <div>
                  <p className="text-label text-text-muted">{stat.label}</p>
                  <p className="text-xl font-semibold font-heading">
                    {stat.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* System status */}
      <section>
        <h4 className="text-kicker mb-3">System</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {systemStatus.map((item) => (
            <div key={item.label} className="surface-panel p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className={`led ${item.ledClass}`} />
                <span className="text-label text-text-muted">
                  {item.label}
                </span>
              </div>
              <p className="font-heading font-semibold">{item.value}</p>
              <p className="text-text-muted text-sm mt-1">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent activity placeholder */}
      <section>
        <h4 className="text-kicker mb-3">Recent Activity</h4>
        <div className="surface-well p-6 text-center">
          <Clock className="h-8 w-8 text-text-disabled mx-auto mb-2" />
          <p className="text-text-muted text-sm">
            Activity will appear here once the library is configured and scanned.
          </p>
        </div>
      </section>
    </div>
  );
}
