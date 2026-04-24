import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const dashboardUrl = useBaseUrl('/img/screenshots/dashboard.png');

  return (
    <header className={styles.hero}>
      <div
        className={styles.heroBackdrop}
        style={{backgroundImage: `linear-gradient(180deg, rgba(5, 5, 6, 0.08), rgba(5, 5, 6, 0.88)), linear-gradient(90deg, rgba(5, 5, 6, 0.96) 0%, rgba(5, 5, 6, 0.62) 48%, rgba(5, 5, 6, 0.18) 100%), url("${dashboardUrl}")`}}
      />
      <div className={styles.heroScrim} />
      <div className="container">
        <p className={styles.kicker}>Private media, documented</p>
        <Heading as="h1" className={styles.heroTitle}>
          Obscura
        </Heading>
        <p className={styles.heroSubtitle}>
          A self-hosted media browser for videos, images, galleries, audio, and
          plugin-powered metadata workflows.
        </p>
        <div className={styles.actions}>
          <Link className={styles.primaryAction} to="/docs/users/quick-start">
            Quick start
          </Link>
          <Link className={styles.secondaryAction} to="/docs/developers/plugin-development">
            Build plugins
          </Link>
        </div>
      </div>
    </header>
  );
}

function Pathways() {
  return (
    <section className={styles.pathways}>
      <div className="container">
        <div className={styles.sectionHeader}>
          <p className={styles.kicker}>Choose a track</p>
          <Heading as="h2">Everything starts from the running app.</Heading>
        </div>
        <div className={styles.pathGrid}>
          <Link className={styles.pathItem} to="/docs/users/quick-start">
            <span>Users</span>
            <strong>Install, scan, browse, and operate Obscura on a private LAN.</strong>
          </Link>
          <Link className={styles.pathItem} to="/docs/developers/architecture">
            <span>Developers</span>
            <strong>Understand the SvelteKit, worker, Postgres, and package boundaries.</strong>
          </Link>
          <Link className={styles.pathItem} to="/docs/developers/plugin-development">
            <span>Plugin authors</span>
            <strong>Write metadata providers with manifests, auth, and execution envelopes.</strong>
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
      description="Documentation for the Obscura self-hosted media browser.">
      <HomepageHeader />
      <main>
        <Pathways />
      </main>
    </Layout>
  );
}
