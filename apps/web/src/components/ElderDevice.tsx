import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, api } from '../api';
import { useSpeech } from '../hooks/useSpeech';
import type { Card, TurnResult } from '../types';
import { RiskCard } from './RiskCard';
import { ErrorNote, TraceView } from './parts';

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

  useEffect(() => { end.current?.scrollIntoView?.({ block: 'end' }); }, [messages.length]);

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
        <span aria-hidden="true" style={{ fontSize: '1.4rem' }}>🔊</span>
        <div className="grow">
          <h2 id="elder-title" style={{ margin: 0 }}>Dorothy's Echo</h2>
          <span className="muted small">Simulated Alexa+ in the kitchen</span>
        </div>
      </div>

      <div className="device-body caption-size" role="log" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 && <div className="bubble note">Press the microphone, type, or tap an example below.</div>}
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'grid' }}>
            <div className={`bubble ${m.who}`}>{m.text}</div>
            {m.card && m.card.level !== 'allow' && <RiskCard card={m.card} />}
          </div>
        ))}
        <div ref={end} />
      </div>

      <div className="device-foot">
        <div className="chips" aria-label="Examples">
          {SCENARIOS.map((s) => (
            <button key={s.label} type="button" className="chip" disabled={busy} onClick={() => void send(s.text)}>{s.label}</button>
          ))}
        </div>
        <form onSubmit={submit} className="row">
          {speech.canListen && (
            <button type="button" className="btn mic" aria-pressed={speech.listening} aria-label={speech.listening ? 'Stop listening' : 'Speak'} disabled={busy} onClick={() => speech.listen((t) => void send(t))}>
              🎤
            </button>
          )}
          <label className="grow">
            <span className="sr-only">What do you want to say?</span>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type what Dorothy would say…" maxLength={2000} disabled={busy} />
          </label>
          <button type="submit" className="btn primary" disabled={busy || !text.trim()}>{busy ? 'Checking…' : 'Send'}</button>
        </form>
        {error && <ErrorNote message={error} />}
        <details>
          <summary>Developer trace: the real MCP calls</summary>
          {lastTrace ? <TraceView trace={lastTrace.trace} traceId={lastTrace.traceId} /> : <p className="muted small">Say something to see the tool calls.</p>}
        </details>
      </div>
    </section>
  );
}
