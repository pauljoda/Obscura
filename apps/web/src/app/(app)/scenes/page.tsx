import { SceneGrid } from "../../../components/scene-grid";
import { FilterBar } from "../../../components/filter-bar";

export default function ScenesPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1>Scenes</h1>
        <span className="text-mono-sm text-text-muted">0 scenes</span>
      </div>

      <FilterBar />
      <SceneGrid />
    </div>
  );
}
