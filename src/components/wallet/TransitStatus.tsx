import { useEffect, useState } from 'react';
import { fetchSeptaTrains, type SeptaResult } from '../../services/transit/septa';
import { watchSnapshotExpiry } from './snapshotFreshness';

/** Keep status announcements concise; train-list changes are not read out as one long alert. */
export function TransitSnapshot({ result, stale }: { result: SeptaResult | null; stale: boolean }) {
  const live = result?.status === 'live' ? result : null;
  const summary = !result ? 'Refreshing SEPTA observations. Please wait.' :
    !live ? 'SEPTA observations unavailable. Try Refresh feed or check SEPTA directly.' :
    stale ? 'Snapshot expired. Observations are hidden. Refresh feed to check again.' :
    live.trains.length ? 'SEPTA observations retrieved. This snapshot expires after 60 seconds.' :
    'The feed returned no active trains. This does not confirm that service has stopped.';
  return <>
    <p role="status" aria-live="polite" aria-atomic="true" className="ol-feed-summary">{summary}</p>
    <div id="ol-feed-details">
      {result?.status === 'unavailable' && <p>{result.reason}</p>}
      {live && <p>Last retrieved: <time dateTime={live.fetchedAt}>{new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
      }).format(new Date(live.fetchedAt))}</time>. This is our retrieval time; SEPTA does not supply an observation timestamp.</p>}
      {live && <p>Snapshots expire after 60 seconds. Refresh feed requests a new snapshot from SEPTA.</p>}
      <p>Agency-wide Regional Rail observations, not matched to your journey. Demo departure and arrival times remain simulated.</p>
      {live && !stale && live.trains.length > 0 && <ul className="ol-trains">{live.trains.slice(0, 5).map((train, index) =>
        <li key={`${train.trainNumber}-${index}`}><strong>{train.line} · Train {train.trainNumber}</strong><span>To {train.destination} · Next: {train.nextStop}</span><span>{train.delayMinutes === null ? 'Delay not reported' : `Reported delay: ${train.delayMinutes} min`}</span></li>
      )}</ul>}
    </div>
  </>;
}

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
      if (value.status === 'live') stopExpiry = watchSnapshotExpiry(value.fetchedAt, () => setStale(true));
    });
    return () => { mounted = false; controller.abort(); stopExpiry?.(); };
  }, [attempt, endpoint]);

  return <section className="ol-live" aria-labelledby="ol-live-heading">
    <div className="ol-section-heading"><h2 id="ol-live-heading">SEPTA service snapshot</h2>
      <button type="button" className="ol-button ol-secondary" aria-controls="ol-feed-details" aria-disabled={!result}
        onClick={() => { if (result) { setResult(null); setAttempt(value => value + 1); } }}>Refresh feed</button>
    </div>
    <TransitSnapshot result={result} stale={stale} />
    <a href="https://api.septa.org/" target="_blank" rel="noopener noreferrer">Check SEPTA feed information ↗<span className="ol-sr-only"> (opens in a new tab)</span></a>
  </section>;
}
