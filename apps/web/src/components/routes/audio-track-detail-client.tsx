"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Star,
  ChevronLeft,
  Pencil,
  Save,
  XCircle,
  CheckCircle2,
  FolderPlus,
  Music,
  Clock,
  Disc3,
  Headphones,
} from "lucide-react";
import { cn } from "@obscura/ui/lib/utils";
import type { AudioTrackDetailDto } from "@obscura/contracts";
import {
  toApiUrl,
  updateAudioTrack,
  type TagItem,
  type PerformerItem,
} from "../../lib/api";
import { NsfwChip, NsfwEditToggle, NsfwTagLabel, tagsVisibleInNsfwMode } from "../nsfw/nsfw-gate";
import { useNsfw } from "../nsfw/nsfw-context";
import { useTerms } from "../../lib/terminology";
import { AddToCollectionModal } from "../collections/add-to-collection-modal";
import { ChipInput } from "../shared/chip-input";
import { AudioPlayer } from "../audio/audio-player";
import { usePlaylistContext } from "../collections/playlist-context";

interface AudioTrackDetailClientProps {
  track: AudioTrackDetailDto;
  availableTags?: TagItem[];
  availablePerformers?: PerformerItem[];
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

function formatBitRate(bps: number | null): string {
  if (!bps) return "—";
  return `${Math.round(bps / 1000)} kbps`;
}

export function AudioTrackDetailClient({
  track: initialTrack,
  availableTags = [],
  availablePerformers = [],
}: AudioTrackDetailClientProps) {
  const terms = useTerms();
  const { mode: nsfwMode } = useNsfw();
  const playlist = usePlaylistContext();
  const [track, setTrack] = useState(initialTrack);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);

  // Edit state
  const [editRating, setEditRating] = useState<number | null>(track.rating);
  const [editOrganized, setEditOrganized] = useState(track.organized);
  const [editIsNsfw, setEditIsNsfw] = useState(track.isNsfw ?? false);
  const [editTags, setEditTags] = useState(track.tags.map((t) => t.name));
  const [editPerformers, setEditPerformers] = useState(track.performers.map((p) => p.name));

  const tagsVisible = tagsVisibleInNsfwMode(track.tags, nsfwMode);
  const isCurrentPlaylistItem = playlist.isActive && playlist.isPlaylistItem("audio-track", track.id);

  // Auto-play when arriving from playlist
  useEffect(() => {
    if (isCurrentPlaylistItem) {
      setActiveTrackId(track.id);
    }
  }, [isCurrentPlaylistItem, track.id]);

  // Wrap track in an array for AudioPlayer
  const trackList = useMemo(() => [track], [track]);

  const startEdit = useCallback(() => {
    setEditRating(track.rating);
    setEditOrganized(track.organized);
    setEditIsNsfw(track.isNsfw ?? false);
    setEditTags(track.tags.map((t) => t.name));
    setEditPerformers(track.performers.map((p) => p.name));
    setEditing(true);
  }, [track]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateAudioTrack(track.id, {
        rating: editRating,
        organized: editOrganized,
        isNsfw: editIsNsfw,
        tagNames: editTags,
        performerNames: editPerformers,
      });
      // Optimistic update
      setTrack((prev) => ({
        ...prev,
        rating: editRating,
        organized: editOrganized,
        isNsfw: editIsNsfw,
      }));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [track.id, editRating, editOrganized, editIsNsfw, editTags, editPerformers]);

  const handleRatingClick = useCallback(
    (value: number) => {
      if (editing) {
        setEditRating((prev) => (prev === value ? null : value));
      } else {
        const newRating = track.rating === value ? null : value;
        void updateAudioTrack(track.id, { rating: newRating });
        setTrack((prev) => ({ ...prev, rating: newRating }));
      }
    },
    [editing, track.id, track.rating],
  );

