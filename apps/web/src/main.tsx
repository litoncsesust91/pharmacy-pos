import { StrictMode } from 'react';
import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App(): ReactElement {
  return (
    <main className="shell">
      <section className="hero" aria-labelledby="app-title">
        <p className="eyebrow">PHARMACY OPERATIONS PLATFORM</p>
        <h1 id="app-title">A reliable foundation for every sale.</h1>
        <p className="intro">
          The local development foundation is ready for tenant-aware inventory,
          batch tracking, and an offline-safe pharmacy POS.
        </p>
        <div className="status" role="status">
          <span className="status-dot" aria-hidden="true" />
          Phase 1 foundation online
        </div>
      </section>
      <section className="cards" aria-label="Platform capabilities">
        <article>
          <span className="card-index">01</span>
          <h2>Batch aware</h2>
          <p>Every future stock movement will preserve batch and expiry history.</p>
        </article>
        <article>
          <span className="card-index">02</span>
          <h2>Tenant ready</h2>
          <p>Organization and branch boundaries are part of the foundation.</p>
        </article>
        <article>
          <span className="card-index">03</span>
          <h2>Offline minded</h2>
          <p>The POS roadmap includes local-first checkout and synchronization.</p>
        </article>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
