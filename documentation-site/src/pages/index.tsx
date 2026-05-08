import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

const CAPABILITIES = [
  'Videos',
  'Series',
  'Comics',
  'Galleries',
  'Images',
  'Audio',
  'Performers',
  'Studios',
  'Tags',
  'Plugins',
];

const FEATURES = [
  {
    kicker: 'Comics',
    title: 'Comic archives read like books',
    body:
      'cbz/zip archives and image folders scan as gallery series, keep natural page order, import ComicInfo metadata, track read/unread progress, and open in paged or webtoon reader modes.',
  },
  {
    kicker: 'Streaming',
    title: 'On-demand HLS',
    body:
      'Videos transcode to HLS via ffmpeg as they are needed. Cached renditions are served directly from the SvelteKit app — no separate media server required.',
  },
  {
    kicker: 'Metadata',
    title: 'Plugin-powered scrapers',
    body:
      'Native TypeScript and Python plugins, plus Stash-compatible scrapers, expose providers for movies, series, performers, galleries, and audio behind one identify engine.',
  },
  {
    kicker: 'Operations',
    title: 'Background jobs you can see',
    body:
      'pg-boss handles scan, probe, thumbnail, sprite, HLS, and import jobs. The Operations dashboard mirrors job state so you always know what the worker is doing.',
  },
  {
    kicker: 'Library',
    title: 'Folders are the schema',
    body:
      'Movies, flat series, and seasoned series are inferred from depth under each library root. Sidecars merge cleanly without overwriting your edits.',
  },
  {
    kicker: 'Identify',
    title: 'pHash, OSHash, MD5',
    body:
      'A Stash-compatible perceptual hash pipeline lets you identify videos against StashBox-protocol servers and contribute fingerprints back to the community index.',
  },
  {
    kicker: 'Deploy',
    title: 'One Docker image',
    body:
      'PostgreSQL, ffmpeg, the SvelteKit web server, and the worker ship as a single image. Mount /data and /media, expose port 8008, and you are running.',
  },
];

const SHOWCASE = [
  {
    title: 'A dashboard built like an instrument panel.',
    body:
      'Library activity, recent scans, and provider status read like a control room — dense, dark, and only colorful when something is active.',
    image: '/img/screenshots/dashboard.png',
    alt: 'Obscura dashboard',
  },
  {
    title: 'Scenes designed for the screening room.',
    body:
      'A cinematic scene detail page with HLS playback, trickplay sprites, transcripts, subtitle controls, and inline metadata editing.',
    image: '/img/screenshots/scene-detail.png',
    alt: 'Scene detail page',
  },
  {
    title: 'Comic galleries organized for reading.',
    body:
      'Archive chapters and image folders live in the gallery system, with natural page order, reader progress, and a dedicated paged or webtoon reader.',
    image: '/img/screenshots/gallery-detail.png',
    alt: 'Gallery detail page',
  },
  {
    title: 'Mobile is first-class, not a fallback.',
    body:
      'Browse, search, and play from any phone on your LAN. Touch targets, sheets, and bottom navigation are designed before the desktop expansion.',
    image: '/img/screenshots/mobile-scene-detail.png',
    alt: 'Obscura on mobile',
    portrait: true,
  },
];

function Hero() {
  const dashboardUrl = useBaseUrl('/img/screenshots/dashboard.png');

  return (
    <header className={styles.hero}>
      <div className={styles.heroBackdrop} aria-hidden />
      <div className={styles.heroGrid} aria-hidden />
      <div className={styles.heroVignette} aria-hidden />
      <div className={`container ${styles.heroInner}`}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>
            <span className={styles.led} aria-hidden /> Self-hosted media, documented
          </p>
          <Heading as="h1" className={styles.heroTitle}>
            A private screening room
            <br />
            for your <span className={styles.heroAccent}>entire</span> library.
          </Heading>
          <p className={styles.heroSubtitle}>
            Obscura is a video-first, self-hosted media browser. Galleries, audio,
            comics, performers, and plugin-powered metadata are first-class — and
            the whole thing fits in one Docker image.
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryAction} to="/docs/users/quick-start">
              Quick start
              <span className={styles.actionArrow} aria-hidden>→</span>
            </Link>
            <Link className={styles.secondaryAction} to="/docs/developers/architecture">
              Read the architecture
            </Link>
          </div>
          <dl className={styles.metaRow}>
            <div>
              <dt>Stack</dt>
              <dd>SvelteKit · pg-boss · Postgres 16</dd>
            </div>
            <div>
              <dt>Footprint</dt>
              <dd>One container · port 8008</dd>
            </div>
            <div>
              <dt>License</dt>
              <dd>Open source</dd>
            </div>
          </dl>
        </div>
        <div className={styles.heroVisual} aria-hidden>
          <div className={styles.heroFrame}>
            <div className={styles.heroChrome}>
              <span />
              <span />
              <span />
              <em>obscura.local:8008</em>
            </div>
            <img
              src={dashboardUrl}
              alt=""
              loading="eager"
              className={styles.heroScreenshot}
            />
          </div>
          <div className={styles.heroGlow} />
        </div>
      </div>
    </header>
  );
}