  const handleTrackEnd = useCallback(() => {
    if (isCurrentPlaylistItem) {
      playlist.reportContentEnded("audio-track", track.id);
    }
  }, [isCurrentPlaylistItem, playlist, track.id]);

  const displayRating = editing ? editRating : track.rating;

  return (
    <div className="space-y-4">
      {/* Back link */}
      {track.libraryId ? (
        <Link
          href={`/audio/${track.libraryId}`}
          className="inline-flex items-center gap-1 text-[0.78rem] text-text-muted hover:text-text-secondary transition-colors duration-fast"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Library
        </Link>
      ) : (
        <Link
          href="/audio"
          className="inline-flex items-center gap-1 text-[0.78rem] text-text-muted hover:text-text-secondary transition-colors duration-fast"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Audio
        </Link>
      )}

      {/* Player */}
      <div className="surface-card overflow-hidden">
        <AudioPlayer
          tracks={trackList}
          activeTrackId={activeTrackId}
          onTrackChange={setActiveTrackId}
          onPlaybackComplete={handleTrackEnd}
        />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="flex items-center gap-2.5">
            <Music className="h-5 w-5 text-text-accent" />
            {track.title}
          </h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {track.embeddedArtist && (
              <span className="text-[0.78rem] text-text-secondary">
                {track.embeddedArtist}
              </span>
            )}
            {track.embeddedAlbum && (
              <span className="text-[0.75rem] text-text-muted">
                {track.embeddedAlbum}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setCollectionModalOpen(true)}
            className="p-1.5 text-text-muted hover:text-text-accent transition-colors"
            title="Add to collection"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
          {!editing && (
            <button
              onClick={startEdit}
              className="p-1.5 text-text-muted hover:text-text-accent transition-colors"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Technical info row */}
      <div className="flex items-center gap-4 flex-wrap text-[0.75rem] text-text-muted">
        {track.duration != null && (
          <span className="inline-flex items-center gap-1 font-mono">
            <Clock className="h-3 w-3" />
            {formatDuration(track.duration)}
          </span>
        )}
        {track.codec && (
          <span className="inline-flex items-center gap-1 font-mono uppercase">
            <Disc3 className="h-3 w-3" />
            {track.codec}
          </span>
        )}
        {track.bitRate && (
          <span className="font-mono">{formatBitRate(track.bitRate)}</span>
        )}
        {track.sampleRate && (
          <span className="font-mono">{(track.sampleRate / 1000).toFixed(1)} kHz</span>
        )}
        {track.channels && (
          <span className="inline-flex items-center gap-1 font-mono">
            <Headphones className="h-3 w-3" />
            {track.channels === 1 ? "Mono" : track.channels === 2 ? "Stereo" : `${track.channels}ch`}
          </span>
        )}
        {track.fileSize && (
          <span className="font-mono">{formatFileSize(track.fileSize)}</span>
        )}
      </div>

      {/* Rating */}
      <div className="flex gap-0.5">
        {[20, 40, 60, 80, 100].map((v) => (
          <button
            key={v}
            onClick={() => handleRatingClick(v)}
            className="p-0.5 transition-colors"
          >
            <Star
              className={cn(
                "h-5 w-5",
                displayRating != null && displayRating >= v
                  ? "text-accent-500 fill-accent-500"
                  : "text-text-disabled hover:text-accent-500/50",
              )}
            />
          </button>
        ))}
      </div>

      {/* Metadata */}
      <div className="space-y-3">
        {/* Organized */}
        {editing ? (
          <button
            onClick={() => setEditOrganized(!editOrganized)}
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 text-[0.78rem] transition-colors",
              editOrganized
                ? "bg-accent-950 text-accent-300"
                : "text-text-muted hover:bg-surface-3",
            )}
          >
            <CheckCircle2 className="h-4 w-4" />
            {editOrganized ? "Organized" : "Mark as organized"}
          </button>
        ) : track.organized ? (
          <div className="flex items-center gap-2 px-2 py-1.5 bg-accent-950 text-accent-300 text-[0.78rem]">
            <CheckCircle2 className="h-4 w-4" />
            Organized
          </div>
        ) : null}

        {/* NSFW */}
        {editing ? (
          <NsfwEditToggle value={editIsNsfw} onChange={setEditIsNsfw} />
        ) : track.isNsfw ? (
          <NsfwChip />
        ) : null}

        {/* Studio */}
        {track.studio && (
          <div>
            <div className="text-kicker mb-1">Studio</div>
            <Link
              href={`/studios/${track.studio.id}`}
              className="text-[0.78rem] text-text-primary hover:text-text-accent"
            >
              {track.studio.name}
            </Link>
          </div>
        )}

        {/* Library link */}
        {track.libraryId && (
          <div>
            <div className="text-kicker mb-1">Library</div>
            <Link
              href={`/audio/${track.libraryId}`}
              className="text-[0.78rem] text-text-accent hover:underline"
            >
              View library
            </Link>
          </div>
        )}

        {/* Performers */}
        <div>
          <div className="text-kicker mb-1">{terms.performers}</div>
          {editing ? (
            <ChipInput
              values={editPerformers}
              onChange={setEditPerformers}
              suggestions={availablePerformers.map((p) => ({ name: p.name, count: p.sceneCount }))}
              placeholder={`Add ${terms.performer.toLowerCase()}…`}
            />
          ) : track.performers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {track.performers.map((p) => (
                <Link
                  key={p.id}
                  href={`/performers/${p.id}`}
                  className="text-[0.78rem] text-text-primary hover:text-text-accent"
                >
                  {p.name}
                </Link>
              ))}
            </div>
          ) : (
            <span className="text-[0.68rem] text-text-disabled">None</span>
          )}
        </div>

