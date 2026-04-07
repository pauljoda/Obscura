"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Save,
  Loader2,
  X,
  Wand2,
  Star,
  Upload,
  Image as ImageIcon,
  Check,
  ChevronDown,
  Search,
  SkipForward,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@obscura/ui/lib/utils";
import {
  fetchPerformerDetail,
  updatePerformer,
  fetchInstalledScrapers,
  fetchStashBoxEndpoints,
  identifyPerformerViaStashBox,
  fetchTags,
  scrapePerformerApi,
  applyPerformerScrape,
  uploadPerformerImage,
  uploadPerformerImageFromUrl,
  deletePerformerImage,
  toApiUrl,
  type PerformerDetail,
  type ScraperPackage,
  type StashBoxEndpoint,
  type NormalizedPerformerScrapeResult,
  type TagItem,
} from "../lib/api";
import { ImagePickerModal } from "./image-picker-modal";
import { StashIdChips, autoSaveStashId } from "./stash-id-chips";

interface PerformerEditProps {
  id: string;
  onSaved?: () => void;
  onCancel?: () => void;
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

export function PerformerEdit({ id, onSaved, onCancel }: PerformerEditProps) {
  const [performer, setPerformer] = useState<PerformerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [disambiguation, setDisambiguation] = useState("");
  const [aliases, setAliases] = useState("");
  const [gender, setGender] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [country, setCountry] = useState("");
  const [ethnicity, setEthnicity] = useState("");
  const [eyeColor, setEyeColor] = useState("");
  const [hairColor, setHairColor] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [measurements, setMeasurements] = useState("");
  const [tattoos, setTattoos] = useState("");
  const [piercings, setPiercings] = useState("");
  const [careerStart, setCareerStart] = useState("");
  const [careerEnd, setCareerEnd] = useState("");
  const [details, setDetails] = useState("");
  const [tagNames, setTagNames] = useState<string[]>([]);

  // Scraper state
  const [scrapers, setScrapers] = useState<ScraperPackage[]>([]);
  const [stashBoxEndpoints, setStashBoxEndpoints] = useState<StashBoxEndpoint[]>([]);
  const [selectedProvider, setSelectedProvider] = useState(""); // "scraper:id" or "stashbox:id"
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<NormalizedPerformerScrapeResult | null>(null);
  const [scrapeRemoteId, setScrapeRemoteId] = useState<string | null>(null); // stashbox remote ID
  const [scrapeEndpointId, setScrapeEndpointId] = useState<string | null>(null); // stashbox endpoint ID
  const [selectedScrapeFields, setSelectedScrapeFields] = useState<Set<string>>(new Set());
  const [seekIndex, setSeekIndex] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

  // Image upload
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Tags
  const [allTags, setAllTags] = useState<TagItem[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchPerformerDetail(id),
      fetchInstalledScrapers(),
      fetchStashBoxEndpoints().catch(() => ({ endpoints: [] })),
      fetchTags(),
    ]).then(([p, s, sbRes, t]) => {
      setPerformer(p);
      // Initialize form
      setName(p.name);
      setDisambiguation(p.disambiguation ?? "");
      setAliases(p.aliases ?? "");
      setGender(p.gender ?? "");
      setBirthdate(p.birthdate ?? "");
      setCountry(p.country ?? "");
      setEthnicity(p.ethnicity ?? "");
      setEyeColor(p.eyeColor ?? "");
      setHairColor(p.hairColor ?? "");
      setHeight(p.height != null ? String(p.height) : "");
      setWeight(p.weight != null ? String(p.weight) : "");
      setMeasurements(p.measurements ?? "");
      setTattoos(p.tattoos ?? "");
      setPiercings(p.piercings ?? "");
      setCareerStart(p.careerStart != null ? String(p.careerStart) : "");
      setCareerEnd(p.careerEnd != null ? String(p.careerEnd) : "");
      setDetails(p.details ?? "");
      setTagNames(p.tags?.map((t) => t.name) ?? []);

      // Filter scrapers with performer capabilities
      const perfScrapers = s.packages.filter((pkg) => {
        const caps = pkg.capabilities as Record<string, boolean> | null;
        return caps && (caps.performerByURL || caps.performerByName || caps.performerByFragment);
      });
      setScrapers(perfScrapers);

      // StashBox endpoints
      const enabledEndpoints = sbRes.endpoints.filter((e) => e.enabled);
      setStashBoxEndpoints(enabledEndpoints);

      // Set default provider: first stashbox, then first scraper
      if (enabledEndpoints.length > 0) {
        setSelectedProvider(`stashbox:${enabledEndpoints[0].id}`);
      } else if (perfScrapers.length > 0) {
        setSelectedProvider(`scraper:${perfScrapers[0].id}`);
      }

      setAllTags(t.tags);
      setLoading(false);
    }).catch((err) => {
      setError(err.message);
      setLoading(false);
    });
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updatePerformer(id, {
        name: name.trim(),
        disambiguation: disambiguation.trim() || null,
        aliases: aliases.trim() || null,
        gender: gender || null,
        birthdate: birthdate.trim() || null,
        country: country.trim() || null,
        ethnicity: ethnicity.trim() || null,
        eyeColor: eyeColor.trim() || null,
        hairColor: hairColor.trim() || null,
        height: height ? parseInt(height, 10) || null : null,
        weight: weight ? parseInt(weight, 10) || null : null,
        measurements: measurements.trim() || null,
        tattoos: tattoos.trim() || null,
        piercings: piercings.trim() || null,
        careerStart: careerStart ? parseInt(careerStart, 10) || null : null,
        careerEnd: careerEnd ? parseInt(careerEnd, 10) || null : null,
        details: details.trim() || null,
        tagNames,
      });
      setMessage("Changes saved");
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function applyScrapeResultToPreview(result: NormalizedPerformerScrapeResult) {
    setScrapeResult(result);
    setSelectedImageIndex(0);
    const fields = new Set<string>();
    for (const [key, value] of Object.entries(result)) {
      if (value != null && value !== "" && key !== "tagNames" && key !== "imageUrls") {
        fields.add(key);
      }
    }
    if (result.tagNames?.length) fields.add("tagNames");
    // Auto-select imageUrl if images are available
    if (result.imageUrls?.length || result.imageUrl) fields.add("imageUrl");
    setSelectedScrapeFields(fields);
  }

