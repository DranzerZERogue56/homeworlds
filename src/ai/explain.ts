import { COLOR_NAMES, GameState, Move, PlayerId } from '../engine';

const sysName = (state: GameState, id: number): string =>
  state.systems.find((s) => s.id === id)?.name ?? 'a lost system';

const piece = (p: { color: string; size: number }): string =>
  `${['small', 'medium', 'large'][p.size - 1]} ${COLOR_NAMES[p.color as keyof typeof COLOR_NAMES]}`;

/**
 * Plain-English description of a move, from the perspective of the player
 * making it, addressed to their opponent ("your homeworld"). `before` is the
 * state the move was applied to.
 */
export function explainMove(before: GameState, move: Move, opponent: PlayerId): string {
  const oppHome = before.systems.find((s) => s.home === opponent);
  switch (move.type) {
    case 'setup':
      return 'founded their homeworld';
    case 'build':
      return `built a ${COLOR_NAMES[move.color]} ship at ${sysName(before, move.system)}`;
    case 'trade':
      return `traded a ${piece(move.ship)} ship into ${COLOR_NAMES[move.toColor]} at ${sysName(before, move.system)}`;
    case 'move': {
      const invading = oppHome && move.to === oppHome.id;
      return `moved a ${piece(move.ship)} ship from ${sysName(before, move.system)} to ${sysName(before, move.to)}${invading ? ' — invading your homeworld!' : ''}`;
    }
    case 'discover':
      return `discovered a new ${COLOR_NAMES[move.star.color]} system with a ${piece(move.ship)} ship`;
    case 'attack': {
      const atHome = oppHome && move.system === oppHome.id;
      return `captured your ${piece(move.target)} ship at ${sysName(before, move.system)}${atHome ? ' — inside your homeworld!' : ''}`;
    }
    case 'sacrifice': {
      const n = move.ship.size;
      return `sacrificed a ${piece(move.ship)} ship for ${n} ${COLOR_NAMES[move.ship.color]} action${n === 1 ? '' : 's'}`;
    }
    case 'catastrophe':
      return `triggered a ${COLOR_NAMES[move.color]} catastrophe at ${sysName(before, move.system)}!`;
    case 'end':
      return 'ended their turn';
  }
}
