"use client";

import { useState, useEffect } from "react";
import { useRef } from "react";
import {
  ArrowLeft,
  Save,
  Loader2,
  Wand2,
  Check,
  SkipForward,
  Tag,
  Upload,
  X,
} from "lucide-react";
import { Checkbox } from "@obscura/ui/primitives/checkbox";
import { cn } from "@obscura/ui/lib/utils";
import {
  fetchTagDetail,
  updateTag,
  uploadTagImage,
  deleteTagImage,
  fetchStashBoxEndpoints,
  lookupTagViaStashBox,
  toApiUrl,
  type TagDetail,
  type StashBoxEndpoint,
  type NormalizedTagScrapeResult,
} from "../lib/api";
import { StashIdChips, autoSaveStashId } from "./stash-id-chips";
import { TagForm, type TagFormValues } from "./tag-form";

interface TagEditProps {
  id: string;
  onSaved?: () => void;
  onCancel?: () => void;
}

export function TagEdit({ id, onSaved, onCancel }: TagEditProps) {
  const [tag, setTag] = useState<TagDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [aliases, setAliases] = useState("");
  const [isNsfw, setIsNsfw] = useState(false);

  // Image
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Scraper state
  const [endpoints, setEndpoints] = useState<StashBoxEndpoint[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState("");
  const [scraping, setScraping] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<NormalizedTagScrapeResult | null>(null);
  const [scrapeRemoteId, setScrapeRemoteId] = useState<string | null>(null);
  const [scrapeEndpointId, setScrapeEndpointId] = useState<string | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      fetchTagDetail(id),
      fetchStashBoxEndpoints().catch(() => ({ endpoints: [] })),
    ]).then(([t, epRes]) => {
      setTag(t);
      setName(t.name);
      setDescription(t.description ?? "");
      setAliases(t.aliases ?? "");
      setIsNsfw(t.isNsfw ?? false);

      const enabled = epRes.endpoints.filter((e) => e.enabled);
      setEndpoints(enabled);
      if (enabled.length > 0) setSelectedEndpoint(enabled[0].id);
      setLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Load failed");
      setLoading(false);
    });
  }, [id]);

  function normalizeResult(tags: Awaited<ReturnType<typeof lookupTagViaStashBox>>["tags"], query: string): {
    result: NormalizedTagScrapeResult | null;
    remoteId: string | null;
  } {
    if (!tags || tags.length === 0) return { result: null, remoteId: null };
    const lower = query.toLowerCase().trim();
    const match = tags.find((t) =>
      t.name.toLowerCase().trim() === lower ||
      t.aliases?.some((a) => a.toLowerCase().trim() === lower)
    );
    if (!match) return { result: null, remoteId: null };
    return {
      result: {
        name: match.name,
        description: match.description ?? null,
        aliases: match.aliases?.join(", ") ?? null,
      },
      remoteId: match.id,
    };
  }

  /** Build search variants: "1-on-1" → also try "1 on 1", etc. */
  function tagSearchVariants(tag: string): string[] {
    const variants = new Set([tag]);
    if (tag.includes("-")) variants.add(tag.replace(/-/g, " "));
    if (tag.includes("_")) variants.add(tag.replace(/_/g, " "));
    if (tag.includes(" ")) {
      variants.add(tag.replace(/ /g, "-"));
      variants.add(tag.replace(/ /g, "_"));
    }
    return Array.from(variants);
  }

  async function handleScrape() {
    if (!selectedEndpoint) return;
    setScraping(true);
    setError(null);
    setScrapeResult(null);
    setScrapeRemoteId(null);
    setScrapeEndpointId(null);
    try {
      // Try original name, then normalized variants
      for (const query of tagSearchVariants(name.trim())) {
        const res = await lookupTagViaStashBox(selectedEndpoint, query);
        const { result, remoteId } = normalizeResult(res.tags, query);
        if (result) {
          setScrapeResult(result);
          setScrapeRemoteId(remoteId);
          setScrapeEndpointId(selectedEndpoint);
          const fields = new Set<string>();
          if (result.description) fields.add("description");
          if (result.aliases) fields.add("aliases");
          // If the matched name differs from our tag name, auto-select it for rename
          if (result.name && result.name.toLowerCase() !== name.toLowerCase()) fields.add("name");
          setSelectedFields(fields);
          setScraping(false);
          return;
        }
      }
      setError("No results found");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setScraping(false);
    }
  }



  async function handleSeek() {
    if (endpoints.length === 0) return;
    setSeeking(true);
    setError(null);
    setScrapeResult(null);

    for (const ep of endpoints) {
      setSelectedEndpoint(ep.id);
      setMessage(`Trying ${ep.name}...`);
      for (const query of tagSearchVariants(name.trim())) {
        try {
          const res = await Promise.race([
            lookupTagViaStashBox(ep.id, query),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
          ]);
          const { result, remoteId } = normalizeResult(res.tags, query);
          if (result) {
            setScrapeResult(result);
            setScrapeRemoteId(remoteId);
            setScrapeEndpointId(ep.id);
            const fields = new Set<string>();
            if (result.description) fields.add("description");
            if (result.aliases) fields.add("aliases");
            if (result.name && result.name.toLowerCase() !== name.toLowerCase()) fields.add("name");
            setSelectedFields(fields);
            setMessage(`Found result from ${ep.name}`);
            setSeeking(false);
            return;
          }
        } catch {
          // next
        }
      }
    }
    setMessage(null);
    setError("No endpoints returned results");
    setSeeking(false);
  }

  async function handleApplyScrape() {
    if (!scrapeResult) return;
    setSaving(true);
    setError(null);
    try {
      const data: Record<string, unknown> = {};
      if (selectedFields.has("description") && scrapeResult.description) data.description = scrapeResult.description;
      if (selectedFields.has("aliases") && scrapeResult.aliases) data.aliases = scrapeResult.aliases;

      const updated = await updateTag(id, data);
      setTag(updated);
      setDescription(updated.description ?? "");
      setAliases(updated.aliases ?? "");

      if (scrapeEndpointId && scrapeRemoteId) {
        await autoSaveStashId("tag", id, scrapeEndpointId, scrapeRemoteId);
      }

      setScrapeResult(null);
      setMessage("Scrape result applied");
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateTag(id, {
        name: name.trim(),
        description: description.trim() || null,
        aliases: aliases.trim() || null,
        isNsfw,
      });
      setMessage("Changes saved");
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function toggleField(field: string) {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field); else next.add(field);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="surface-well p-16 flex items-center justify-center">
        <Loader2 className="h-7 w-7 text-text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 surface-well px-2.5 py-1 text-[0.72rem] text-text-muted hover:text-text-accent transition-colors duration-fast"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </button>
          <h1 className="text-lg font-heading font-semibold">Edit Tag</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors duration-fast">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium transition-all duration-fast",
              "bg-accent-950 text-text-accent border border-border-accent",
              "hover:bg-accent-900 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="surface-well border-l-2 border-status-error px-3 py-2 text-sm text-status-error">{error}</div>
      )}
      {message && (
        <div className="surface-well border-l-2 border-status-success px-3 py-2 text-sm text-status-success">{message}</div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column — image + scraper panel */}
        <div className="flex-shrink-0 lg:w-72 space-y-3">
          {/* Image */}
          {(() => {
            const displayUrl = tag?.imagePath ? toApiUrl(tag.imagePath) : tag?.imageUrl;
            return (
              <>
                <div className="relative aspect-square overflow-hidden bg-surface-3">
                  {displayUrl ? (
                    <img src={displayUrl} alt={name} className="absolute inset-0 w-full h-full object-contain" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Tag className="h-12 w-12 text-text-disabled/30" />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="flex-1 flex items-center justify-center gap-1.5 surface-well px-3 py-2 text-xs text-text-muted hover:text-text-accent transition-colors duration-fast"
                  >
                    {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    Upload
                  </button>
                  {displayUrl && (
                    <button
                      onClick={async () => {
                        setUploadingImage(true);
                        try { await deleteTagImage(id); const u = await fetchTagDetail(id); setTag(u); } catch {} finally { setUploadingImage(false); }
                      }}
                      disabled={uploadingImage}
                      className="flex items-center justify-center gap-1.5 surface-well px-3 py-2 text-xs text-text-muted hover:text-status-error transition-colors duration-fast"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  e.target.value = "";
                  setUploadingImage(true);
                  try { await uploadTagImage(id, file); const u = await fetchTagDetail(id); setTag(u); } catch {} finally { setUploadingImage(false); }
                }} />
              </>
            );
          })()}

          {/* Scraper panel */}
          {endpoints.length > 0 && (
            <div className="surface-well p-3 space-y-2">
              <div className="text-kicker">Identify via StashBox</div>
              <select
                value={selectedEndpoint}
                onChange={(e) => setSelectedEndpoint(e.target.value)}
                className="control-input w-full py-1.5 text-xs"
              >
                {endpoints.map((ep) => (
                  <option key={ep.id} value={ep.id}>{ep.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleScrape}
                  disabled={scraping || seeking}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs transition-all duration-fast",
                    "bg-accent-950 text-text-accent border border-border-accent hover:bg-accent-900 disabled:opacity-50"
                  )}
                >
                  {scraping ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                  Identify
                </button>
                <button
                  onClick={handleSeek}
                  disabled={scraping || seeking}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs transition-all duration-fast",
                    "text-text-muted border border-border-subtle hover:text-text-accent hover:border-border-accent disabled:opacity-50"
                  )}
                >
                  {seeking ? <Loader2 className="h-3 w-3 animate-spin" /> : <SkipForward className="h-3 w-3" />}
                  {seeking ? "Seeking..." : "Seek"}
                </button>
              </div>
            </div>
          )}

          {/* StashBox IDs */}
          <div className="surface-well p-3 space-y-2">
            <div className="text-kicker">StashBox IDs</div>
            <StashIdChips entityType="tag" entityId={id} compact />
          </div>
        </div>

        {/* Right column — form */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Scrape result preview */}
          {scrapeResult && (
            <div className="surface-well p-4 border-l-2 border-border-accent space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-kicker text-text-accent">Identify Result</div>
                <div className="flex gap-2">
                  <button onClick={() => setScrapeResult(null)} className="text-xs text-text-muted hover:text-text-primary transition-colors">
                    Dismiss
                  </button>
                  <button
                    onClick={handleApplyScrape}
                    disabled={saving || selectedFields.size === 0}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1 rounded text-xs transition-all duration-fast",
                      "bg-accent-950 text-text-accent border border-border-accent hover:bg-accent-900 disabled:opacity-50"
                    )}
                  >
                    <Check className="h-3 w-3" />
                    Apply Selected
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {scrapeResult.name && (
                  <ScrapeField field="name" label="Name" value={scrapeResult.name} enabled={selectedFields.has("name")} onToggle={() => toggleField("name")} />
                )}
                {scrapeResult.description && (
                  <ScrapeField field="description" label="Description" value={scrapeResult.description.slice(0, 200)} enabled={selectedFields.has("description")} onToggle={() => toggleField("description")} />
                )}
                {scrapeResult.aliases && (
                  <ScrapeField field="aliases" label="Aliases" value={scrapeResult.aliases} enabled={selectedFields.has("aliases")} onToggle={() => toggleField("aliases")} />
                )}
              </div>
            </div>
          )}

          <TagForm
            values={{ name, description, aliases, isNsfw }}
            onChange={(v) => {
              setName(v.name);
              setDescription(v.description);
              setAliases(v.aliases);
              setIsNsfw(v.isNsfw);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ScrapeField({
  field,
  label,
  value,
  enabled,
  onToggle,
}: {
  field: string;
  label: string;
  value: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn("flex items-start gap-2 cursor-pointer transition-opacity", !enabled && "opacity-40")}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
    >
      <Checkbox
        checked={enabled}
        onChange={() => onToggle()}
        onClick={(e) => e.stopPropagation()}
        className="mt-0.5 flex-shrink-0"
      />
      <div className="min-w-0">
        <span className="text-text-disabled text-[0.6rem] uppercase tracking-wider font-semibold">{label}</span>
        <p className={cn("truncate text-[0.78rem]", enabled ? "text-text-primary" : "text-text-disabled line-through")}>{value}</p>
      </div>
    </div>
  );
}
