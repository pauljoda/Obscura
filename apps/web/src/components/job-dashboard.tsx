"use client";

import { StatusLed, Meter, Badge, Button } from "@obscura/ui";
import { cn } from "@obscura/ui";
import {
  FolderSearch,
  FileSearch,
  Fingerprint,
  Image,
  DatabaseZap,
  Pause,
  RotateCcw,
  Trash2,
  Terminal,
  Cpu,
  HardDrive,
  Clock,
} from "lucide-react";
import type { LedStatus } from "@obscura/ui";

const queues = [
  {
    name: "library-scan",
    label: "Library Scan",
    description: "Discovers files in configured media roots",
    icon: FolderSearch,
    status: "idle" as LedStatus,
    active: 0,
    waiting: 0,
    completed: 0,
    failed: 0,
  },
  {
    name: "media-probe",
    label: "Media Probe",
    description: "Extracts technical metadata using ffprobe",
    icon: FileSearch,
    status: "active" as LedStatus,
    active: 2,
    waiting: 14,
    completed: 48,
    failed: 1,
  },
  {
    name: "fingerprint",
    label: "Fingerprint",
    description: "Generates md5, oshash, and perceptual hashes",
    icon: Fingerprint,
    status: "active" as LedStatus,
    active: 1,
    waiting: 8,
    completed: 35,
    failed: 0,
  },
  {
    name: "preview",
    label: "Preview",
    description: "Builds thumbnails, posters, and contact sheets",
    icon: Image,
    status: "warning" as LedStatus,
    active: 0,
    waiting: 22,
    completed: 12,
    failed: 3,
  },
  {
    name: "metadata-import",
    label: "Metadata Import",
    description: "Coordinates stash imports and provider matching",
    icon: DatabaseZap,
    status: "idle" as LedStatus,
    active: 0,
    waiting: 5,
    completed: 0,
    failed: 0,
  },
];

const activeJobs = [
  {
    queue: "media-probe",
    target: "Scene_2024_0142.mp4",
    progress: 78,
    elapsed: "1m 23s",
  },
  {
    queue: "media-probe",
    target: "Scene_2024_0089.mp4",
    progress: 45,
    elapsed: "0m 52s",
  },
  {
    queue: "fingerprint",
    target: "Scene_2023_0421.mp4",
    progress: 12,
    elapsed: "0m 08s",
  },
];

const errorLog = [
  {
    time: "14:23:08",
    queue: "preview",
    message: "ffmpeg: Failed to generate thumbnail for Scene_2023_0299.mp4 - corrupt header",
  },
  {
    time: "14:21:45",
    queue: "preview",
    message: "ffmpeg: Timeout generating contact sheet for Scene_2023_0188.mp4",
  },
  {
    time: "14:20:12",
    queue: "preview",
    message: "ffmpeg: Unsupported codec in Scene_2024_0067.mp4",
  },
];

export function JobDashboard() {
  return (
    <div className="space-y-5">
      <div>
        <h1>Operations</h1>
        <p className="mt-1 text-text-muted text-sm">
          Background job queues and system status
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column: Queue overview + System meters */}
        <div className="space-y-5">
          {/* Queue Overview */}
          <section>
            <h4 className="text-kicker mb-3">Queues</h4>
            <div className="space-y-2">
              {queues.map((queue) => (
                <div
                  key={queue.name}
                  className="surface-panel p-3 cursor-pointer hover:border-border-accent transition-colors duration-fast"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <StatusLed
                      status={queue.status}
                      pulse={queue.active > 0}
                    />
                    <queue.icon className="h-4 w-4 text-text-muted" />
                    <span className="text-sm font-medium flex-1">
                      {queue.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: "Active", value: queue.active, highlight: queue.active > 0 },
                      { label: "Wait", value: queue.waiting, highlight: false },
                      { label: "Done", value: queue.completed, highlight: false },
                      { label: "Fail", value: queue.failed, highlight: queue.failed > 0 },
                    ].map((stat) => (
                      <div key={stat.label}>
                        <p className="text-[0.6rem] text-text-disabled uppercase tracking-wider">
                          {stat.label}
                        </p>
                        <p
                          className={cn(
                            "text-mono-tabular text-sm font-semibold",
                            stat.highlight && stat.label === "Fail"
                              ? "text-error-text"
                              : stat.highlight
                                ? "text-accent-400"
                                : "text-text-muted"
                          )}
                        >
                          {stat.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* System Meters */}
          <section>
            <h4 className="text-kicker mb-3">System</h4>
            <div className="surface-panel p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Cpu className="h-4 w-4 text-text-muted" />
                <Meter
                  label="Workers"
                  value={3}
                  max={4}
                  showValue
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-3">
                <HardDrive className="h-4 w-4 text-text-muted" />
                <Meter
                  label="Disk"
                  value={42}
                  max={100}
                  showValue
                  className="flex-1"
                />
              </div>
              <div className="flex items-center gap-2 text-mono-sm text-text-muted">
                <Clock className="h-3.5 w-3.5" />
                <span>Uptime: 2d 14h 23m</span>
              </div>
            </div>
          </section>
        </div>

        {/* Right column: Active jobs + Error log */}
        <div className="lg:col-span-2 space-y-5">
          {/* Active Jobs */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-kicker">Active Jobs</h4>
              <span className="text-mono-sm text-text-muted">
                {activeJobs.length} running
              </span>
            </div>
            <div className="space-y-2">
              {activeJobs.map((job, i) => (
                <div key={i} className="surface-panel p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <StatusLed status="active" pulse />
                      <div>
                        <Badge variant="accent" className="mb-1">
                          {job.queue}
                        </Badge>
                        <p className="text-mono text-text-secondary">
                          {job.target}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-mono-tabular text-text-muted text-xs">
                        {job.elapsed}
                      </span>
                      <Button variant="ghost" size="icon">
                        <Pause className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <Meter value={job.progress} showValue />
                </div>
              ))}
            </div>
          </section>

          {/* Error Log */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-kicker">Error Log</h4>
              <Button variant="ghost" size="sm">
                Clear
              </Button>
            </div>
            <div className="surface-well p-3 max-h-64 overflow-y-auto">
              {errorLog.length === 0 ? (
                <p className="text-text-disabled text-sm text-center py-4">
                  No errors
                </p>
              ) : (
                <div className="space-y-2">
                  {errorLog.map((entry, i) => (
                    <div key={i} className="flex gap-3 text-mono-sm">
                      <span className="text-text-disabled whitespace-nowrap">
                        {entry.time}
                      </span>
                      <StatusLed status="error" size="sm" className="mt-1.5" />
                      <div className="min-w-0">
                        <Badge variant="error" className="mb-1 text-[0.6rem]">
                          {entry.queue}
                        </Badge>
                        <p className="text-error-text break-words">
                          {entry.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Quick actions */}
          <section>
            <h4 className="text-kicker mb-3">Actions</h4>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm">
                <FolderSearch className="h-3.5 w-3.5 mr-1.5" />
                Scan Library
              </Button>
              <Button variant="secondary" size="sm">
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Retry Failed
              </Button>
              <Button variant="ghost" size="sm">
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Clear Completed
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