function CapabilityStrip() {
  return (
    <section className={styles.strip}>
      <div className={`container ${styles.stripInner}`}>
        <p className={styles.stripLabel}>Manages</p>
        <ul className={styles.stripList}>
          {CAPABILITIES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Pathways() {
  return (
    <section className={styles.pathways}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <p className={styles.kicker}>Choose a track</p>
          <Heading as="h2" className={styles.sectionTitle}>
            Three doors. Same dark room.
          </Heading>
          <p className={styles.sectionLead}>
            Most readers fall into one of three roles. Pick the one that matches what
            you are about to do — every page links to the others when you need them.
          </p>
        </div>
        <div className={styles.pathGrid}>
          <Link className={styles.pathItem} to="/docs/users/quick-start">
            <span className={styles.pathKicker}>01 · Users</span>
            <strong className={styles.pathTitle}>Run it on your network</strong>
            <p className={styles.pathBody}>
              Install with Docker, mount your media, and start scanning. Library
              organization, settings, and operations live here.
            </p>
            <span className={styles.pathCta}>
              Quick start
              <em aria-hidden>→</em>
            </span>
          </Link>
          <Link className={styles.pathItem} to="/docs/developers/architecture">
            <span className={styles.pathKicker}>02 · Developers</span>
            <strong className={styles.pathTitle}>Understand the system</strong>
            <p className={styles.pathBody}>
              SvelteKit, the worker, Postgres, and the shared packages. How code
              moves from the UI all the way to the database.
            </p>
            <span className={styles.pathCta}>
              Architecture
              <em aria-hidden>→</em>
            </span>
          </Link>
          <Link className={styles.pathItem} to="/docs/plugins/overview">
            <span className={styles.pathKicker}>03 · Plugin authors</span>
            <strong className={styles.pathTitle}>Build a metadata provider</strong>
            <p className={styles.pathBody}>
              Manifests, capabilities, auth, and the execution envelope. Write
              providers in TypeScript, Python, or as a Stash adapter.
            </p>
            <span className={styles.pathCta}>
              Build plugins
              <em aria-hidden>→</em>
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <p className={styles.kicker}>What it does</p>
          <Heading as="h2" className={styles.sectionTitle}>
            Built for one user, on one network, with everything in one place.
          </Heading>
        </div>
        <div className={styles.featureGrid}>
          {FEATURES.map((f) => (
            <article key={f.title} className={styles.featureCard}>
              <p className={styles.featureKicker}>{f.kicker}</p>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureBody}>{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Showcase() {
  return (
    <section className={styles.showcase}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <p className={styles.kicker}>The interface</p>
          <Heading as="h2" className={styles.sectionTitle}>
            Dark Room — sharp edges, brass on signal, glass when it floats.
          </Heading>
          <p className={styles.sectionLead}>
            The whole UI follows one design language. Read the{' '}
            <Link to="/docs/developers/design-language">Design Language</Link> doc for
            the full spec.
          </p>
        </div>
        <div className={styles.showcaseList}>
          {SHOWCASE.map((item, i) => (
            <article
              key={item.image}
              className={`${styles.showcaseRow} ${
                i % 2 === 1 ? styles.showcaseRowReverse : ''
              }`}
            >
              <div className={styles.showcaseCopy}>
                <h3 className={styles.showcaseTitle}>{item.title}</h3>
                <p className={styles.showcaseBody}>{item.body}</p>
              </div>
              <div
                className={`${styles.showcaseFrame} ${
                  item.portrait ? styles.showcaseFramePortrait : ''
                }`}
              >
                <img src={useBaseUrl(item.image)} alt={item.alt} loading="lazy" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBlock() {
  return (
    <section className={styles.cta}>
      <div className={`container ${styles.ctaInner}`}>
        <div>
          <p className={styles.kicker}>Ready when you are</p>
          <Heading as="h2" className={styles.ctaTitle}>
            One container. One port. Your library.
          </Heading>
        </div>
        <div className={styles.ctaActions}>
          <Link className={styles.primaryAction} to="/docs/users/quick-start">
            Run it now
            <span className={styles.actionArrow} aria-hidden>→</span>
          </Link>
          <Link
            className={styles.secondaryAction}
            href="https://github.com/pauljoda/Obscura"
          >
            View on GitHub
          </Link>
          <Link
            className={styles.secondaryAction}
            href="https://www.reddit.com/r/ObscuraMediaApp/"
          >
            Join the subreddit
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="Documentation for the Obscura self-hosted media browser."
    >
      <Hero />
      <main>
        <CapabilityStrip />
        <Pathways />
        <Features />
        <Showcase />
        <CtaBlock />
      </main>
    </Layout>
  );
}
