import type { Card } from '../types';

const ICON: Record<Card['level'], string> = { hold: '✕', caution: '!', allow: '✓' };
const WORD: Record<Card['level'], string> = { hold: 'Held', caution: 'Careful', allow: 'Looks OK' };

/** The red-flag card. Colour is never the only signal: every level also has an icon and a word. */
export function RiskCard({ card, className = '' }: { card: Card; className?: string }) {
  const iconEmoji = card.level === 'hold' ? '🚨' : card.level === 'caution' ? '⚠️' : '✅';
  return (
    <section className={`risk ${card.level} ${className}`} aria-label={`${WORD[card.level]}: ${card.title}`}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span aria-hidden="true" style={{ fontWeight: 800 }}>{ICON[card.level]} </span>
          <span>{card.title}</span>
        </h3>
        <span aria-hidden="true" style={{ fontSize: '1.15rem' }}>{iconEmoji}</span>
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
        <p className="advice">
          <span aria-hidden="true" style={{ marginRight: 4 }}>💡</span>
          {card.advice}
        </p>
      )}
    </section>
  );
}