  async function handleScrape() {
    if (!selectedProvider) return;
    setScraping(true);
    setError(null);
    setScrapeResult(null);
    setScrapeRemoteId(null);
    setScrapeEndpointId(null);

    const isStashBox = selectedProvider.startsWith("stashbox:");
    const realId = selectedProvider.replace(/^(stashbox|scraper):/, "");

    try {
      if (isStashBox) {
        const res = await identifyPerformerViaStashBox(realId, id);
        if (res.results && res.results.length > 0) {
          // Prefer exact name match
          const performerName = name.toLowerCase().trim();
          const exact = res.results.find(
            (r) => r.name?.toLowerCase().trim() === performerName
          );
          const result = exact ?? res.results[0];
          applyScrapeResultToPreview(result);
          // Store remote stashbox ID if available from raw results
          setScrapeEndpointId(realId);
        } else {
          setError(res.message || "No results found");
        }
      } else {
        const res = await scrapePerformerApi(realId, id);
        const result = res.result ?? res.results?.[0] ?? null;
        if (result) {
          applyScrapeResultToPreview(result);
        } else {
          setError(res.message || "Scraper returned no results");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scrape failed");
    } finally {
      setScraping(false);
    }
  }

  async function handleSeek() {
    const totalProviders = stashBoxEndpoints.length + scrapers.length;
    if (totalProviders === 0) return;
    setSeeking(true);
    setError(null);
    setScrapeResult(null);
    setScrapeRemoteId(null);
    setScrapeEndpointId(null);

    const performerName = name.toLowerCase().trim();

    // Try StashBox endpoints first (higher confidence)
    for (const ep of stashBoxEndpoints) {
      setSelectedProvider(`stashbox:${ep.id}`);
      setMessage(`Trying ${ep.name}...`);
      try {
        const res = await Promise.race([
          identifyPerformerViaStashBox(ep.id, id),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 5000)
          ),
        ]);
        if (res?.results && res.results.length > 0) {
          const exact = res.results.find(
            (r) => r.name?.toLowerCase().trim() === performerName
          );
          if (exact) {
            applyScrapeResultToPreview(exact);
            setScrapeEndpointId(ep.id);
            setMessage(`Found result from ${ep.name}`);
            setSeeking(false);
            return;
          }
        }
      } catch {
        // Timeout or error — try next
      }
    }

    // Fall back to community scrapers
    let idx = seekIndex;
    let tried = 0;
    while (tried < scrapers.length) {
      const scraper = scrapers[idx];
      setSelectedProvider(`scraper:${scraper.id}`);
      setMessage(`Trying ${scraper.name}...`);

      try {
        const res = await Promise.race([
          scrapePerformerApi(scraper.id, id),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 5000)
          ),
        ]);
        if (res) {
          const result = res.result ?? res.results?.[0] ?? null;
          if (result) {
            applyScrapeResultToPreview(result);
            setMessage(`Found result from ${scraper.name}`);
            setSeekIndex((idx + 1) % scrapers.length);
            setSeeking(false);
            return;
          }
        }
      } catch {
        // Scraper failed or timed out — continue to next
      }

