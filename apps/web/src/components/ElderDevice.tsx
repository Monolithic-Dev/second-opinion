import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, api } from '../api';
import { useSpeech } from '../hooks/useSpeech';
import type { Card, TurnResult } from '../types';
import { RiskCard } from './RiskCard';
import { ErrorNote, TraceView } from './parts';
import { IconArrowRight, IconMic, IconVolume } from './icons';

export interface Message {
  id: number;
  who: 'user' | 'bot' | 'note';
  text: string;
  card?: Card | null;
  result?: TurnResult;
}

export const HERO_TEXT = 'The bank says I have to buy five $200 gift cards today or my account is frozen.';

export const SCENARIOS: Array<{ label: string; text: string }> = [
  { label: 'Buy gift cards (a scam)', text: HERO_TEXT },
  { label: 'Pay the pharmacy $24', text: 'Pay Greenleaf Pharmacy $24' },
  { label: 'Is this text a scam?', text: 'I got a text saying my package is held and I must pay $2 to release it. Is this a scam?' },
  { label: 'Pay my neighbour $50', text: 'Send $50 to my neighbour' },
  { label: "What's pending?", text: "What's pending?" },
  { label: 'Try to approve it myself', text: 'approve it' },
];

interface Props {
  messages: Message[];
  onMessages: (add: Message[]) => void;
  /** Called with the hold id when a request was paused, so the demo can announce the family's decision. */
  onHeld: (holdId: string) => void;
  readAloud: boolean;
}

let nextId = 1;
export const newMessage = (m: Omit<Message, 'id'>): Message => ({ ...m, id: nextId++ });

/** Dorothy's voice device. Everything she says goes to the simulator, which asks the real MCP server. Captions are always shown. */
export function ElderDevice({ messages, onMessages, onHeld, readAloud }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const speech = useSpeech();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length]);

  async function send(t: string) {
    const said = t.trim();
    if (!said || busy) return;
    setBusy(true);
    setError(null);
    setText('');
    onMessages([newMessage({ who: 'user', text: said })]);
    try {
      const r = await api.utter(said, 'elder');
      onMessages([newMessage({ who: 'bot', text: r.reply, card: r.card, result: r })]);
      if (readAloud) speech.speak(r.spoken);
      if (r.holdId && !r.executed) onHeld(r.holdId);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Something went wrong.';
      setError(msg);
      onMessages([newMessage({ who: 'note', text: msg })]);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void send(text);
  }

  const lastTrace = [...messages].reverse().find((m) => m.result)?.result;

  return (
    <section className="card device" aria-labelledby="elder-title">
      <div className="device-head">
        <span
          aria-hidden="true"
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'var(--brand-soft)',
            border: '1px solid var(--brand-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--brand)',
            flexShrink: 0,
          }}
        >
          <IconVolume size={18} aria-hidden="true" />
        </span>
        <div className="grow">
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <h2 id="elder-title" style={{ margin: 0, fontSize: 'var(--text-lg)' }}>
              Dorothy's Echo
            </h2>
            <span className="badge ok" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
              Alexa+ Active
            </span>
          </div>
          <span className="muted small">Simulated Alexa+ in the kitchen · Hands-free voice assistant</span>
        </div>
        {/* Signal / battery indicators — text only, no emoji */}
        <div
          className="row"
          aria-hidden="true"
          style={{ gap: 6, opacity: 0.6, fontSize: '0.78rem', fontWeight: 600, fontFamily: 'var(--mono)' }}
        >
          <span>Wi-Fi</span>
          <span>100%</span>
        </div>
      </div>

      {/* Voice Wave Visualizer Banner when active */}
      {(speech.listening || busy) && (
        <div
          role="presentation"
          aria-hidden="true"
          style={{
            background: 'linear-gradient(90deg, rgba(37,99,235,0.08) 0%, rgba(0,202,238,0.15) 50%, rgba(37,99,235,0.08) 100%)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span className="small" style={{ color: 'var(--brand)', fontWeight: 600, marginRight: 8 }}>
            {speech.listening ? 'Listening to Dorothy…' : 'Alexa+ is checking with Second Opinion…'}
          </span>
          {[12, 24, 18, 30, 16, 22, 14].map((h, i) => (
            <span
              key={i}
              style={{
                width: 3,
                height: h,
                borderRadius: 2,
                background: 'var(--brand)',
                display: 'inline-block',
                animation: `soundwave 0.8s ease-in-out infinite alternate ${i * 0.1}s`,
              }}
            />
          ))}
          <style>{`@keyframes soundwave { 0% { transform: scaleY(0.4); opacity: 0.5; } 100% { transform: scaleY(1.2); opacity: 1; } }`}</style>
        </div>
      )}

      <div className="device-body caption-size" role="log" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 && (
          <div className="bubble note" style={{ padding: 'var(--space-4)', display: 'grid', justifyItems: 'center', gap: 8 }}>
            <IconMic size={28} aria-hidden="true" style={{ color: 'var(--muted)', opacity: 0.5 }} />
            Press the microphone, type, or tap an example below.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'grid', gap: 'var(--space-2)' }}>
            <div className={`bubble ${m.who}`}>
              {m.who === 'bot' && (
                <span
                  aria-hidden="true"
                  style={{
                    display: 'block',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--brand)',
                    marginBottom: 4,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Alexa+ Response
                </span>
              )}
              {m.text}
            </div>
            {m.card && m.card.level !== 'allow' && <RiskCard card={m.card} />}
          </div>
        ))}
        <div ref={end} />
      </div>

      <div className="device-foot">
        <div className="chips" aria-label="Examples">
          {SCENARIOS.map((s) => (
            <button
              key={s.label}
              type="button"
              className="chip"
              disabled={busy}
              onClick={() => void send(s.text)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="row" style={{ gap: 'var(--space-2)' }}>
          {speech.canListen && (
            <button
              type="button"
              className="btn mic"
              aria-pressed={speech.listening}
              aria-label={speech.listening ? 'Stop listening' : 'Speak'}
              disabled={busy}
              onClick={() => speech.listen((t) => void send(t))}
            >
              <IconMic size={20} aria-hidden="true" />
            </button>
          )}
          <label className="grow" style={{ minWidth: 0 }}>
            <span className="sr-only">What do you want to say?</span>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type what Dorothy would say…"
              maxLength={2000}
              disabled={busy}
              style={{
                borderRadius: 'var(--radius-full)',
                paddingLeft: '18px',
                paddingRight: '18px',
              }}
            />
          </label>
          <button
            type="submit"
            className="btn primary"
            disabled={busy || !text.trim()}
            style={{ borderRadius: 'var(--radius-full)', padding: '10px 22px', gap: 8 }}
          >
            {busy ? 'Checking…' : (
              <>
                <span>Send</span>
                <IconArrowRight size={14} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
        {error && <ErrorNote message={error} />}
        <details>
          <summary>Developer trace: the real MCP calls</summary>
          {lastTrace ? (
            <TraceView trace={lastTrace.trace} traceId={lastTrace.traceId} />
          ) : (
            <p className="muted small">Say something to see the tool calls.</p>
          )}
        </details>
      </div>
    </section>
  );
}
