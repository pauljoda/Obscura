import { cn } from "@obscura/ui";

const placeholderTags = [
  { name: "tag-one", count: 42 },
  { name: "tag-two", count: 35 },
  { name: "tag-three", count: 28 },
  { name: "tag-four", count: 22 },
  { name: "tag-five", count: 18 },
  { name: "tag-six", count: 15 },
  { name: "tag-seven", count: 12 },
  { name: "tag-eight", count: 9 },
  { name: "tag-nine", count: 7 },
  { name: "tag-ten", count: 5 },
  { name: "tag-eleven", count: 3 },
  { name: "tag-twelve", count: 2 },
];

const maxCount = Math.max(...placeholderTags.map((t) => t.count));

export default function TagsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1>Tags</h1>
        <span className="text-mono-sm text-text-muted">
          {placeholderTags.length} tags
        </span>
      </div>

      {/* Tag cloud */}
      <div className="surface-panel p-6">
        <div className="flex flex-wrap gap-2 justify-center">
          {placeholderTags.map((tag) => {
            const intensity = tag.count / maxCount;
            return (
              <button
                key={tag.name}
                className={cn(
                  "rounded-md border px-3 py-1.5 transition-all duration-fast",
                  "hover:border-border-accent hover:bg-accent-950",
                  intensity > 0.6
                    ? "border-border-accent text-accent-400 text-base font-medium"
                    : intensity > 0.3
                      ? "border-border-default text-text-secondary text-sm"
                      : "border-border-subtle text-text-muted text-xs"
                )}
              >
                {tag.name}
                <span className="ml-1.5 text-text-disabled text-xs">
                  {tag.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tag list */}
      <section>
        <h4 className="text-kicker mb-3">All Tags</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {placeholderTags.map((tag) => (
            <div
              key={tag.name}
              className="surface-card flex items-center justify-between p-3 cursor-pointer"
            >
              <span className="text-sm">{tag.name}</span>
              <span className="text-mono-sm text-text-muted">{tag.count}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
