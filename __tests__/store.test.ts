/**
 * Store-level integration tests: drive the Zustand store exactly the way the
 * UI does (playHuman with moves from getLegalMoves) through a full sacrifice
 * turn, AI response, undo, and persistence round-trip.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLegalMoves } from '../src/engine';
import { useGameStore } from '../src/store/gameStore';
import { derive } from '../src/ui/selectors';
import { makeState, p } from './helpers';

jest.setTimeout(30_000);

const waitFor = async (pred: () => boolean, ms = 15_000): Promise<void> => {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > ms) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 25));
  }
};

/** Seed the store with a human-turn position (human = player 0, AI = player 1). */
function seed(gameOverrides: Parameters<typeof makeState>[0]) {
  useGameStore.setState({
    game: makeState(gameOverrides),
    humanPlayer: 0,
    log: [],
    history: [],
    aiThinking: false,
    settings: { difficulty: 'easy', humanFirst: true },
    screen: 'game',
    hydrated: true,
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('sacrifice turn through the store', () => {
  test('sacrifice -> two yellow moves -> turn passes to AI, which responds', async () => {
    seed({
      systems: [
        {
          id: 0,
          stars: [p('b', 1), p('y', 2)],
          ships0: [p('y', 2), p('g', 1), p('g', 2), p('r', 1)],
          home: 0,
        },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3), p('g', 3)], home: 1 },
        { id: 2, stars: [p('r', 3)], ships1: [p('b', 2)] },
      ],
    });
    const store = useGameStore.getState();

    // 1. Sacrifice y2 exactly as the UI offers it.
    let legal = getLegalMoves(useGameStore.getState().game!);
    let d = derive(legal, { system: 0, ship: p('y', 2) });
    expect(d.sacrificeMove).toBeDefined();
    store.playHuman(d.sacrificeMove!);

    let g = useGameStore.getState().game!;
    expect(g.phase).toBe('sacrifice');
    expect(g.sacrifice).toEqual({ color: 'y', actionsLeft: 2, total: 2 });

    // 2. First yellow action: move g1 to system 2 (home {1,2} -> {3} connects).
    legal = getLegalMoves(g);
    d = derive(legal, { system: 0, ship: p('g', 1) });
    expect(d.moveTargets.has(2)).toBe(true);
    store.playHuman(d.moveMoves.find((m) => m.to === 2)!);

    g = useGameStore.getState().game!;
    expect(g.phase).toBe('sacrifice');
    expect(g.sacrifice!.actionsLeft).toBe(1);

    // 3. Second yellow action: move g2 there too; sacrifice exhausts, AI plays.
    legal = getLegalMoves(g);
    d = derive(legal, { system: 0, ship: p('g', 2) });
    store.playHuman(d.moveMoves.find((m) => m.to === 2)!);

    await waitFor(() => {
      const s = useGameStore.getState();
      return !s.aiThinking && (s.game!.current === 0 || s.game!.phase === 'finished');
    });

    const finalState = useGameStore.getState();
    // Human made 3 log entries; the AI at least 1.
    expect(finalState.log.filter((e) => e.player === 0)).toHaveLength(3);
    expect(finalState.log.filter((e) => e.player === 1).length).toBeGreaterThanOrEqual(1);
    // One undo snapshot for the whole human turn (taken at the sacrifice).
    expect(finalState.history).toHaveLength(1);
  });

  test('ending a sacrifice early via the end move works from the store', async () => {
    seed({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3), p('r', 1)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    const store = useGameStore.getState();
    let d = derive(getLegalMoves(useGameStore.getState().game!), {
      system: 0,
      ship: p('g', 3),
    });
    store.playHuman(d.sacrificeMove!);
    d = derive(getLegalMoves(useGameStore.getState().game!), null);
    expect(d.endMove).toBeDefined();
    store.playHuman(d.endMove!);
    await waitFor(() => {
      const s = useGameStore.getState();
      return !s.aiThinking && s.game!.current === 0;
    });
    expect(useGameStore.getState().game!.phase).toBe('main');
  });

  test('undo rewinds the entire human turn including the AI reply', async () => {
    seed({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    const before = useGameStore.getState().game!;
    const store = useGameStore.getState();
    const build = getLegalMoves(before).find((m) => m.type === 'build')!;
    store.playHuman(build);
    await waitFor(() => {
      const s = useGameStore.getState();
      return !s.aiThinking && s.game!.current === 0;
    });
    expect(useGameStore.getState().log.length).toBeGreaterThanOrEqual(2);

    useGameStore.getState().undo();
    const after = useGameStore.getState();
    expect(after.game).toEqual(before);
    expect(after.log).toHaveLength(0);
    expect(after.history).toHaveLength(0);
  });

  test('state persists to AsyncStorage and hydrates back', async () => {
    seed({
      systems: [
        { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3)], home: 0 },
        { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
      ],
    });
    const store = useGameStore.getState();
    const build = getLegalMoves(useGameStore.getState().game!).find((m) => m.type === 'build')!;
    store.playHuman(build);
    await waitFor(() => {
      const s = useGameStore.getState();
      return !s.aiThinking && s.game!.current === 0;
    });
    const saved = useGameStore.getState().game!;

    // Simulate app restart: clear in-memory state, hydrate from storage.
    useGameStore.setState({ game: null, log: [], history: [], hydrated: false });
    await useGameStore.getState().hydrate();
    await waitFor(() => {
      const s = useGameStore.getState();
      return s.hydrated && !s.aiThinking;
    });
    expect(useGameStore.getState().game).toEqual(saved);
    expect(useGameStore.getState().screen).toBe('game');
  });
});
