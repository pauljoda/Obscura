"use client";

import { useState } from "react";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createTag } from "../lib/api";
import { TagForm, type TagFormValues } from "./tag-form";
import { entityTerms } from "../lib/terminology";
import { StatusMessage } from "./shared/status-message";

export function TagCreate() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [values, setValues] = useState<TagFormValues>({
    name: "",
    description: "",
    aliases: "",
    isNsfw: false,
  });

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await createTag({
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        aliases: values.aliases.trim() || undefined,
      });
      router.push(`/tags/${encodeURIComponent(values.name.trim())}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/tags")}
            className="inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </button>
          <h1 className="text-lg font-heading font-semibold">New {entityTerms.tag}</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !values.name.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium transition-all duration-fast btn-accent"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Create
        </button>
      </div>

      <StatusMessage type="error" message={error} />

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0 space-y-4">
          <TagForm values={values} onChange={setValues} />
        </div>
      </div>
    </div>
  );
}
