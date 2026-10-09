export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

/** Test helper: a clock you can move. */
export function fakeClock(start: string | Date = '2026-10-09T12:00:00.000Z') {
  let t = new Date(start).getTime();
  const clock: Clock & { advance(ms: number): void; set(iso: string): void } = Object.assign(() => new Date(t), {
    advance(ms: number) {
      t += ms;
    },
    set(iso: string) {
      t = new Date(iso).getTime();
    },
  });
  return clock;
}