        {/* Tags */}
        <div>
          <div className="text-kicker mb-1">Tags</div>
          {editing ? (
            <ChipInput
              values={editTags}
              onChange={setEditTags}
              suggestions={availableTags.map((t) => ({ name: t.name, count: t.sceneCount + (t.imageCount ?? 0) }))}
              placeholder="Add tag…"
            />
          ) : tagsVisible.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tagsVisible.map((tag) => (
                <span
                  key={tag.id}
                  className="tag-chip tag-chip-default text-[0.6rem] inline-flex items-center gap-1"
                >
                  <NsfwTagLabel isNsfw={tag.isNsfw}>{tag.name}</NsfwTagLabel>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[0.68rem] text-text-disabled">No tags</span>
          )}
        </div>

        {/* Details */}
        {track.details && (
          <div>
            <div className="text-kicker mb-1">Details</div>
            <p className="text-[0.78rem] text-text-secondary whitespace-pre-wrap">
              {track.details}
            </p>
          </div>
        )}

        {/* Playback stats */}
        {track.playCount > 0 && (
          <div>
            <div className="text-kicker mb-1">Plays</div>
            <p className="text-[0.75rem] text-text-muted font-mono">
              {track.playCount}
              {track.lastPlayedAt && (
                <> — last {new Date(track.lastPlayedAt).toLocaleDateString()}</>
              )}
            </p>
          </div>
        )}

        {/* File info */}
        <div className="separator" />
        <div>
          <div className="text-kicker mb-1">File Path</div>
          <p className="text-[0.65rem] font-mono text-text-muted break-all">
            {track.filePath}
          </p>
        </div>

        {/* Save/Cancel */}
        {editing && (
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[0.78rem]",
                "bg-accent-800 text-accent-100 hover:bg-accent-700 transition-colors",
                saving && "opacity-50 cursor-wait",
              )}
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-[0.78rem] text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
        )}
      </div>

      <AddToCollectionModal
        open={collectionModalOpen}
        onClose={() => setCollectionModalOpen(false)}
        entityType="audio-track"
        entityId={track.id}
        entityTitle={track.title}
      />
    </div>
  );
}
