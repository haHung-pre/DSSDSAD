/** Injectable clock so that time-dependent logic can be tested deterministically. */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

export function isoNow(clock: Clock = systemClock): string {
  return clock().toISOString();
}
