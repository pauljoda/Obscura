"use client";
import { useEffect, useState } from "react";
import {
  fetchVideoLibraryCounts,
  fetchVideoMovies,
  fetchVideoSeriesList,
  type VideoLibraryCounts,
  type VideoMovieRow,
  type VideoSeriesRow,
} from "../../lib/api/video-library";

type Tab = "movies" | "series";

export function VideoLibraryPageClient() {
  const [tab, setTab] = useState<Tab>("series");
  const [counts, setCounts] = useState<VideoLibraryCounts | null>(null);
  const [movies, setMovies] = useState<VideoMovieRow[]>([]);
  const [series, setSeries] = useState<VideoSeriesRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchVideoLibraryCounts(),
      fetchVideoSeriesList({ limit: 60 }),
      fetchVideoMovies({ limit: 60 }),
    ])
      .then(([c, s, m]) => {
        if (cancelled) return;
        setCounts(c);
        setSeries(s.items);
        setMovies(m.items);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      style={{
        padding: "1.25rem",
        color: "var(--text-primary, #e8e4dc)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <header style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            margin: 0,
            fontFamily: "Geist, sans-serif",
            fontSize: "1.75rem",
            fontWeight: 600,
          }}
        >
          Video Library
        </h1>
        <div style={{ opacity: 0.7, marginTop: "0.25rem", fontSize: "0.875rem" }}>
          New typed view backed by the video series model. Read-only for now.
        </div>
        {counts && (
          <div
            style={{
              display: "flex",
              gap: "1.25rem",
              marginTop: "0.75rem",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: "0.75rem",
              opacity: 0.85,
            }}
          >
            <span>series: {counts.series}</span>
            <span>movies: {counts.movies}</span>
            <span>episodes: {counts.episodes}</span>
          </div>
        )}
      </header>

      <nav
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1rem",
          borderBottom: "1px solid rgba(196, 154, 90, 0.25)",
        }}
      >
        {(["series", "movies"] as Tab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            style={{
              borderRadius: 0,
              border: "none",
              borderBottom:
                tab === key
                  ? "2px solid #c49a5a"
                  : "2px solid transparent",
              background: "transparent",
              padding: "0.5rem 0.875rem",
              color: "inherit",
              cursor: "pointer",
              fontFamily: "Geist, sans-serif",
              textTransform: "capitalize",
              fontWeight: tab === key ? 600 : 400,
            }}
          >
            {key}
          </button>
        ))}
      </nav>

      {error && (
        <div
          style={{
            borderLeft: "2px solid #ff8080",
            padding: "0.5rem 0.75rem",
            color: "#ff8080",
            marginBottom: "1rem",
            fontSize: "0.875rem",
          }}
        >
          Failed to load: {error}
        </div>
      )}

      {tab === "series" && (
        <section>
          {series.length === 0 ? (
            <div style={{ opacity: 0.6 }}>No series yet.</div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "1rem",
              }}
            >
              {series.map((s) => (
                <article
                  key={s.id}
                  style={{
                    background: "rgba(18, 18, 20, 0.6)",
                    border: "1px solid rgba(196, 154, 90, 0.18)",
                    padding: "0.75rem",
                    borderRadius: 0,
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontFamily: "Geist, sans-serif",
                      fontSize: "1rem",
                      fontWeight: 500,
                    }}
                  >
                    {s.title}
                  </h2>
                  <div
                    style={{
                      opacity: 0.65,
                      fontSize: "0.75rem",
                      marginTop: "0.25rem",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {s.seasonCount} season{s.seasonCount === 1 ? "" : "s"} ·{" "}
                    {s.episodeCount} episode{s.episodeCount === 1 ? "" : "s"}
                  </div>
                  {s.firstAirDate && (
                    <div style={{ opacity: 0.55, fontSize: "0.75rem", marginTop: "0.125rem" }}>
                      First aired {s.firstAirDate}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "movies" && (
        <section>
          {movies.length === 0 ? (
            <div style={{ opacity: 0.6 }}>No movies yet.</div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "1rem",
              }}
            >
              {movies.map((m) => (
                <article
                  key={m.id}
                  style={{
                    background: "rgba(18, 18, 20, 0.6)",
                    border: "1px solid rgba(196, 154, 90, 0.18)",
                    padding: "0.75rem",
                    borderRadius: 0,
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontFamily: "Geist, sans-serif",
                      fontSize: "1rem",
                      fontWeight: 500,
                    }}
                  >
                    {m.title}
                  </h2>
                  {m.releaseDate && (
                    <div
                      style={{
                        opacity: 0.65,
                        fontSize: "0.75rem",
                        marginTop: "0.25rem",
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                    >
                      {m.releaseDate}
                    </div>
                  )}
                  {m.runtime && (
                    <div style={{ opacity: 0.55, fontSize: "0.75rem" }}>
                      {m.runtime} min
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
