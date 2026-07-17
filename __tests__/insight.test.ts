import { advantage } from '../src/ai/ai';
import { explainMove } from '../src/ai/explain';
import { GameState, Move, applyMove, getLegalMoves, initialState } from '../src/engine';
import { makeState, p } from './helpers';

describe('advantage (eval bar)', () => {
  test('symmetric position is near even', () => {
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3)], home: 0 },
        { id: 1, stars: [p('b', 2), p('y', 1)], ships1: [p('g', 3)], home: 1 },
      ],
    });
    expect(Math.abs(advantage(s))).toBeLessThan(0.15);
  });

  test('material edge favors the right side and stays in [-1, 1]', () => {
    const s = makeState({
      systems: [
        {
          id: 0,
          stars: [p('b', 1), p('y', 2)],
          ships0: [p('g', 3), p('r', 3), p('y', 3), p('b', 3)],
          home: 0,
        },
        { id: 1, stars: [p('b', 2), p('y', 1)], ships1: [p('g', 1)], home: 1 },
      ],
    });
    const v = advantage(s);
    expect(v).toBeGreaterThan(0.3);
    expect(v).toBeLessThanOrEqual(1);
  });

  test('finished game pins the bar', () => {
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3)], home: 0 },
        { id: 1, stars: [p('b', 2), p('y', 1)], ships1: [p('g', 3)], home: 1 },
      ],
    });
    (s as GameState).winner = 0;
    expect(advantage(s)).toBeCloseTo(1, 5);
  });
});

describe('explainMove', () => {
  const base = () =>
    makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3), p('y', 1)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships0: [p('r', 2)], ships1: [p('y', 3)], home: 1 },
      ],
      current: 0,
    });

  test('capture inside the opponent homeworld is called out', () => {
    const s = base();
    const text = explainMove(s, { type: 'attack', system: 1, target: p('y', 3) }, 1);
    expect(text).toContain('captured your large yellow ship');
    expect(text).toContain('inside your homeworld');
  });

  test('move into the opponent homeworld reads as an invasion', () => {
    const s = base();
    const text = explainMove(s, { type: 'move', system: 0, ship: p('y', 1), to: 1 }, 1);
    expect(text).toContain('invading your homeworld');
  });

  test('sacrifice explains the action count', () => {
    const s = base();
    const text = explainMove(s, { type: 'sacrifice', system: 0, ship: p('g', 3) }, 1);
    expect(text).toBe('sacrificed a large green ship for 3 green actions');
  });

  test('every legal move from an opening position explains without throwing', () => {
    const s = base();
    for (const m of getLegalMoves(s)) {
      expect(explainMove(s, m, 1).length).toBeGreaterThan(0);
    }
  });
});

describe('replay timeline', () => {
  test('a recorded move list folds back into legal states', () => {
    // Simulate a short recorded game exactly as the store does.
    let s = initialState();
    const moves: Move[] = [];
    for (let i = 0; i < 24 && s.phase !== 'finished'; i++) {
      const legal = getLegalMoves(s);
      const move = legal[i % legal.length];
      moves.push(move);
      s = applyMove(s, move);
    }
    // Fold like ReplayScreen.
    let replay = initialState();
    for (const m of moves) replay = applyMove(replay, m);
    expect(replay).toEqual(s);
  });
});
