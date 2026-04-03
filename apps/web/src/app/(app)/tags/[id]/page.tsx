import { Badge } from "@obscura/ui";

interface TagPageProps {
  params: Promise<{ id: string }>;
}

export default async function TagPage({ params }: TagPageProps) {
  const { id } = await params;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1>{decodeURIComponent(id)}</h1>
        <Badge variant="accent">42 scenes</Badge>
      </div>

      <div className="separator" />

      <section>
        <h4 className="text-kicker mb-3">Tagged Scenes</h4>
        <div className="surface-well p-8 text-center">
          <p className="text-text-muted text-sm">
            Scenes with this tag will appear here.
          </p>
        </div>
      </section>
    </div>
  );
}
