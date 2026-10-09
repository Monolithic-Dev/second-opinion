import { useState } from 'react';
import { api } from '../../api';
import { ChecksPerDay, RedFlagBars } from '../../components/charts';
import { ErrorNote, Spinner } from '../../components/parts';
import { formatDuration, formatMoney } from '../../format';
import { useLive } from '../../hooks/useLive';

const RANGES = [7, 30, 90] as const;

export function InsightsPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const { data, error, loading } = useLive(() => api.insights(days), [days]);
  const holds = data?.holdsByStatus;
  const decided = holds ? holds.released + holds.denied + holds.expired : 0;

  return (
    <div className="stack">
      <div className="row">
        <h1 className="grow" style={{ margin: 0 }}>Insights</h1>
        <div className="chips" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r} type="button" className="chip" aria-pressed={days === r} style={days === r ? { background: 'var(--brand-soft)', borderColor: 'var(--brand)' } : undefined} onClick={() => setDays(r)}>Last {r} days</button>
          ))}
        </div>
      </div>
      {error && <ErrorNote message={error} />}
      {loading && !data && <Spinner />}
      {data && (
        <>
          <section className="tiles" aria-label="Summary">
            <div className="card tile good"><div className="muted small">Protected</div><div className="value">{formatMoney(data.protectedCents)}</div></div>
            <div className="card tile"><div className="muted small">Decided</div><div className="value">{decided}</div><div className="small muted">{holds?.denied ?? 0} cancelled · {holds?.released ?? 0} approved · {holds?.expired ?? 0} expired</div></div>
            <div className="card tile"><div className="muted small">Median time to decide</div><div className="value">{formatDuration(data.medianResponseSec)}</div></div>
          </section>
          <section className="card" aria-labelledby="cpd"><h2 id="cpd">Requests checked per day</h2><ChecksPerDay data={data.checksByDay} /></section>
          <section className="card" aria-labelledby="rf"><h2 id="rf">Most common red flags</h2><RedFlagBars data={data.topSignals} /></section>
        </>
      )}
    </div>
  );
}
