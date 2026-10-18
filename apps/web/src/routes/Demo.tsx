import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api } from '../api';
import { ElderDevice, newMessage, type Message } from '../components/ElderDevice';
import { FamilyPhone } from '../components/FamilyPhone';
import { IconRefresh, IconShieldCheck, IconVolume, IconVolumeOff } from '../components/icons';
import { ErrorNote } from '../components/parts';
import { useAppState } from '../hooks/useAppState';
import { useSpeech } from '../hooks/useSpeech';

const OUTCOME: Record<string, string> = {
  denied: "Your family said no, so I've cancelled it. You're safe.",
  released: 'Your family approved it, so it can go ahead.',
  expired: 'Nobody answered in time, so it stays blocked.',
};

/** The recording view: Dorothy's Echo on the left, her daughter's phone on the right, live in between. */
export function Demo() {
  const { subscribe, refresh } = useAppState();
  const speech = useSpeech();
  const [messages, setMessages] = useState<Message[]>([]);
  const [readAloud, setReadAloud] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watching = useRef(new Set<string>());

  const add = useCallback((more: Message[]) => setMessages((m) => [...m, ...more]), []);

  // When the family decides on something Dorothy asked for, her device tells her.
  useEffect(
    () =>
      subscribe((type, data) => {
        if (type === 'reset') {
          setMessages([]);
          watching.current.clear();
          return;
        }
        if (type !== 'hold.resolved') return;
        const holdId = data.holdId as string | undefined;
        const status = data.status as string | undefined;
        if (!holdId || !status || !watching.current.has(holdId) || !OUTCOME[status]) return;
        watching.current.delete(holdId);
        setMessages((m) => [...m, newMessage({ who: 'bot', text: OUTCOME[status] as string })]);
        if (readAloud) speech.speak(OUTCOME[status] as string);
      }),
    [subscribe, readAloud, speech],
  );

  async function reset() {
    setResetting(true);
    setError(null);
    try {
      await api.reset();
      setMessages([]);
      watching.current.clear();
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reset the demo.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <main className="container">
      <div
        style={{
          marginBottom: 'var(--space-5)',
          paddingBottom: 'var(--space-4)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <div className="row" style={{ gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--ok)',
                background: 'var(--ok-bg)',
                border: '1px solid var(--ok-border)',
                borderRadius: 'var(--radius-full)',
                padding: '3px 10px',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--ok)',
                  display: 'inline-block',
                  boxShadow: '0 0 6px var(--ok-glow)',
                }}
              />
              Live interactive simulation
            </span>
            <span className="small muted">Streamable HTTP MCP · Pure Deterministic Engine</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-3xl)', letterSpacing: '-0.035em', lineHeight: 1.1 }}>
            Hold the payment.<br />Ask the family.
          </h1>
          <p className="muted" style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-base)', maxWidth: 640 }}>
            Dorothy's Alexa+ checks every payment request. Risky ones wait for family approval. Simulated devices, synthetic data.
          </p>
        </div>

        <div className="row" style={{ gap: 'var(--space-2)', flexShrink: 0 }}>
          <label
            className="row"
            style={{
              display: 'flex',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 14px',
              cursor: speech.canSpeak ? 'pointer' : 'not-allowed',
              boxShadow: 'var(--shadow-sm)',
              gap: 8,
              color: readAloud ? 'var(--brand)' : 'var(--text)',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              style={{ width: 'auto', minHeight: 'auto', margin: 0, cursor: 'pointer' }}
              checked={readAloud}
              onChange={(e) => setReadAloud(e.target.checked)}
              disabled={!speech.canSpeak}
            />
            {readAloud
              ? <IconVolume size={14} aria-hidden="true" />
              : <IconVolumeOff size={14} aria-hidden="true" style={{ color: 'var(--muted)' }} />
            }
            Read aloud
          </label>

          <button
            type="button"
            className="btn"
            onClick={() => void reset()}
            disabled={resetting}
            style={{ fontWeight: 600, gap: 8 }}
          >
            <IconRefresh
              size={14}
              aria-hidden="true"
              style={{ animation: resetting ? 'spin 1s linear infinite' : 'none' }}
            />
            {resetting ? 'Resetting…' : 'Reset demo'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ErrorNote message={error} />
        </div>
      )}

      <div className="split">
        <ElderDevice
          messages={messages}
          onMessages={add}
          onHeld={(id) => watching.current.add(id)}
          readAloud={readAloud}
        />
        <FamilyPhone />
      </div>
    </main>
  );
}
