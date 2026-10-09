import type { Card } from '../types';

const ICON: Record<Card['level'], string> = { hold: '✕', caution: '!', allow: '✓' };
const WORD: Record<Card['level'], string> = { hold: 'Held', caution: 'Careful', allow: 'Looks OK' };

/** The red-flag card. Colour is never the only signal: every level also has an icon and a word. */
export function RiskCard({ card, className = '' }: { card: Card; className?: string }) {
  return (
    <section className={`risk ${card.level} ${className}`} aria-label={`${WORD[card.level]}: ${card.title}`}>
      <h3>
        <span aria-hidden="true">{ICON[card.level]} </span>
        {card.title}
      </h3>
      {card.flags.length > 0 && (
        <ul>
          {card.flags.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
      {card.advice && <p className="advice">{card.advice}</p>}
    </section>
  );
}
