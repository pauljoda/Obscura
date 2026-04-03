import { Button } from "@obscura/ui";
import {
  FolderOpen,
  Database,
  Palette,
  HardDrive,
  Plus,
} from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <h1>Settings</h1>

      {/* Library Roots */}
      <section className="surface-panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-accent-500" />
            <div>
              <h2 className="text-base">Library Roots</h2>
              <p className="text-text-muted text-sm">
                Directories to scan for media files
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Root
          </Button>
        </div>
        <div className="surface-well p-4 text-center">
          <p className="text-text-muted text-sm">
            No library roots configured. Add a root directory to begin scanning.
          </p>
        </div>
      </section>

      {/* Database */}
      <section className="surface-panel p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-accent-500" />
          <div>
            <h2 className="text-base">Database</h2>
            <p className="text-text-muted text-sm">
              PostgreSQL connection and maintenance
            </p>
          </div>
        </div>
        <div className="surface-well p-3 space-y-2 text-mono-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Host</span>
            <span>postgres:5432</span>
          </div>
          <div className="separator" />
          <div className="flex justify-between">
            <span className="text-text-muted">Database</span>
            <span>obscura</span>
          </div>
          <div className="separator" />
          <div className="flex justify-between">
            <span className="text-text-muted">Status</span>
            <span className="text-success-text">Connected</span>
          </div>
        </div>
      </section>

      {/* Storage */}
      <section className="surface-panel p-5 space-y-4">
        <div className="flex items-center gap-3">
          <HardDrive className="h-5 w-5 text-accent-500" />
          <div>
            <h2 className="text-base">Storage</h2>
            <p className="text-text-muted text-sm">
              Generated files and cache
            </p>
          </div>
        </div>
        <div className="surface-well p-3 space-y-2 text-mono-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Thumbnails</span>
            <span>0 B</span>
          </div>
          <div className="separator" />
          <div className="flex justify-between">
            <span className="text-text-muted">Previews</span>
            <span>0 B</span>
          </div>
          <div className="separator" />
          <div className="flex justify-between">
            <span className="text-text-muted">Cache</span>
            <span>0 B</span>
          </div>
        </div>
      </section>

      {/* Display */}
      <section className="surface-panel p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Palette className="h-5 w-5 text-accent-500" />
          <div>
            <h2 className="text-base">Display</h2>
            <p className="text-text-muted text-sm">
              Appearance and layout preferences
            </p>
          </div>
        </div>
        <div className="surface-well p-3 space-y-2 text-mono-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Theme</span>
            <span>Dark Control Room</span>
          </div>
          <div className="separator" />
          <div className="flex justify-between">
            <span className="text-text-muted">Grid Density</span>
            <span>4 columns</span>
          </div>
        </div>
      </section>
    </div>
  );
}
