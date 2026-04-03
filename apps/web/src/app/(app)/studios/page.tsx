import { Building2 } from "lucide-react";

const placeholderStudios = [
  { name: "Studio Alpha", scenes: 18 },
  { name: "Studio Beta", scenes: 12 },
  { name: "Studio Gamma", scenes: 8 },
  { name: "Studio Delta", scenes: 5 },
];

export default function StudiosPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1>Studios</h1>
        <span className="text-mono-sm text-text-muted">
          {placeholderStudios.length} studios
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {placeholderStudios.map((studio) => (
          <article
            key={studio.name}
            className="surface-card p-4 flex items-center gap-4 cursor-pointer"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-3">
              <Building2 className="h-5 w-5 text-text-muted" />
            </div>
            <div>
              <h3 className="text-sm font-medium">{studio.name}</h3>
              <p className="text-text-muted text-xs">{studio.scenes} scenes</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
