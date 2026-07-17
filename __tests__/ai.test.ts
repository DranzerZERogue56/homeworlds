import { applyMove, getLegalMoves, initialState } from '../src/engine';
import {
  Difficulty,
  PERSONAS,
  chooseMove,
  personasFor,
  randomPersona,
} from '../src/ai/ai';

jest.setTimeout(120_000);

describe('AI plays only legal moves', () => {
  test('easy vs easy self-play: every chosen move is in getLegalMoves', async () => {
    let s = initialState();
    for (let step = 0; step < 300 && s.phase !== 'finished'; step++) {
      const legal = getLegalMoves(s);
      const move = await chooseMove(s, 'easy');
      expect(legal).toContainEqual(move);
      s = applyMove(s, move);
    }
  });

  test('medium picks a legal move from a fresh game within the time cap', async () => {
    let s = initialState();
    // Play through setup with easy, then one medium move.
    while (s.phase === 'setup') s = applyMove(s, await chooseMove(s, 'easy'));
    const start = Date.now();
    const move = await chooseMove(s, 'medium');
    expect(Date.now() - start).toBeLessThan(5000);
    expect(getLegalMoves(s)).toContainEqual(move);
  });

  test('hard picks a legal move', async () => {
    let s = initialState();
    while (s.phase === 'setup') s = applyMove(s, await chooseMove(s, 'easy'));
    const move = await chooseMove(s, 'hard');
    expect(getLegalMoves(s)).toContainEqual(move);
  });

  test('every tier picks a legal move with a persona applied', async () => {
    const tiers: Difficulty[] = ['easy', 'lessEasy', 'medium', 'hard', 'masterful'];
    let s = initialState();
    while (s.phase === 'setup') s = applyMove(s, await chooseMove(s, 'easy'));
    for (const tier of tiers) {
      const persona = randomPersona(tier);
      const start = Date.now();
      const move = await chooseMove(s, tier, persona);
      expect(Date.now() - start).toBeLessThan(6000);
      expect(getLegalMoves(s)).toContainEqual(move);
    }
  });
});

describe('personas', () => {
  test('every difficulty has at least two commanders', () => {
    for (const tier of ['easy', 'lessEasy', 'medium', 'hard', 'masterful'] as Difficulty[]) {
      expect(personasFor(tier).length).toBeGreaterThanOrEqual(2);
    }
  });

  test('persona ids are unique', () => {
    const ids = PERSONAS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
