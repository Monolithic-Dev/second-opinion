import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api } from '../api';
import { ElderDevice, newMessage, type Message } from '../components/ElderDevice';
import { FamilyPhone } from '../components/FamilyPhone';
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
        if (type === 'reset') { setMessages([]); watching.current.clear(); return; }
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
      <div className="row" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="grow">
          <h1 style={{ margin: 0 }}>Hold the payment. Ask the family.</h1>
          <p className="muted" style={{ margin: 0 }}>Dorothy's Alexa+ checks every payment request. Risky ones wait for family approval. Simulated devices, synthetic data.</p>
        </div>
        <label className="row" style={{ display: 'flex', fontWeight: 400 }}>
          <input type="checkbox" style={{ width: 'auto', minHeight: 'auto' }} checked={readAloud} onChange={(e) => setReadAloud(e.target.checked)} disabled={!speech.canSpeak} />
          Read replies aloud
        </label>
        <button type="button" className="btn" onClick={() => void reset()} disabled={resetting}>{resetting ? 'Resetting…' : 'Reset demo'}</button>
      </div>
      {error && <ErrorNote message={error} />}
      <div className="split">
        <ElderDevice messages={messages} onMessages={add} onHeld={(id) => watching.current.add(id)} readAloud={readAloud} />
        <FamilyPhone />
      </div>
    </main>
  );
}
