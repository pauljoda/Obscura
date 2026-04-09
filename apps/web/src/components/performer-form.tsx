"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { NsfwEditToggle, NsfwTagLabel, tagsVisibleInNsfwMode } from "./nsfw/nsfw-gate";
import { useNsfw } from "./nsfw/nsfw-context";
import { useTerms } from "../lib/terminology";
import type { TagItem } from "../lib/api";

export interface PerformerFormValues {
  name: string;
  disambiguation: string;
  aliases: string;
  gender: string;
  birthdate: string;
  country: string;
  ethnicity: string;
  eyeColor: string;
  hairColor: string;
  height: string;
  weight: string;
  measurements: string;
  tattoos: string;
  piercings: string;
  careerStart: string;
  careerEnd: string;
  details: string;
  tagNames: string[];
  isNsfw: boolean;
}

const genderOptions = [
  "",
  "Female",
  "Male",
  "Transgender Female",
  "Transgender Male",
  "Intersex",
  "Non-Binary",
];

interface PerformerFormProps {
  values: PerformerFormValues;
  onChange: (values: PerformerFormValues) => void;
  allTags: TagItem[];
}

export function PerformerForm({ values, onChange, allTags }: PerformerFormProps) {
  const terms = useTerms();
  const { mode: nsfwMode } = useNsfw();
  const [tagInput, setTagInput] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  function set<K extends keyof PerformerFormValues>(key: K, val: PerformerFormValues[K]) {
    onChange({ ...values, [key]: val });
  }

  function addTag(tagName: string) {
    const trimmed = tagName.trim();
    if (!trimmed) return;
    if (!values.tagNames.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      set("tagNames", [...values.tagNames, trimmed]);
    }
    setTagInput("");
    setShowTagDropdown(false);
  }

  function removeTag(index: number) {
    set("tagNames", values.tagNames.filter((_, i) => i !== index));
  }

  const availableTags = allTags.filter(
    (t) => !values.tagNames.some((tn) => tn.toLowerCase() === t.name.toLowerCase())
  );
  const filteredTags = tagInput.trim()
    ? availableTags.filter((t) => t.name.toLowerCase().includes(tagInput.toLowerCase()))
    : availableTags;
  const tagPickerSuggestions = tagsVisibleInNsfwMode(filteredTags, nsfwMode);

  return (
    <>
      {/* Basic Info */}
      <div className="surface-well p-4 space-y-4">
        <div className="text-kicker mb-1">Basic Info</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldInput label="Name" value={values.name} onChange={(v) => set("name", v)} required />
          <FieldInput label="Disambiguation" value={values.disambiguation} onChange={(v) => set("disambiguation", v)} />
          <FieldInput label="Aliases" value={values.aliases} onChange={(v) => set("aliases", v)} className="col-span-full" placeholder="Comma-separated" />
          <div>
            <label className="text-[0.68rem] text-text-muted font-medium mb-1 block">Gender</label>
            <select
              value={values.gender}
              onChange={(e) => set("gender", e.target.value)}
              className="control-input w-full py-1.5 text-sm"
            >
              {genderOptions.map((g) => (
                <option key={g} value={g}>{g || "Not specified"}</option>
              ))}
            </select>
          </div>
          <FieldInput label="Country" value={values.country} onChange={(v) => set("country", v)} />
          <div className="col-span-full flex items-center gap-3">
            <NsfwEditToggle value={values.isNsfw} onChange={(v) => set("isNsfw", v)} />
            {values.isNsfw && <span className="text-[0.68rem] text-text-muted">This performer will be hidden in SFW mode</span>}
          </div>
        </div>
      </div>

      {/* Physical Details */}
      <div className="surface-well p-4 space-y-4">
        <div className="text-kicker mb-1">Physical Details</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldInput label="Birthdate" value={values.birthdate} onChange={(v) => set("birthdate", v)} placeholder="YYYY-MM-DD" />
          <FieldInput label="Ethnicity" value={values.ethnicity} onChange={(v) => set("ethnicity", v)} />
          <FieldInput label="Height (cm)" value={values.height} onChange={(v) => set("height", v)} type="number" />
          <FieldInput label="Weight (kg)" value={values.weight} onChange={(v) => set("weight", v)} type="number" />
          <FieldInput label="Measurements" value={values.measurements} onChange={(v) => set("measurements", v)} />
          <FieldInput label="Eye Color" value={values.eyeColor} onChange={(v) => set("eyeColor", v)} />
          <FieldInput label="Hair Color" value={values.hairColor} onChange={(v) => set("hairColor", v)} />
        </div>
      </div>

      {/* Career & Body Art */}
      <div className="surface-well p-4 space-y-4">
        <div className="text-kicker mb-1">Career & Body Art</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FieldInput label="Career Start" value={values.careerStart} onChange={(v) => set("careerStart", v)} type="number" placeholder="Year" />
          <FieldInput label="Career End" value={values.careerEnd} onChange={(v) => set("careerEnd", v)} type="number" placeholder="Year" />
          <FieldInput label="Tattoos" value={values.tattoos} onChange={(v) => set("tattoos", v)} className="col-span-full" />
          <FieldInput label="Piercings" value={values.piercings} onChange={(v) => set("piercings", v)} className="col-span-full" />
        </div>
      </div>

      {/* Tags */}
      <div className="surface-well p-4 space-y-3">
        <div className="text-kicker mb-1">Tags</div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {values.tagNames.map((tag, i) => (
            <span key={tag} className="inline-flex items-center gap-1 tag-chip tag-chip-default">
              {tag}
              <button onClick={() => removeTag(i)} className="text-text-disabled hover:text-text-primary">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="relative">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => {
              setTagInput(e.target.value);
              setShowTagDropdown(true);
            }}
            onFocus={() => setShowTagDropdown(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tagInput.trim()) {
                e.preventDefault();
                addTag(tagInput);
              }
            }}
            placeholder="Add tag..."
            className="control-input w-full py-1.5 text-sm"
          />
          {showTagDropdown && tagPickerSuggestions.length > 0 && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowTagDropdown(false)} />
              <div className="absolute left-0 right-0 top-full mt-1 z-50 surface-elevated max-h-40 overflow-y-auto py-1">
                {tagPickerSuggestions.slice(0, 20).map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => addTag(tag.name)}
                    className="w-full px-3 py-1.5 text-xs text-left text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
                  >
                    <NsfwTagLabel isNsfw={tag.isNsfw}>{tag.name}</NsfwTagLabel>
                    <span className="ml-2 text-text-disabled">{tag.sceneCount}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Biography */}
      <div className="surface-well p-4 space-y-3">
        <div className="text-kicker mb-1">Biography</div>
        <textarea
          value={values.details}
          onChange={(e) => set("details", e.target.value)}
          rows={4}
          className="control-input w-full py-2 text-sm resize-y"
          placeholder={`${terms.performer} biography...`}
        />
      </div>
    </>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  className,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-[0.68rem] text-text-muted font-medium mb-1 block">
        {label}
        {required && <span className="text-status-error ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="control-input w-full py-1.5 text-sm"
      />
    </div>
  );
}
