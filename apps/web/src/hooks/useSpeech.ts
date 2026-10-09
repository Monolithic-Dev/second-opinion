import { useCallback, useEffect, useRef, useState } from 'react';

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Browser speech in (SpeechRecognition) and out (speechSynthesis). Both are optional: when a browser lacks them the UI keeps
 * working with typing and captions, which are always shown.
 */
export function useSpeech() {
  const [listening, setListening] = useState(false);
  const rec = useRef<RecognitionLike | null>(null);
  const canListen = typeof window !== 'undefined' && recognitionCtor() !== null;
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => () => { rec.current?.stop(); if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel(); }, []);

  const speak = useCallback((text: string) => {
    if (!canSpeak || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }, [canSpeak]);

  const listen = useCallback((onText: (text: string) => void) => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    if (listening) { rec.current?.stop(); return; }
    const r = new Ctor();
    r.lang = 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => { const t = e.results[0]?.[0]?.transcript; if (t) onText(t); };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }, [listening]);

  return { canListen, canSpeak, listening, speak, listen };
}
