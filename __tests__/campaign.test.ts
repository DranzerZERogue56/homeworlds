/**
 * Campaign ladder tests: star scoring on finished games, unlock order,
 * and store integration — winning a campaign bout banks best-of stars
 * and persists them, exactly as the UI drives it.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FAST_WIN_TURNS,
  LADDER,
  MAX_STARS,
  starsEarned,
  totalStars,
  unlockedIndex,
} from '../src/campaign/campaign';
import { GameState, getLegalMoves } from '../src/engine';
import { useGameStore, DEFAULT_SETTINGS } from '../src/store/gameStore';
import { makeState, p } from './helpers';

jest.setTimeout(30_000);

const waitFor = async (pred: () => boolean, ms = 15_000): Promise<void> => {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > ms) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 25));
  }
};

function finished(overrides: {
  winner: GameState['winner'];
  turn?: number;
  homeShip0?: ReturnType<typeof p>;
}): GameState {
  const state = makeState({
    systems: [
      {
        id: 0,
        stars: [p('b', 1), p('y', 2)],
        ships0: [overrides.homeShip0 ?? p('g', 3)],
        home: 0,
      },
      { id: 1, stars: [p('b', 3), p('g', 2)], ships1: [p('y', 3)], home: 1 },
    ],
  });
  return { ...state, phase: 'finished', winner: overrides.winner, turn: overrides.turn ?? 10 };
}

describe('starsEarned', () => {
  test('loss and draw earn nothing', () => {
    expect(starsEarned(finished({ winner: 1 }), 0)).toBe(0);
    expect(starsEarned(finished({ winner: 'draw' }), 0)).toBe(0);
  });

  test('fast win with a surviving large = 3 stars', () => {
    expect(starsEarned(finished({ winner: 0, turn: FAST_WIN_TURNS }), 0)).toBe(3);
  });

  test('slow win without a large = 1 star', () => {
    expect(
      starsEarned(finished({ winner: 0, turn: FAST_WIN_TURNS + 1, homeShip0: p('g', 2) }), 0)
    ).toBe(1);
  });

  test('slow win with a large / fast win without one = 2 stars', () => {
    expect(starsEarned(finished({ winner: 0, turn: FAST_WIN_TURNS + 1 }), 0)).toBe(2);
    expect(starsEarned(finished({ winner: 0, homeShip0: p('g', 2) }), 0)).toBe(2);
  });
});

describe('ladder progress', () => {
  test('fresh campaign: only the first commander is unlocked', () => {
    expect(unlockedIndex({})).toBe(0);
    expect(totalStars({})).toBe(0);
  });

  test('beating a commander unlocks the next; gaps block later ranks', () => {
    expect(unlockedIndex({ [LADDER[0].id]: 1 })).toBe(1);
    // Stars on a later commander don't matter while an earlier one is unbeaten.
    expect(unlockedIndex({ [LADDER[0].id]: 1, [LADDER[2].id]: 3 })).toBe(1);
  });

  test('full ladder: index runs off the end and stars cap at MAX_STARS', () => {
    const all = Object.fromEntries(LADDER.map((c) => [c.id, 3]));
    expect(unlockedIndex(all)).toBe(LADDER.length);
    expect(totalStars(all)).toBe(MAX_STARS);
    expect(MAX_STARS).toBe(LADDER.length * 3);
  });
});

describe('campaign through the store', () => {
  /** Human (player 0) to move, one attack away from winning: the AI's only
   *  home ship is capturable by the human r2 stationed there. */
  function seedWinnable(extra: Partial<ReturnType<typeof useGameStore.getState>>) {
    useGameStore.setState({
      game: makeState({
        systems: [
          { id: 0, stars: [p('b', 1), p('y', 2)], ships0: [p('g', 3)], home: 0 },
          {
            id: 1,
            stars: [p('b', 3), p('g', 2)],
            ships0: [p('r', 2)],
            ships1: [p('g', 1)],
            home: 1,
          },
        ],
      }),
      humanPlayer: 0,
      log: [],
      history: [],
      aiThinking: false,
      settings: DEFAULT_SETTINGS,
      screen: 'game',
      hydrated: true,
      scenarioId: null,
      scenarioBackup: null,
      campaign: {},
      campaignPersonaId: null,
      personaId: null,
      ...extra,
    });
  }

  function winNow(): void {
    const store = useGameStore.getState();
    const attack = getLegalMoves(store.game!).find(
      (m) => m.type === 'attack' && m.system === 1
    );
    expect(attack).toBeDefined();
    store.playHuman(attack!);
    expect(useGameStore.getState().game!.phase).toBe('finished');
    expect(useGameStore.getState().game!.winner).toBe(0);
  }

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('winning a campaign bout banks the stars and persists them', async () => {
    seedWinnable({ campaign: {}, campaignPersonaId: 'bloop', personaId: 'bloop' });
    winNow();
    // Large survived at home, turn 10 <= cutoff: full marks.
    expect(useGameStore.getState().campaign.bloop).toBe(3);

    await waitFor(() => !useGameStore.getState().aiThinking);
    const raw = await AsyncStorage.getItem('homeworlds:save:v1');
    expect(JSON.parse(raw!).campaign.bloop).toBe(3);
  });

  test('a worse rematch never lowers the banked stars', () => {
    seedWinnable({ campaign: { bloop: 3 }, campaignPersonaId: 'bloop', personaId: 'bloop' });
    useGameStore.setState({ game: { ...useGameStore.getState().game!, turn: 40 } });
    winNow();
    expect(useGameStore.getState().campaign.bloop).toBe(3);
  });

  test('non-campaign wins record nothing', () => {
    seedWinnable({ campaign: {}, campaignPersonaId: null, personaId: 'bloop' });
    winNow();
    expect(useGameStore.getState().campaign).toEqual({});
  });

  test('startCampaignGame enters a bout; newGame leaves campaign mode', async () => {
    seedWinnable({});
    const store = useGameStore.getState();

    store.startCampaignGame('mira');
    let s = useGameStore.getState();
    expect(s.campaignPersonaId).toBe('mira');
    expect(s.personaId).toBe('mira');
    expect(s.screen).toBe('game');
    expect(s.game!.phase).toBe('setup');
    await waitFor(() => !useGameStore.getState().aiThinking);

    useGameStore.getState().newGame();
    s = useGameStore.getState();
    expect(s.campaignPersonaId).toBeNull();
    await waitFor(() => !useGameStore.getState().aiThinking);
  });
});
