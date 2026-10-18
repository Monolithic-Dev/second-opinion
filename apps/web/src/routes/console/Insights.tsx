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
    <div className="stack" style={{ gap: 'var(--space-4)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)' }}>Insights</h1>
          <p className="muted small" style={{ margin: 'var(--space-1) 0 0' }}>
            Historical fraud trends, prevention metrics, and resolution turnaround times
          </p>
        </div>
        <div className="chips" role="group" aria-label="Time range">
          {RANGES.map((r) => {
            const active = days === r;
            return (
              <button
                key={r}
                type="button"
                className="chip"
                aria-pressed={active}
                style={
                  active
                    ? {
                        background: 'var(--brand)',
                        color: 'var(--brand-ink)',
                        borderColor: 'var(--brand)',
                        fontWeight: 700,
                      }
                    : undefined
                }
                onClick={() => setDays(r)}
              >
                Last {r} days
              </button>
            );
          })}
        </div>
      </div>

      {error && <ErrorNote message={error} />}
      {loading && !data && <Spinner />}

      {data && (
        <>
          <section className="tiles" aria-label="Summary">
            <div className="card tile good">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="muted small" style={{ fontWeight: 600 }}>Protected</div>
                <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>🛡️</span>
              </div>
              <div className="value">{formatMoney(data.protectedCents)}</div>
              <div className="small muted">cumulative dollars prevented from loss</div>
            </div>

            <div className="card tile">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="muted small" style={{ fontWeight: 600 }}>Decided</div>
                <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>⚖️</span>
              </div>
              <div className="value">{decided}</div>
              <div className="small muted">
                {holds?.denied ?? 0} cancelled · {holds?.released ?? 0} approved · {holds?.expired ?? 0} expired
              </div>
            </div>

            <div className="card tile">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="muted small" style={{ fontWeight: 600 }}>Median time to decide</div>
                <span aria-hidden="true" style={{ fontSize: '1.1rem' }}>⚡</span>
              </div>
              <div className="value">{formatDuration(data.medianResponseSec)}</div>
              <div className="small muted">typical approver response speed</div>
            </div>
          </section>

          <section className="card" aria-labelledby="cpd">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <h2 id="cpd" style={{ margin: 0 }}>Requests checked per day</h2>
              <span className="small muted">Daily classification history</span>
            </div>
            <ChecksPerDay data={data.checksByDay} />
          </section>

          <section className="card" aria-labelledby="rf">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <h2 id="rf" style={{ margin: 0 }}>Most common red flags</h2>
              <span className="small muted">Signal prevalence</span>
            </div>
            <RedFlagBars data={data.topSignals} />
          </section>
        </>
      )}
    </div>
  );
}
