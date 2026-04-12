"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createPerformer, fetchTags, type TagItem } from "../lib/api";
import { PerformerForm, type PerformerFormValues } from "./performer-form";
import { entityTerms } from "../lib/terminology";
import { StatusMessage } from "./shared/status-message";

export function PerformerCreate() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<TagItem[]>([]);

  const [values, setValues] = useState<PerformerFormValues>({
    name: "",
    disambiguation: "",
    aliases: "",
    gender: "",
    birthdate: "",
    country: "",
    ethnicity: "",
    eyeColor: "",
    hairColor: "",
    height: "",
    weight: "",
    measurements: "",
    tattoos: "",
    piercings: "",
    careerStart: "",
    careerEnd: "",
    details: "",
    tagNames: [],
    isNsfw: false,
  });

  useEffect(() => {
    fetchTags().then((res) => setAllTags(res.tags)).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await createPerformer({
        name: values.name.trim(),
        disambiguation: values.disambiguation.trim() || null,
        aliases: values.aliases.trim() || null,
        gender: values.gender || null,
        birthdate: values.birthdate.trim() || null,
        country: values.country.trim() || null,
        ethnicity: values.ethnicity.trim() || null,
        eyeColor: values.eyeColor.trim() || null,
        hairColor: values.hairColor.trim() || null,
        height: values.height ? parseInt(values.height, 10) || null : null,
        weight: values.weight ? parseInt(values.weight, 10) || null : null,
        measurements: values.measurements.trim() || null,
        tattoos: values.tattoos.trim() || null,
        piercings: values.piercings.trim() || null,
        careerStart: values.careerStart ? parseInt(values.careerStart, 10) || null : null,
        careerEnd: values.careerEnd ? parseInt(values.careerEnd, 10) || null : null,
        details: values.details.trim() || null,
        isNsfw: values.isNsfw,
        tagNames: values.tagNames,
      });
      router.push(`/performers/${result.id}`);
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
            onClick={() => router.push("/performers")}
            className="inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </button>
          <h1 className="text-lg font-heading font-semibold">New {entityTerms.performer}</h1>
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
          <PerformerForm values={values} onChange={setValues} allTags={allTags} />
        </div>
      </div>
    </div>
  );
}
