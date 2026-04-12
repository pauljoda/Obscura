"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createStudio, fetchStudios, type StudioItem } from "../lib/api";
import { StudioForm, type StudioFormValues } from "./studio-form";
import { entityTerms } from "../lib/terminology";
import { StatusMessage } from "./shared/status-message";

export function StudioCreate() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allStudios, setAllStudios] = useState<StudioItem[]>([]);

  const [values, setValues] = useState<StudioFormValues>({
    name: "",
    url: "",
    description: "",
    aliases: "",
    isNsfw: false,
    parentId: null,
  });

  useEffect(() => {
    fetchStudios().then((res) => setAllStudios(res.studios)).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await createStudio({
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        aliases: values.aliases.trim() || undefined,
        url: values.url.trim() || undefined,
        parentId: values.parentId ?? undefined,
      });
      router.push(`/studios/${result.id}`);
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
            onClick={() => router.push("/studios")}
            className="inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </button>
          <h1 className="text-lg font-heading font-semibold">New {entityTerms.studio}</h1>
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
          <StudioForm values={values} onChange={setValues} allStudios={allStudios} />
        </div>
      </div>
    </div>
  );
}
