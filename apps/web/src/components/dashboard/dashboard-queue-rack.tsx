"use client";

import type { QueueSummaryDto } from "@obscura/contracts";
import { cn } from "@obscura/ui/lib/utils";
import { formatQueueName } from "./dashboard-utils";

const QUEUE_GRADIENTS = [
  "gradient-thumb-1",
  "gradient-thumb-2",
  "gradient-thumb-3",
  "gradient-thumb-4",
  "gradient-thumb-5",
  "gradient-thumb-6",
] as const;

function ledForQueue(status: QueueSummaryDto["status"]): string {
  if (status === "active") return "led-active";
  if (status === "warning") return "led-warning";
  return "led-idle";
}

function QueueLane({
  queue,
  gradientClass,
}: {
  queue: QueueSummaryDto;
  gradientClass: string;
}) {
  const totalClosed = queue.completed + queue.failed;
  const failShare = totalClosed > 0 ? queue.failed / totalClosed : 0;
  const waitingShare =
    queue.waiting + queue.active > 0
      ? queue.waiting / (queue.waiting + queue.active + 1)
      : 0;

  return (
    <div className="surface-card-sharp no-lift relative min-w-[140px] flex-1 overflow-hidden p-3">
      <div
        className={cn(
          "pointer-events-none absolute -right-6 -bottom-10 h-24 w-24 rotate-12 opacity-25 blur-2xl",
          gradientClass
        )}
      />
      <div className="relative flex items-center justify-between gap-2 mb-2">
        <span className={`led led-sm ${ledForQueue(queue.status)}`} />
        <span className="text-[0.58rem] font-mono uppercase tracking-widest text-text-disabled truncate text-right">
          {formatQueueName(queue.name)}
        </span>
      </div>
      <div className="relative flex gap-2 text-mono-sm text-text-muted">
        <span title="Running">{queue.active} run</span>
        <span className="text-text-disabled">·</span>
        <span title="Waiting">{queue.waiting} wait</span>
      </div>
      <div className="relative mt-2 space-y-1.5">
        <div className="meter-track h-1 overflow-hidden">
          <div
            className="meter-fill h-full "
            style={{ width: `${Math.min(100, Math.round(waitingShare * 100))}%` }}
          />
        </div>
        {queue.failed > 0 && (
          <div className="meter-track h-1 overflow-hidden bg-error-muted/30">
            <div
              className="h-full bg-gradient-to-r from-error-muted to-error-text/90"
              style={{
                width: `${Math.min(100, Math.round(failShare * 100))}%`,
                boxShadow: "0 0 6px rgba(179, 79, 86, 0.35)",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function DashboardQueueRack({ queues }: { queues: QueueSummaryDto[] }) {
  if (queues.length === 0) return null;

  return (
    <section>
      <div className="flex items-end justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold tracking-tight font-heading">Queues</h2>
        <span className="text-mono-sm text-text-disabled">{queues.length}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hidden md:flex-wrap md:overflow-visible">
        {queues.map((queue, i) => (
          <QueueLane
            key={queue.name}
            queue={queue}
            gradientClass={QUEUE_GRADIENTS[i % QUEUE_GRADIENTS.length]}
          />
        ))}
      </div>
    </section>
  );
}
