import type { Context, Verdict } from '@second-opinion/shared';

export interface Fixture {
  id: string;
  label: 'scam' | 'benign';
  text: string;
  ctx?: Context;
  expect: Verdict[];
  note: string;
}

/** Invented text only. 4 scam, 4 benign, 4 tricky (mixed). */
export const FIXTURES: Fixture[] = [
  { id: 'f-scam-1', label: 'scam', note: 'hero: gift cards + bank + urgency', expect: ['hold'],
    text: 'The bank says I have to buy five $200 gift cards today or my account is frozen.',
    ctx: { actionType: 'purchase', payee: 'gift cards' } },
  { id: 'f-scam-2', label: 'scam', note: 'remote access + authority', expect: ['hold'],
    text: 'A man from Microsoft support said to install AnyDesk so he can fix my computer, he needs to connect to your computer right now.' },
  { id: 'f-scam-3', label: 'scam', note: 'verification code + unsolicited', expect: ['hold'],
    text: "This is the fraud department calling about your account. Please read me the 6 digit code we just texted you." },
  { id: 'f-scam-4', label: 'scam', note: 'family emergency + secrecy', expect: ['hold'],
    text: "Grandma it's me, your grandson. I was in an accident and need bail money by wire transfer today. Please don't tell mom." },
  { id: 'f-ok-1', label: 'benign', note: 'pharmacy refill reminder', expect: ['allow'],
    text: 'Your prescription is ready for pickup at Greenleaf Pharmacy. Reply STOP to opt out.' },
  { id: 'f-ok-2', label: 'benign', note: 'trusted utility payment', expect: ['allow'],
    text: 'Pay City Power & Light $86.40 for the October bill.',
    ctx: { actionType: 'payment', payee: 'City Power & Light', trustedPayees: ['city power & light'] } },
  { id: 'f-ok-3', label: 'benign', note: 'family chat', expect: ['allow'],
    text: 'Can you send me the recipe for the soup you made on Sunday?' },
  { id: 'f-ok-4', label: 'benign', note: 'appointment reminder', expect: ['allow'],
    text: 'Reminder: your appointment with Dr. Lee is Thursday at 10 AM.' },
  { id: 'f-tricky-1', label: 'benign', note: 'genuine bank fraud alert: authority + unsolicited, but official-channel advice', expect: ['allow'],
    text: "Your bank noticed a suspicious charge on your card. If this wasn't you, call the number on the back of your card. We will never ask for your PIN or a code." },
  { id: 'f-tricky-2', label: 'benign', note: 'warning about gift cards is not a request', expect: ['allow', 'caution'],
    text: 'Reminder from your credit union: we will never ask you to pay with gift cards.' },
  { id: 'f-tricky-3', label: 'scam', note: 'polite, no keywords: new payee + large amount only', expect: ['caution', 'hold', 'allow'],
    text: 'Please send $900 to my cousin Daniel for the car repair.',
    ctx: { actionType: 'transfer', payee: 'Daniel' } },
  { id: 'f-tricky-4', label: 'benign', note: 'delivery notice mentions today', expect: ['allow'],
    text: 'Your package will arrive today between 2 and 4 PM.' },
];
