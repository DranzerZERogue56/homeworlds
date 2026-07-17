import { getLegalMoves } from '../src/engine';
import { derive, moveLosesGame, sacrificeHint } from '../src/ui/selectors';
import { makeState, p, playLegal } from './helpers';

describe('UI move derivation (derive)', () => {
  test('selected ship exposes exactly its legal options', () => {
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3), p('y', 1)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
        { id: 2, stars: [p('r', 3)], ships1: [p('g', 1)] },
      ],
    });
    const legal = getLegalMoves(s);
    const d = derive(legal, { system: 0, ship: p('y', 1) });

    // Home 0 {1,2} connects only to system 2 {3}.
    expect([...d.moveTargets]).toEqual([2]);
    // Discover: only size-3 stars.
    expect(d.discoverMoves.length).toBeGreaterThan(0);
    expect(d.discoverMoves.every((m) => m.star.size === 3)).toBe(true);
    // Green available via own g3 ship: builds offered for both ship colors.
    expect(d.buildMoves.map((m) => m.color).sort()).toEqual(['g', 'y']);
    // Blue via b1 star: y1 trades into 3 other colors.
    expect(d.tradeMoves).toHaveLength(3);
    // No red at home 0 and no enemy ships there.
    expect(d.attackMoves).toHaveLength(0);
    expect(d.sacrificeMove).toBeDefined();
    expect(d.selectionIsDead).toBe(false);
  });

  test('no selection still surfaces catastrophes and end', () => {
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
        { id: 2, stars: [p('g', 3)], ships0: [p('g', 1), p('g', 1)], ships1: [p('g', 2)] },
      ],
    });
    const d = derive(getLegalMoves(s), null);
    expect(d.catastropheMoves).toHaveLength(1);
    expect(d.moveTargets.size).toBe(0);
    expect(d.selectionIsDead).toBe(false);
  });

  test('during a sacrifice, derive offers only that color and flags dead selections', () => {
    let s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('y', 2), p('g', 1)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    s = playLegal(s, { type: 'sacrifice', system: 0, ship: p('y', 2) });
    const legal = getLegalMoves(s);
    const d = derive(legal, { system: 0, ship: p('g', 1) });
    // Yellow sacrifice: the g1 may move/discover; no builds or trades offered.
    expect(d.buildMoves).toHaveLength(0);
    expect(d.tradeMoves).toHaveLength(0);
    expect(d.sacrificeMove).toBeUndefined(); // cannot nest sacrifices
    expect(d.discoverMoves.length).toBeGreaterThan(0);
    expect(d.endMove).toBeDefined();
  });

  test('a ship with no legal actions is flagged dead', () => {
    // Red sacrifice with one action; the selected ship sits alone with no enemies.
    let s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('r', 1), p('g', 1)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    s = playLegal(s, { type: 'sacrifice', system: 0, ship: p('r', 1) });
    const d = derive(getLegalMoves(s), { system: 0, ship: p('g', 1) });
    expect(d.selectionIsDead).toBe(true);
    expect(d.endMove).toBeDefined(); // the way out is ending the turn
  });
});

describe('moveLosesGame', () => {
  test('flags abandoning your homeworld', () => {
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('y', 3)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3), p('g', 1)], home: 1 },
        { id: 2, stars: [p('r', 3)], ships1: [p('g', 2)] },
      ],
    });
    expect(moveLosesGame(s, { type: 'move', system: 0, ship: p('y', 3), to: 2 }, 0)).toBe(true);
    expect(
      moveLosesGame(s, { type: 'discover', system: 0, ship: p('y', 3), star: p('r', 3) }, 0)
    ).toBe(true);
  });

  test('flags sacrificing your last home ship, not a safe sacrifice', () => {
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3), p('g', 1)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    expect(moveLosesGame(s, { type: 'sacrifice', system: 0, ship: p('g', 3) }, 0)).toBe(false);

    const lone = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    expect(moveLosesGame(lone, { type: 'sacrifice', system: 0, ship: p('g', 3) }, 0)).toBe(true);
  });
});

describe('sacrificeHint', () => {
  test('has guidance for every color', () => {
    for (const c of ['r', 'y', 'g', 'b'] as const) {
      expect(sacrificeHint(c).length).toBeGreaterThan(10);
    }
  });
});
