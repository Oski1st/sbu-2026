import { useEffect, useState } from 'react';
import { fetchSeptaTrains, type SeptaResult } from '../../services/transit/septa';
import { watchSnapshotExpiry } from './snapshotFreshness';

export function TransitStatus({ endpoint }: { endpoint?: string }) {
  const [result, setResult] = useState<SeptaResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    let stopExpiry: (() => void) | undefined;
    setResult(null);
    setStale(false);
    void fetchSeptaTrains({ signal: controller.signal, endpoint }).then(value => {
      if (!mounted) return;
      setResult(value);
      if (value.status === 'live') {
        stopExpiry = watchSnapshotExpiry(value.fetchedAt, () => setStale(true));
      }
    });
    return () => {
      mounted = false;
      controller.abort();
      stopExpiry?.();
    };
  }, [attempt, endpoint]);

  return <section className="ol-live" aria-labelledby="ol-live-heading">
    <div className="ol-section-heading"><h2 id="ol-live-heading">SEPTA service snapshot</h2>
      <button type="button" className="ol-button ol-secondary" disabled={!result} onClick={() => setAttempt(value => value + 1)}>Refresh</button>
    </div>
    <div aria-live="polite">
      {!result && <p>Checking the official SEPTA feed…</p>}
      {result?.status === 'unavailable' && <p><strong>Live data unavailable.</strong> {result.reason}</p>}
      {result?.status === 'live' && <>
        <p><span className={`ol-status ${stale ? '' : 'ol-status-done'}`}>{stale ? 'Snapshot expired · refresh to check' : 'Live feed fetched'}</span> Retrieved {new Date(result.fetchedAt).toLocaleTimeString()}. Agency feed timestamp is not supplied.</p>
        <p>Agency-wide Regional Rail observations, not matched to your journey. Demo departure and arrival times remain simulated.</p>
        {!stale && (result.trains.length ? <ul className="ol-trains">{result.trains.slice(0, 5).map((train, index) =>
          <li key={`${train.trainNumber}-${index}`}><strong>{train.line} · Train {train.trainNumber}</strong><span>To {train.destination} · Next: {train.nextStop}</span><span>{train.delayMinutes === null ? 'Delay not reported' : `Reported delay: ${train.delayMinutes} min`}</span></li>
        )}</ul> : <p>The feed returned no active trains. This does not confirm that service has stopped.</p>)}
      </>}
    </div>
    <a href="https://api.septa.org/" target="_blank" rel="noopener noreferrer">Official SEPTA feed information ↗<span className="ol-sr-only"> (opens in a new tab)</span></a>
  </section>;
}
