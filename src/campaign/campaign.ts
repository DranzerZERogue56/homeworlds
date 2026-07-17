import { PERSONAS, Persona } from '../ai/ai';
import { GameState, PlayerId } from '../engine';

/** The campaign ladder: every commander in rank order, Bloop → Nyx. */
export const LADDER: Persona[] = PERSONAS;

/** Star cutoff: win on or before this full-turn count for the speed star. */
export const FAST_WIN_TURNS = 24;

/** Every star the ladder can award (3 per commander). */
export const MAX_STARS = LADDER.length * 3;

/**
 * Stars earned for a finished campaign game: 0 if not a win, else
 * 1 (win) + 1 (a large ship of yours survived) + 1 (won by turn 24).
 */
export function starsEarned(state: GameState, human: PlayerId): number {
  if (state.winner !== human) return 0;
  let stars = 1;
  const hasLarge = state.systems.some((sys) =>
    sys.ships[human].some((p) => p.size === 3)
  );
  if (hasLarge) stars++;
  if (state.turn <= FAST_WIN_TURNS) stars++;
  return stars;
}

/** Index of the first commander not yet beaten; everything after is locked. */
export function unlockedIndex(campaign: Record<string, number>): number {
  for (let i = 0; i < LADDER.length; i++) {
    if (!campaign[LADDER[i].id]) return i;
  }
  return LADDER.length; // ladder complete
}

export function totalStars(campaign: Record<string, number>): number {
  return LADDER.reduce((n, p) => n + (campaign[p.id] ?? 0), 0);
}
