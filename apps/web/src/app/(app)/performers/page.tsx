import { Users } from "lucide-react";

const placeholderPerformers = [
  { name: "Performer A", scenes: 12, galleries: 3 },
  { name: "Performer B", scenes: 8, galleries: 1 },
  { name: "Performer C", scenes: 15, galleries: 5 },
  { name: "Performer D", scenes: 4, galleries: 0 },
  { name: "Performer E", scenes: 22, galleries: 8 },
  { name: "Performer F", scenes: 6, galleries: 2 },
];

export default function PerformersPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1>Performers</h1>
        <span className="text-mono-sm text-text-muted">
          {placeholderPerformers.length} performers
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {placeholderPerformers.map((performer) => (
          <article
            key={performer.name}
            className="surface-card p-4 text-center group cursor-pointer"
          >
            <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-surface-3 text-2xl font-semibold text-text-muted group-hover:text-accent-400 transition-colors duration-fast">
              {performer.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <h3 className="text-sm font-medium truncate">{performer.name}</h3>
            <p className="text-text-muted text-xs mt-1">
              {performer.scenes} scenes
              {performer.galleries > 0 && ` · ${performer.galleries} galleries`}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