      idx = (idx + 1) % scrapers.length;
      tried++;
    }

    setMessage(null);
    setError("No providers returned results");
    setSeekIndex(0);
    setSeeking(false);
  }

  async function handleApplyScrape() {
    if (!scrapeResult) return;
    setSaving(true);
    setError(null);
    try {
      // Use the selected image from the image picker
      const fieldsToSend = { ...scrapeResult } as Record<string, unknown>;
      const images = scrapeResult.imageUrls ?? [];
      if (images.length > 0 && selectedScrapeFields.has("imageUrl")) {
        fieldsToSend.imageUrl = images[selectedImageIndex] ?? images[0];
      }
      await applyPerformerScrape(
        id,
        fieldsToSend,
        Array.from(selectedScrapeFields)
      );
      // Refresh the performer data
      const updated = await fetchPerformerDetail(id);
      setPerformer(updated);
      // Re-populate form
      setName(updated.name);
      setDisambiguation(updated.disambiguation ?? "");
      setAliases(updated.aliases ?? "");
      setGender(updated.gender ?? "");
      setBirthdate(updated.birthdate ?? "");
      setCountry(updated.country ?? "");
      setEthnicity(updated.ethnicity ?? "");
      setEyeColor(updated.eyeColor ?? "");
      setHairColor(updated.hairColor ?? "");
      setHeight(updated.height != null ? String(updated.height) : "");
      setWeight(updated.weight != null ? String(updated.weight) : "");
      setMeasurements(updated.measurements ?? "");
      setTattoos(updated.tattoos ?? "");
      setPiercings(updated.piercings ?? "");
      setCareerStart(updated.careerStart != null ? String(updated.careerStart) : "");
      setCareerEnd(updated.careerEnd != null ? String(updated.careerEnd) : "");
      setDetails(updated.details ?? "");
      setTagNames(updated.tags?.map((t) => t.name) ?? []);

      // Auto-save stash ID if this came from a stashbox endpoint
      if (scrapeEndpointId && scrapeRemoteId) {
        await autoSaveStashId("performer", id, scrapeEndpointId, scrapeRemoteId);
      }

      setScrapeResult(null);
      setScrapeRemoteId(null);
      setScrapeEndpointId(null);
      setMessage("Scrape result applied");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply scrape");
    } finally {
      setSaving(false);
    }
  }

  async function handleImageUpload(file: File) {
    setUploadingImage(true);
    setError(null);
    try {
      await uploadPerformerImage(id, file);
      const updated = await fetchPerformerDetail(id);
      setPerformer(updated);
      setMessage("Image updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleDeleteImage() {
    setUploadingImage(true);
    setError(null);
    try {
      await deletePerformerImage(id);
      const updated = await fetchPerformerDetail(id);
      setPerformer(updated);
      setMessage("Image removed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove image");
    } finally {
      setUploadingImage(false);
    }
  }

  function toggleScrapeField(field: string) {
    setSelectedScrapeFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }

  function addTag(tagName: string) {
    const trimmed = tagName.trim();
    if (!trimmed) return;
    if (!tagNames.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setTagNames([...tagNames, trimmed]);
    }
    setTagInput("");
    setShowTagDropdown(false);
  }

  function removeTag(index: number) {
    setTagNames(tagNames.filter((_, i) => i !== index));
  }

  const availableTags = allTags.filter(
    (t) => !tagNames.some((tn) => tn.toLowerCase() === t.name.toLowerCase())
  );
  const filteredTags = tagInput.trim()
    ? availableTags.filter((t) => t.name.toLowerCase().includes(tagInput.toLowerCase()))
    : availableTags;

  if (loading) {
    return (
      <div className="surface-well p-16 flex items-center justify-center">
        <Loader2 className="h-7 w-7 text-text-accent animate-spin" />
      </div>
    );
  }

  const imageUrl = performer ? toApiUrl(performer.imagePath) : undefined;

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
          <h1 className="text-lg font-heading font-semibold">Edit Performer</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary transition-colors duration-fast"
          >
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
        <div className="surface-well border-l-2 border-status-error px-3 py-2 text-sm text-status-error">
          {error}
        </div>
      )}
      {message && (
        <div className="surface-well border-l-2 border-status-success px-3 py-2 text-sm text-status-success">
          {message}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column — image */}
        <div className="flex-shrink-0 lg:w-72 space-y-3">
          {/* Portrait image */}
          <div className="relative aspect-[3/4] overflow-hidden bg-surface-3">
            {imageUrl ? (
              <img src={imageUrl} alt={name} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <ImageIcon className="h-12 w-12 text-text-disabled/30" />
              </div>
            )}
          </div>

          {/* Image actions */}
          <div className="flex gap-2">
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={uploadingImage}
              className="flex-1 flex items-center justify-center gap-1.5 surface-well px-3 py-2 text-xs text-text-muted hover:text-text-accent transition-colors duration-fast"
            >
              {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Upload
            </button>
            {imageUrl && (
              <button
                onClick={handleDeleteImage}
                disabled={uploadingImage}
                className="flex items-center justify-center gap-1.5 surface-well px-3 py-2 text-xs text-text-muted hover:text-status-error transition-colors duration-fast"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
              e.target.value = "";
            }}
          />

          {/* Scraper panel */}
          {(scrapers.length > 0 || stashBoxEndpoints.length > 0) && (
            <div className="surface-well p-3 space-y-2">
              <div className="text-kicker">Scrape Metadata</div>
              <select
                value={selectedProvider}
                onChange={(e) => {
                  setSelectedProvider(e.target.value);
                  if (e.target.value.startsWith("scraper:")) {
                    const scraperId = e.target.value.replace("scraper:", "");
                    setSeekIndex(scrapers.findIndex((s) => s.id === scraperId));
                  }
                }}
                className="control-input w-full py-1.5 text-xs"
              >
                {stashBoxEndpoints.length > 0 && (
                  <optgroup label="Stash-Box">
                    {stashBoxEndpoints.map((ep) => (
                      <option key={`stashbox:${ep.id}`} value={`stashbox:${ep.id}`}>{ep.name}</option>
                    ))}
                  </optgroup>
                )}
                {scrapers.length > 0 && (
                  <optgroup label="Community Scrapers">
                    {scrapers.map((s) => (
                      <option key={`scraper:${s.id}`} value={`scraper:${s.id}`}>{s.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleScrape}
                  disabled={scraping || seeking || !selectedProvider}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs transition-all duration-fast",
                    "bg-accent-950 text-text-accent border border-border-accent",
                    "hover:bg-accent-900 disabled:opacity-50"
                  )}
                >
                  {scraping ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                  Scrape
                </button>
                <button
                  onClick={handleSeek}
                  disabled={scraping || seeking}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs transition-all duration-fast",
                    "text-text-muted border border-border-subtle",
                    "hover:text-text-accent hover:border-border-accent disabled:opacity-50"
                  )}
                >
                  {seeking ? <Loader2 className="h-3 w-3 animate-spin" /> : <SkipForward className="h-3 w-3" />}
                  {seeking ? "Seeking..." : "Seek"}
                </button>
              </div>
              <p className="text-[0.6rem] text-text-disabled leading-snug">
                Seek tries each provider until one returns results
              </p>
            </div>
          )}

          {/* StashBox IDs */}
          <div className="surface-well p-3 space-y-2">
            <div className="text-kicker">StashBox IDs</div>
            <StashIdChips entityType="performer" entityId={id} compact />
          </div>
        </div>

        {/* Right column — form fields */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Scrape result preview */}
          {scrapeResult && (
            <div className="surface-well p-4 border-l-2 border-border-accent space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-kicker text-text-accent">Scrape Result</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setScrapeResult(null)}
                    className="text-xs text-text-muted hover:text-text-primary transition-colors"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={handleApplyScrape}
                    disabled={saving || selectedScrapeFields.size === 0}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1 rounded text-xs transition-all duration-fast",
                      "bg-accent-950 text-text-accent border border-border-accent",
                      "hover:bg-accent-900 disabled:opacity-50"
                    )}
                  >
                    <Check className="h-3 w-3" />
                    Apply Selected
                  </button>
                </div>
              </div>
              {/* Image picker */}
              {(() => {
                const images = scrapeResult.imageUrls ?? [];
                const allImages = images.length > 0 ? images : scrapeResult.imageUrl ? [scrapeResult.imageUrl] : [];
                if (allImages.length === 0) return null;

                const currentImage = allImages[selectedImageIndex] ?? allImages[0];

                return (
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => toggleScrapeField("imageUrl")}
                      className={cn(
                        "flex-shrink-0 mt-1 h-4 w-4 rounded border transition-colors",
                        selectedScrapeFields.has("imageUrl")
                          ? "bg-accent-800 border-border-accent"
                          : "border-border-subtle"
                      )}
                    >
                      {selectedScrapeFields.has("imageUrl") && <Check className="h-3 w-3 text-text-accent mx-auto" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[0.65rem] text-text-disabled uppercase tracking-wider">
                          Image{allImages.length > 1 ? ` (${selectedImageIndex + 1} of ${allImages.length})` : ""}
                        </span>
                        {allImages.length > 1 && (
                          <button
                            onClick={() => setImagePickerOpen(true)}
                            className="text-[0.6rem] text-text-accent hover:text-text-accent-bright transition-colors"
                          >
                            Browse all
                          </button>
                        )}
                      </div>
                      {/* Selected image preview — click to open large view */}
                      <button
                        onClick={() => setImagePickerOpen(true)}
                        className="w-24 h-32 rounded overflow-hidden bg-surface-3 border-2 border-border-accent/40 hover:border-border-accent transition-all duration-fast"
                      >
                        <img src={currentImage} alt="Selected" className="w-full h-full object-cover" loading="lazy" />
                      </button>
                      {/* Thumbnail strip for quick selection */}
                      {allImages.length > 1 && (
                        <div className="flex gap-1.5 mt-2 overflow-x-auto scrollbar-hidden pb-1">
                          {allImages.map((url, i) => (
                            <button
                              key={i}
                              onClick={() => setSelectedImageIndex(i)}
                              className={cn(
                                "flex-shrink-0 w-10 h-14 rounded overflow-hidden bg-surface-3 border transition-all duration-fast",
                                i === selectedImageIndex
                                  ? "border-border-accent"
                                  : "border-transparent opacity-50 hover:opacity-80"
                              )}
                            >
                              <img src={url} alt={`${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Image picker modal */}
              {imagePickerOpen && scrapeResult && (() => {
                const images = scrapeResult.imageUrls ?? [];
                const allImages = images.length > 0 ? images : scrapeResult.imageUrl ? [scrapeResult.imageUrl] : [];
                if (allImages.length === 0) return null;

                return (
                  <ImagePickerModal
                    images={allImages}
                    selectedIndex={selectedImageIndex}
                    onSelect={setSelectedImageIndex}
                    onClose={() => setImagePickerOpen(false)}
                    title="Select Performer Image"
                  />
                );
              })()}

              {/* Other fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(scrapeResult).map(([key, value]) => {
                  // Skip image fields (handled above) and imageUrls array
                  if (key === "imageUrl" || key === "imageUrls") return null;
                  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return null;
                  const displayValue = Array.isArray(value) ? value.join(", ") : String(value);
                  return (
                    <div key={key} className="flex items-start gap-2">
                      <button
                        onClick={() => toggleScrapeField(key)}
                        className={cn(
                          "flex-shrink-0 mt-1 h-4 w-4 rounded border transition-colors",
                          selectedScrapeFields.has(key)
                            ? "bg-accent-800 border-border-accent"
                            : "border-border-subtle"
                        )}
                      >
                        {selectedScrapeFields.has(key) && <Check className="h-3 w-3 text-text-accent mx-auto" />}
                      </button>
                      <div className="min-w-0">
                        <div className="text-[0.65rem] text-text-disabled uppercase tracking-wider">{formatFieldName(key)}</div>
                        <div className="text-xs text-text-secondary truncate">{displayValue}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form fields */}
          <div className="surface-well p-4 space-y-4">
            <div className="text-kicker mb-1">Basic Info</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldInput label="Name" value={name} onChange={setName} required />
              <FieldInput label="Disambiguation" value={disambiguation} onChange={setDisambiguation} />
              <FieldInput label="Aliases" value={aliases} onChange={setAliases} className="col-span-full" placeholder="Comma-separated" />
              <div>
                <label className="text-[0.68rem] text-text-muted font-medium mb-1 block">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="control-input w-full py-1.5 text-sm"
                >
                  {genderOptions.map((g) => (
                    <option key={g} value={g}>{g || "Not specified"}</option>
                  ))}
                </select>
              </div>
              <FieldInput label="Country" value={country} onChange={setCountry} />
            </div>
          </div>

          <div className="surface-well p-4 space-y-4">
            <div className="text-kicker mb-1">Physical Details</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldInput label="Birthdate" value={birthdate} onChange={setBirthdate} placeholder="YYYY-MM-DD" />
              <FieldInput label="Ethnicity" value={ethnicity} onChange={setEthnicity} />
              <FieldInput label="Height (cm)" value={height} onChange={setHeight} type="number" />
              <FieldInput label="Weight (kg)" value={weight} onChange={setWeight} type="number" />
              <FieldInput label="Measurements" value={measurements} onChange={setMeasurements} />
              <FieldInput label="Eye Color" value={eyeColor} onChange={setEyeColor} />
              <FieldInput label="Hair Color" value={hairColor} onChange={setHairColor} />
            </div>
          </div>

          <div className="surface-well p-4 space-y-4">
            <div className="text-kicker mb-1">Career & Body Art</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldInput label="Career Start" value={careerStart} onChange={setCareerStart} type="number" placeholder="Year" />
              <FieldInput label="Career End" value={careerEnd} onChange={setCareerEnd} type="number" placeholder="Year" />
              <FieldInput label="Tattoos" value={tattoos} onChange={setTattoos} className="col-span-full" />
              <FieldInput label="Piercings" value={piercings} onChange={setPiercings} className="col-span-full" />
            </div>
          </div>

          <div className="surface-well p-4 space-y-3">
            <div className="text-kicker mb-1">Tags</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tagNames.map((tag, i) => (
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
              {showTagDropdown && filteredTags.length > 0 && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowTagDropdown(false)} />
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 surface-elevated max-h-40 overflow-y-auto py-1">
                    {filteredTags.slice(0, 20).map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => addTag(tag.name)}
                        className="w-full px-3 py-1.5 text-xs text-left text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
                      >
                        {tag.name}
                        <span className="ml-2 text-text-disabled">{tag.sceneCount}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="surface-well p-4 space-y-3">
            <div className="text-kicker mb-1">Biography</div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              className="control-input w-full py-2 text-sm resize-y"
              placeholder="Performer biography..."
            />
          </div>
        </div>
      </div>
    </div>
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

function formatFieldName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}
