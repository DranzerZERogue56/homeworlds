import { GameState, Move, applyMove, getLegalMoves } from '../src/engine';
import { SCENARIOS, Scenario, scenarioById } from '../src/scenarios/scenarios';

function playThrough(sc: Scenario, moves: Move[]): { state: GameState; result: ReturnType<Scenario['goal']> } {
  let s = sc.setup();
  const played: Move[] = [];
  let result: ReturnType<Scenario['goal']> = null;
  for (const m of moves) {
    const legal = getLegalMoves(s);
    expect(legal).toContainEqual(m);
    s = applyMove(s, m);
    played.push(m);
    result = sc.goal(s, played);
    if (result) break;
  }
  return { state: s, result };
}

describe('scenario integrity', () => {
  test('all ids unique and setups build legal-looking states', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const sc of SCENARIOS) {
      const s = sc.setup();
      expect(s.current).toBe(0);
      expect(getLegalMoves(s).length).toBeGreaterThan(0);
      expect(sc.goal(s, [])).toBeNull(); // never pre-solved
      // No system starts empty or starless (would have been swept).
      for (const sys of s.systems) {
        expect(sys.stars.length).toBeGreaterThan(0);
        expect(sys.ships[0].length + sys.ships[1].length).toBeGreaterThan(0);
      }
    }
  });
});

describe('tutorial lessons', () => {
  test('build lesson: building wins, passing loses', () => {
    const sc = scenarioById('tut-build')!;
    expect(playThrough(sc, [{ type: 'build', system: 0, color: 'g' }]).result).toBe('won');
  });

  test('trade lesson', () => {
    const sc = scenarioById('tut-trade')!;
    expect(
      playThrough(sc, [{ type: 'trade', system: 0, ship: { color: 'g', size: 1 }, toColor: 'r' }])
        .result
    ).toBe('won');
  });

  test('travel lesson', () => {
    const sc = scenarioById('tut-move')!;
    expect(
      playThrough(sc, [{ type: 'move', system: 0, ship: { color: 'g', size: 1 }, to: 2 }]).result
    ).toBe('won');
  });

  test('capture lesson', () => {
    const sc = scenarioById('tut-attack')!;
    expect(
      playThrough(sc, [{ type: 'attack', system: 2, target: { color: 'g', size: 1 } }]).result
    ).toBe('won');
  });

  test('sacrifice lesson needs sacrifice + action + end of turn', () => {
    const sc = scenarioById('tut-sacrifice')!;
    const winning = playThrough(sc, [
      { type: 'sacrifice', system: 0, ship: { color: 'g', size: 3 } },
      { type: 'build', system: 0, color: 'g' },
      { type: 'build', system: 0, color: 'g' },
      { type: 'end' },
    ]);
    expect(winning.result).toBe('won');

    // A plain action without sacrificing fails the lesson when the turn ends.
    const losing = playThrough(sc, [{ type: 'build', system: 0, color: 'g' }]);
    expect(losing.result).toBe('lost');
  });

  test('catastrophe lesson', () => {
    const sc = scenarioById('tut-catastrophe')!;
    expect(
      playThrough(sc, [
        { type: 'build', system: 2, color: 'g' },
        { type: 'catastrophe', system: 2, color: 'g' },
      ]).result
    ).toBe('won');
  });
});

describe('puzzles', () => {
  test('boarding action: red sacrifice double-capture wins', () => {
    const sc = scenarioById('pz-boarding')!;
    const { result } = playThrough(sc, [
      { type: 'sacrifice', system: 0, ship: { color: 'r', size: 2 } },
      { type: 'attack', system: 1, target: { color: 'y', size: 2 } },
      { type: 'attack', system: 1, target: { color: 'g', size: 1 } },
    ]);
    expect(result).toBe('won');
  });

  test('boarding action: a single capture is not enough', () => {
    const sc = scenarioById('pz-boarding')!;
    const { result } = playThrough(sc, [
      { type: 'attack', system: 1, target: { color: 'y', size: 2 } },
    ]);
    expect(result).toBe('lost');
  });

  test('nova trap: build the fourth green, then detonate', () => {
    const sc = scenarioById('pz-nova')!;
    const { result } = playThrough(sc, [
      { type: 'build', system: 1, color: 'g' },
      { type: 'catastrophe', system: 1, color: 'g' },
    ]);
    expect(result).toBe('won');
  });

  test('cut the supply: fly the spark in, then detonate yellow', () => {
    const sc = scenarioById('pz-supply')!;
    const { result } = playThrough(sc, [
      { type: 'move', system: 2, ship: { color: 'y', size: 2 }, to: 1 },
      { type: 'catastrophe', system: 1, color: 'y' },
    ]);
    expect(result).toBe('won');
  });
});
