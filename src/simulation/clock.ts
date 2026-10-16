import type { SimulationClock } from '../domain/simulation';

export function currentMinute(clock: SimulationClock): number {
  return clock.startMinute + clock.turn * clock.turnMinutes;
}

export function isFinished(clock: SimulationClock): boolean {
  return clock.turn >= clock.turnLimit;
}

export function formatMinute(minute: number): string {
  return `${Math.floor(minute / 60)
    .toString()
    .padStart(2, '0')}:${(minute % 60).toString().padStart(2, '0')}`;
}
