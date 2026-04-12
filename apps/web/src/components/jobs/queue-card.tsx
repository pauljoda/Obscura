import { StatusLed } from "@obscura/ui/composed/status-led";
import { cn } from "@obscura/ui/lib/utils";
import { Play, Square } from "lucide-react";
import type { QueueSummary } from "../../lib/api";
import { getQueueIcon, ledForQueue } from "./job-helpers";

function QueueMetric({
  label,
  value,
  highlight,
  danger = false,
}: {
  label: string;
  value: number;
  highlight: boolean;
  danger?: boolean;
}) {
  return (
    <div className="bg-black/15 px-2 py-2 text-center">
      <p className="mb-0.5 text-[0.55rem] uppercase tracking-wider text-text-disabled">
        {label}
      </p>
      <p
        className={cn(
          "text-mono text-[0.84rem] font-semibold",
          danger && highlight
            ? "text-status-error-text"
            : highlight
              ? "text-text-accent"
              : "text-text-muted"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function QueueCard({
  queue,
  runningQueue,
  cancellingQueue,
  acknowledging,
  onRun,
  onCancel,
  onClearFailures,
}: {
  queue: QueueSummary;
  runningQueue: string | null;
  cancellingQueue: string | null;
  acknowledging: "all" | string | null;
  onRun: (queueName: string) => Promise<void>;
  onCancel: (queueName: string) => Promise<void>;
  onClearFailures: (scope: "all" | string) => Promise<void>;
}) {
  const Icon = getQueueIcon(queue.name);
  const hasPressure = queue.active > 0 || queue.backlog > 0;

  return (
    <div
      className={cn(
        "surface-card no-lift space-y-4 p-4 transition-all duration-normal",
        queue.failed > 0
          ? "border-status-error/25"
          : hasPressure
            ? "border-border-accent/30"
            : ""
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <StatusLed status={ledForQueue(queue.status)} pulse={queue.active > 0} />
            <Icon className="h-4 w-4 text-text-muted" />
            <h3 className="truncate text-[0.92rem] font-heading font-semibold">{queue.label}</h3>
          </div>
          <p className="mt-1 text-[0.72rem] text-text-muted">{queue.description}</p>
          <p className="mt-1 text-[0.68rem] text-text-disabled">
            Throttle: {queue.concurrency} worker{queue.concurrency === 1 ? "" : "s"} at a time
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {queue.failed > 0 && (
            <button
              type="button"
              onClick={() => void onClearFailures(queue.name)}
              disabled={acknowledging !== null}
              className="px-2 py-1 text-xs text-text-muted transition-colors hover:text-status-error-text disabled:opacity-40"
            >
              {acknowledging === queue.name ? "Clearing..." : "Clear failures"}
            </button>
          )}
          {(queue.active > 0 || queue.backlog > 0) && (
            <button
              type="button"
              onClick={() => void onCancel(queue.name)}
              disabled={cancellingQueue === queue.name}
              className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted transition-colors hover:text-status-error-text disabled:opacity-40"
            >
              <Square className="h-3 w-3" />
              {cancellingQueue === queue.name ? "Stopping..." : "Stop"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void onRun(queue.name)}
            disabled={runningQueue === queue.name}
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted transition-colors hover:text-text-accent disabled:opacity-40"
          >
            <Play className="h-3 w-3" />
            {runningQueue === queue.name ? "Queueing..." : "Run"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <QueueMetric label="Running" value={queue.active} highlight={queue.active > 0} />
        <QueueMetric label="Queued" value={queue.waiting} highlight={queue.waiting > 0} />
        <QueueMetric label="Delayed" value={queue.delayed} highlight={queue.delayed > 0} />
        <QueueMetric label="Errors" value={queue.failed} highlight={queue.failed > 0} danger />
      </div>
    </div>
  );
}
