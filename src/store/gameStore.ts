import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  GameState,
  Move,
  PlayerId,
  applyMove,
  initialState,
  moveToNotation,
} from '../engine';
import { Difficulty, chooseMove } from '../ai/ai';

const SAVE_KEY = 'homeworlds:save:v1';

export interface LogEntry {
  player: PlayerId;
  turn: number;
  text: string;
}

export interface Settings {
  difficulty: Difficulty;
  humanFirst: boolean;
}

interface Snapshot {
  game: GameState;
  log: LogEntry[];
}

export type Screen = 'menu' | 'game' | 'rules';

interface Store {
  screen: Screen;
  settings: Settings;
  game: GameState | null;
  log: LogEntry[];
  /** Snapshots taken right before each human move-of-turn, for undo. */
  history: Snapshot[];
  humanPlayer: PlayerId;
  aiThinking: boolean;
  hydrated: boolean;

  setScreen: (s: Screen) => void;
  setSettings: (s: Partial<Settings>) => void;
  newGame: () => void;
  abandonGame: () => void;
  /** Apply a human move (must already be validated against getLegalMoves). */
  playHuman: (move: Move) => void;
  undo: () => void;
  hydrate: () => Promise<void>;
}

let aiRunning = false;

async function persist(get: () => Store): Promise<void> {
  const { game, log, history, settings, humanPlayer } = get();
  try {
    await AsyncStorage.setItem(
      SAVE_KEY,
      JSON.stringify({ game, log, history, settings, humanPlayer })
    );
  } catch {
    // Persistence is best-effort; never crash gameplay over it.
  }
}

async function runAI(
  get: () => Store,
  set: (partial: Partial<Store>) => void
): Promise<void> {
  if (aiRunning) return;
  aiRunning = true;
  try {
    // Loop: one AI "turn" can be several atomic moves (setup, sacrifice
    // chains, catastrophe declarations, end-of-turn confirmations).
    for (;;) {
      const { game, humanPlayer, settings, log } = get();
      if (!game || game.phase === 'finished' || game.current === humanPlayer) break;
      set({ aiThinking: true });
      // Give the UI a beat so the "thinking" state paints before search starts.
      await new Promise((r) => setTimeout(r, 250));
      const stale = get().game;
      if (stale !== game) continue; // state changed under us (new game/undo)
      const move = await chooseMove(game, settings.difficulty);
      const current = get().game;
      if (current !== game) continue;
      const next = applyMove(game, move);
      set({
        game: next,
        log: [
          ...log,
          { player: game.current, turn: game.turn, text: moveToNotation(game, move) },
        ],
      });
      void persist(get);
    }
  } finally {
    aiRunning = false;
    set({ aiThinking: false });
  }
}

export const useGameStore = create<Store>((set, get) => ({
  screen: 'menu',
  settings: { difficulty: 'easy', humanFirst: true },
  game: null,
  log: [],
  history: [],
  humanPlayer: 0,
  aiThinking: false,
  hydrated: false,

  setScreen: (screen) => set({ screen }),

  setSettings: (partial) => {
    set({ settings: { ...get().settings, ...partial } });
    void persist(get);
  },

  newGame: () => {
    const { settings } = get();
    set({
      game: initialState(),
      log: [],
      history: [],
      humanPlayer: settings.humanFirst ? 0 : 1,
      screen: 'game',
    });
    void persist(get);
    void runAI(get, set);
  },

  abandonGame: () => {
    set({ game: null, log: [], history: [], screen: 'menu' });
    void persist(get);
  },

  playHuman: (move) => {
    const { game, humanPlayer, log, history } = get();
    if (!game || game.current !== humanPlayer) return;
    // Snapshot at the human's first move of the turn so undo rewinds a whole turn.
    const isTurnStart = game.phase === 'main' || game.phase === 'setup';
    const next = applyMove(game, move);
    set({
      game: next,
      log: [
        ...log,
        { player: game.current, turn: game.turn, text: moveToNotation(game, move) },
      ],
      history: isTurnStart ? [...history, { game, log }] : history,
    });
    void persist(get);
    void runAI(get, set);
  },

  undo: () => {
    const { history, aiThinking } = get();
    if (aiThinking || history.length === 0) return;
    const snapshot = history[history.length - 1];
    set({
      game: snapshot.game,
      log: snapshot.log,
      history: history.slice(0, -1),
    });
    void persist(get);
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({
          settings: data.settings ?? get().settings,
          game: data.game ?? null,
          log: data.log ?? [],
          history: data.history ?? [],
          humanPlayer: data.humanPlayer ?? 0,
          screen: data.game && data.game.phase !== 'finished' ? 'game' : 'menu',
        });
      }
    } catch {
      // Corrupt save: start fresh.
    }
    set({ hydrated: true });
    void runAI(get, set);
  },
}));
