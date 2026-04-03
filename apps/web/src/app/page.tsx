import { apiRoutes, appShellSections, designTokens } from "@obscura/ui";

const statusCards = [
  { label: "Library Roots", value: "0 configured", detail: "Ready for initial setup" },
  { label: "Background Jobs", value: "Idle", detail: "Scan, hash, probe, and preview queues" },
  { label: "Bootstrap Import", value: "Standby", detail: "Stash import flow scaffolded" }
];

export default function HomePage() {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">Obscura / Control Room</p>
          <h1>Private library management built for dense media collections.</h1>
          <p className="lede">
            This foundation establishes the web shell, API boundary, worker topology,
            and design tokens for the full application.
          </p>
        </div>
        <div className="hero-meta">
          <div className="metric">
            <span>Mode</span>
            <strong>LAN / Docker / Single User</strong>
          </div>
          <div className="metric">
            <span>Palette</span>
            <strong>{designTokens.accent}</strong>
          </div>
          <div className="metric">
            <span>API</span>
            <strong>{apiRoutes.health}</strong>
          </div>
        </div>
      </section>

      <section className="status-grid" aria-label="Project status">
        {statusCards.map((card) => (
          <article key={card.label} className="status-card">
            <p>{card.label}</p>
            <h2>{card.value}</h2>
            <span>{card.detail}</span>
          </article>
        ))}
      </section>

      <section className="section-grid">
        {appShellSections.map((section) => (
          <article key={section.title} className="feature-card">
            <p className="feature-kicker">{section.kicker}</p>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

