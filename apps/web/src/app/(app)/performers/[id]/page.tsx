import { Badge, Button } from "@obscura/ui";
import { Star, Heart, Film, Images } from "lucide-react";

interface PerformerPageProps {
  params: Promise<{ id: string }>;
}

export default async function PerformerPage({ params }: PerformerPageProps) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex items-start gap-6">
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-surface-3 text-4xl font-semibold text-text-muted flex-shrink-0">
          PA
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1>Performer A</h1>
            <Button variant="ghost" size="icon">
              <Heart className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-text-muted text-sm">
              <Film className="h-4 w-4" />
              <span>12 scenes</span>
            </div>
            <div className="flex items-center gap-1.5 text-text-muted text-sm">
              <Images className="h-4 w-4" />
              <span>3 galleries</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            <Badge>tag-one</Badge>
            <Badge>tag-two</Badge>
            <Badge>tag-three</Badge>
          </div>
        </div>
      </div>

      <div className="separator" />

      {/* Scene grid placeholder */}
      <section>
        <h4 className="text-kicker mb-3">Scenes</h4>
        <div className="surface-well p-8 text-center">
          <p className="text-text-muted text-sm">
            Scenes featuring this performer will appear here.
          </p>
        </div>
      </section>
    </div>
  );
}
