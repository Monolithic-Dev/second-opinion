import type { Card } from '../types';
import { IconAlertTriangle, IconCheckCircle, IconXCircle, IconLightbulb } from './icons';

const WORD: Record<Card['level'], string> = { hold: 'Held', caution: 'Careful', allow: 'Looks OK' };

function LevelIcon({ level }: { level: Card['level'] }) {
  if (level === 'hold') return <IconXCircle size={18} style={{ color: 'var(--danger)' }} />;
  if (level === 'caution') return <IconAlertTriangle size={18} style={{ color: 'var(--warn)' }} />;
  return <IconCheckCircle size={18} style={{ color: 'var(--ok)' }} />;
}

/** The red-flag card. Colour is never the only signal: every level also has an icon and a word. */
export function RiskCard({ card, className = '' }: { card: Card; className?: string }) {
  return (
    <section className={`risk ${card.level} ${className}`} aria-label={`${WORD[card.level]}: ${card.title}`}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LevelIcon level={card.level} />
          <span>{card.title}</span>
        </h3>
        <span className={`badge ${card.level === 'hold' ? 'danger' : card.level === 'caution' ? 'warn' : 'ok'}`} style={{ fontSize: 'var(--text-xs)' }}>
          {WORD[card.level]}
        </span>
      </div>
      {card.flags.length > 0 && (
        <ul style={{ margin: 'var(--space-2) 0', paddingLeft: '1.4em', display: 'grid', gap: 4 }}>
          {card.flags.map((f) => (
            <li key={f} style={{ fontWeight: 500 }}>
              {f}
            </li>
          ))}
        </ul>
      )}
      {card.advice && (
        <p className="advice" style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <IconLightbulb size={16} style={{ flexShrink: 0, marginTop: 2, color: 'var(--brand)' }} />
          <span>{card.advice}</span>
        </p>
      )}
    </section>
  );
}
