// Browser code for the Second Opinion card (an MCP App view). Bundled into one HTML string by scripts/build-card.mjs.
// It only displays what the tool returned; it never decides anything and cannot approve a hold.
import { App } from '@modelcontextprotocol/ext-apps';

type Level = 'allow' | 'caution' | 'hold';
interface CheckShape {
  verdict?: Level;
  spokenSummary?: string;
  card?: { title?: string; level?: Level; flags?: string[]; advice?: string };
  decision?: { outcome?: string; reasonText?: string[] };
}
interface HoldShape {
  hold?: { status?: string; description?: string; payee?: string | null; amountCents?: number | null };
  risk?: { verdict?: Level; flags?: string[] };
  votes?: Array<{ name: string; decision: string }>;
}

const LABEL: Record<Level, string> = { hold: 'Paused for your family', caution: 'Be careful', allow: 'Looks fine' };
const STATUS: Record<string, string> = {
  pending: 'Waiting for a family member to decide',
  released: 'Approved by your family',
  denied: 'Your family said no',
  expired: 'Timed out, still blocked',
};

const root = document.getElementById('card')!;

function money(cents?: number | null): string {
  return typeof cents === 'number' ? `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0 })}` : '';
}

function render(level: Level, headline: string, flags: string[], advice: string, footer: string): void {
  root.className = `card ${level}`;
  root.replaceChildren();
  const add = (tag: string, cls: string, text: string) => {
    const el = document.createElement(tag);
    el.className = cls;
    el.textContent = text;
    root.appendChild(el);
    return el;
  };
  add('div', 'badge', LABEL[level]);
  add('p', 'headline', headline);
  if (flags.length) {
    const ul = document.createElement('ul');
    ul.className = 'flags';
    for (const f of flags.slice(0, 4)) {
      const li = document.createElement('li');
      li.textContent = f;
      ul.appendChild(li);
    }
    root.appendChild(ul);
  }
  if (advice) add('p', 'advice', advice);
  if (footer) add('p', 'footer', footer);
}

function show(sc: CheckShape & HoldShape | undefined): void {
  if (!sc) return render('caution', 'I could not check this right now.', [], 'Please ask your family before paying.', 'Nothing was done.');
  if (sc.hold) {
    const level = sc.risk?.verdict ?? 'hold';
    const amount = money(sc.hold.amountCents);
    const what = [sc.hold.description, amount ? `(${amount})` : ''].filter(Boolean).join(' ');
    const votes = (sc.votes ?? []).map((v) => `${v.name}: ${v.decision === 'approve' ? 'yes' : 'no'}`).join(', ');
    return render(level, what || 'A request is waiting', sc.risk?.flags ?? [], '', [STATUS[sc.hold.status ?? ''] ?? '', votes].filter(Boolean).join(' · '));
  }
  const level = sc.card?.level ?? sc.verdict ?? 'caution';
  const blocked = sc.decision?.outcome === 'block';
  const footer = blocked
    ? `Not allowed by your family's rules. ${(sc.decision?.reasonText ?? []).join(' ')}`.trim()
    : level === 'allow' ? '' : 'Alexa cannot approve this. Only your family can.';
  render(level, sc.spokenSummary ?? sc.card?.title ?? '', sc.card?.flags ?? [], sc.card?.advice ?? '', footer);
}

const app = new App({ name: 'Second Opinion card', version: '0.1.0' });
app.ontoolresult = (result) => show(result.structuredContent as (CheckShape & HoldShape) | undefined);
app.connect().catch(() => show(undefined));
