import { getLegalMoves } from '../src/engine';
import { actionableShipKeys, sacrificeProgress, shipKey } from '../src/ui/selectors';
import { makeState, p, playLegal } from './helpers';

/**
 * Full sacrifice chains for every color and size, exercised through
 * getLegalMoves + applyMove exactly as the UI does. Guards the reported
 * "sacrifice only grants one action" failure mode.
 */
describe('sacrifice chains grant size-many actions', () => {
  test('green 3: three consecutive builds', () => {
    let s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3), p('g', 1)], home: 0 },
        { id: 1, stars: [p('b', 3), p('r', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    s = playLegal(s, { type: 'sacrifice', system: 0, ship: p('g', 3) });
    expect(s.sacrifice).toEqual({ color: 'g', actionsLeft: 3, total: 3 });

    for (let i = 3; i >= 1; i--) {
      expect(s.phase).toBe('sacrifice');
      expect(s.sacrifice!.actionsLeft).toBe(i);
      const prog = sacrificeProgress(s)!;
      expect(prog.step).toBe(3 - i + 1);
      expect(prog.total).toBe(3);
      expect(prog.stuck).toBe(false);
      s = playLegal(s, { type: 'build', system: 0, color: 'g' });
    }
    // Third build made 4 greens at home -> catastrophe pause, else turn ends.
    expect(['post', 'main']).toContain(s.phase);
    expect(s.current === 1 || s.phase === 'post').toBe(true);
  });

  test('yellow 2: two moves with different ships', () => {
    let s = makeState({
      systems: [
        {
          id: 0,
          stars: [p('b', 1), p('y', 2)],
          ships0: [p('y', 2), p('g', 1), p('r', 1), p('b', 2)],
          home: 0,
        },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
        { id: 2, stars: [p('r', 3)], ships1: [p('g', 3)] },
      ],
    });
    s = playLegal(s, { type: 'sacrifice', system: 0, ship: p('y', 2) });
    expect(s.sacrifice!.actionsLeft).toBe(2);

    // Home {1,2} connects to Sys2 {3}.
    s = playLegal(s, { type: 'move', system: 0, ship: p('g', 1), to: 2 });
    expect(s.phase).toBe('sacrifice');
    expect(s.sacrifice!.actionsLeft).toBe(1);

    s = playLegal(s, { type: 'move', system: 0, ship: p('r', 1), to: 2 });
    expect(s.phase).toBe('main');
    expect(s.current).toBe(1);
  });

  test('blue 2: two trades, including re-trading the same ship', () => {
    let s = makeState({
      systems: [
        { id: 0, stars: [p('g', 1), p('y', 2)], ships0: [p('b', 2), p('r', 1)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    s = playLegal(s, { type: 'sacrifice', system: 0, ship: p('b', 2) });
    s = playLegal(s, { type: 'trade', system: 0, ship: p('r', 1), toColor: 'g' });
    expect(s.phase).toBe('sacrifice');
    s = playLegal(s, { type: 'trade', system: 0, ship: p('g', 1), toColor: 'y' });
    expect(s.current).toBe(1);
  });

  test('red 2: two captures at the same contested system', () => {
    let s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('r', 2), p('g', 3)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
        {
          id: 2,
          stars: [p('r', 3)],
          ships0: [p('r', 1)],
          ships1: [p('y', 1), p('g', 1)],
        },
      ],
    });
    s = playLegal(s, { type: 'sacrifice', system: 0, ship: p('r', 2) });
    s = playLegal(s, { type: 'attack', system: 2, target: p('y', 1) });
    expect(s.phase).toBe('sacrifice');
    s = playLegal(s, { type: 'attack', system: 2, target: p('g', 1) });
    expect(s.current).toBe(1);
  });

  test('mid-chain catastrophe pause does not eat remaining actions', () => {
    // Building the 4th green mid-chain must keep the sacrifice alive.
    let s = makeState({
      systems: [
        {
          id: 0,
          stars: [p('b', 1), p('g', 2)],
          ships0: [p('g', 3), p('g', 1)],
          home: 0,
        },
        { id: 1, stars: [p('b', 3), p('r', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    s = playLegal(s, { type: 'sacrifice', system: 0, ship: p('g', 3) });
    // Build #1 -> star g2 + ships g1,g1 = 3 greens... build again -> 4 greens.
    s = playLegal(s, { type: 'build', system: 0, color: 'g' });
    expect(s.phase).toBe('sacrifice');
    s = playLegal(s, { type: 'build', system: 0, color: 'g' });
    // Catastrophe now available, but one action remains: still in sacrifice.
    expect(s.phase).toBe('sacrifice');
    expect(s.sacrifice!.actionsLeft).toBe(1);
    expect(getLegalMoves(s).some((m) => m.type === 'catastrophe')).toBe(true);
    // Player may keep going.
    s = playLegal(s, { type: 'build', system: 0, color: 'g' });
    expect(s.phase).toBe('post'); // catastrophe still pending at end of chain
  });

  test('forgoing remaining actions with end is always offered', () => {
    let s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3), p('g', 1)], home: 0 },
        { id: 1, stars: [p('b', 3), p('r', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    s = playLegal(s, { type: 'sacrifice', system: 0, ship: p('g', 3) });
    s = playLegal(s, { type: 'build', system: 0, color: 'g' });
    expect(s.sacrifice!.actionsLeft).toBe(2);
    s = playLegal(s, { type: 'end' });
    expect(s.phase).toBe('main');
    expect(s.current).toBe(1);
  });

  test('stuck chain (no legal color actions) is reported, end remains legal', () => {
    // Red sacrifice with no enemy ships anywhere reachable: zero red actions.
    let s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('r', 3), p('g', 1)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    s = playLegal(s, { type: 'sacrifice', system: 0, ship: p('r', 3) });
    const prog = sacrificeProgress(s)!;
    expect(prog.stuck).toBe(true);
    expect(prog.left).toBe(3);
    expect(getLegalMoves(s).some((m) => m.type === 'end')).toBe(true);
    s = playLegal(s, { type: 'end' });
    expect(s.current).toBe(1);
  });
});

describe('actionableShipKeys', () => {
  test('marks exactly the ships with something to do during a yellow sacrifice', () => {
    let s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('y', 2), p('g', 1)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    s = playLegal(s, { type: 'sacrifice', system: 0, ship: p('y', 2) });
    const keys = actionableShipKeys(getLegalMoves(s), s);
    // The remaining g1 can move/discover; it is the only own ship left.
    expect(keys.has(shipKey(0, p('g', 1)))).toBe(true);
    expect(keys.size).toBe(1);
  });

  test('build marks every own ship at the system', () => {
    const s = makeState({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3), p('r', 1)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    const keys = actionableShipKeys(getLegalMoves(s), s);
    expect(keys.has(shipKey(0, p('g', 3)))).toBe(true);
    expect(keys.has(shipKey(0, p('r', 1)))).toBe(true);
  });
});
