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
import { Difficulty, chooseMove, personaById, randomPersona } from '../ai/ai';
import { explainMove } from '../ai/explain';
import { starsEarned } from '../campaign/campaign';
import { scenarioById } from '../scenarios/scenarios';

const SAVE_KEY = 'homeworlds:save:v1';

export interface LogEntry {
  player: PlayerId;
  turn: number;
  text: string;
  /** The structured move, for replays. Absent only in pre-1.5 saves. */
  move?: Move;
  /** Plain-English description (AI moves), shown in the ticker. */
  explain?: string;
}

export interface Settings {
  difficulty: Difficulty;
  humanFirst: boolean;
  /** Master switch for UI motion (pulses, slides, glides). */
  animations: boolean;
  /** Show the live advantage meter during play (always on in replays). */
  evalBar: boolean;
  /** Ask before committing any move. */
  confirmMoves: boolean;
  /** Add letter glyphs to pieces for colorblind players. */
  colorblind: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  difficulty: 'easy',
  humanFirst: true,
  animations: true,
  evalBar: false,
  confirmMoves: false,
  colorblind: false,
};

interface Snapshot {
  game: GameState;
  log: LogEntry[];
}

export type Screen = 'menu' | 'game' | 'rules' | 'settings' | 'replay' | 'academy' | 'campaign';

interface Store {
  screen: Screen;
  settings: Settings;
  game: GameState | null;
  log: LogEntry[];
  /** Snapshots taken right before each human move-of-turn, for undo. */
  history: Snapshot[];
  humanPlayer: PlayerId;
  /** Persona id of this game's AI commander (picked at newGame). */
  personaId: string | null;
  aiThinking: boolean;
  hydrated: boolean;
  /** Systems the AI touched on its last turn (for the "what changed" highlight). */
  aiLastSystems: number[];
  /** Active Academy scenario id; scenarios never run the AI. */
  scenarioId: string | null;
  /** Real game stashed while a scenario is played. */
  scenarioBackup: Snapshot | null;
  /** Completed scenario ids. */
  scenarioDone: Record<string, boolean>;
  /** Campaign ladder: personaId -> best stars earned (0-3). */
  campaign: Record<string, number>;
  /** Set while the current game is a campaign bout. */
  campaignPersonaId: string | null;

  setScreen: (s: Screen) => void;
  startScenario: (id: string) => void;
  exitScenario: (opts?: { completed?: boolean }) => void;
  startCampaignGame: (personaId: string) => void;
  setSettings: (s: Partial<Settings>) => void;
  newGame: () => void;
  abandonGame: () => void;
  /** Apply a human move (must already be validated against getLegalMoves). */
  playHuman: (move: Move) => void;
  undo: () => void;
  hydrate: () => Promise<void>;
}

let aiRunning = false;

/** When a campaign bout finishes, bank the best star count (idempotent). */
function maybeRecordCampaign(
  get: () => Store,
  set: (partial: Partial<Store>) => void
): void {
  const { game, humanPlayer, campaignPersonaId, campaign } = get();
  if (!game || game.phase !== 'finished' || !campaignPersonaId) return;
  const stars = starsEarned(game, humanPlayer);
  const best = Math.max(campaign[campaignPersonaId] ?? 0, stars);
  if (best !== (campaign[campaignPersonaId] ?? 0)) {
    set({ campaign: { ...campaign, [campaignPersonaId]: best } });
    void persist(get);
  }
}

async function persist(get: () => Store): Promise<void> {
  const {
    game, log, history, settings, humanPlayer, personaId, aiLastSystems,
    scenarioDone, campaign, campaignPersonaId,
  } = get();
  try {
    await AsyncStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        game, log, history, settings, humanPlayer, personaId, aiLastSystems,
        scenarioDone, campaign, campaignPersonaId,
      })
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
    let touched: number[] | null = null;
    for (;;) {
      const { game, humanPlayer, settings, log } = get();
      if (!game || game.phase === 'finished' || game.current === humanPlayer) break;
      if (touched === null) {
        touched = [];
        set({ aiLastSystems: [] });
      }
      set({ aiThinking: true });
      // Give the UI a beat so the "thinking" state paints before search starts.
      await new Promise((r) => setTimeout(r, 250));
      const stale = get().game;
      if (stale !== game) continue; // state changed under us (new game/undo)
      const activePersona = personaById(get().personaId);
      const difficulty =
        (get().campaignPersonaId ? activePersona?.difficulty : null) ?? settings.difficulty;
      const move = await chooseMove(game, difficulty, activePersona);
      const current = get().game;
      if (current !== game) continue;
      const next = applyMove(game, move);
      if ('system' in move) touched.push(move.system);
      if (move.type === 'move') touched.push(move.to);
      if (move.type === 'discover') touched.push(next.nextSystemId - 1);
      set({
        game: next,
        log: [
          ...log,
          {
            player: game.current,
            turn: game.turn,
            text: moveToNotation(game, move),
            move,
            explain: explainMove(game, move, humanPlayer),
          },
        ],
        aiLastSystems: [...new Set(touched)],
      });
      void persist(get);
    }
  } finally {
    aiRunning = false;
    set({ aiThinking: false });
    maybeRecordCampaign(get, set);
  }
}

export const useGameStore = create<Store>((set, get) => ({
  screen: 'menu',
  settings: DEFAULT_SETTINGS,
  game: null,
  log: [],
  history: [],
  humanPlayer: 0,
  personaId: null,
  aiThinking: false,
  hydrated: false,
  aiLastSystems: [],
  scenarioId: null,
  scenarioBackup: null,
  scenarioDone: {},
  campaign: {},
  campaignPersonaId: null,

  setScreen: (screen) => set({ screen }),

  startCampaignGame: (personaId) => {
    const { settings } = get();
    set({
      game: initialState(),
      log: [],
      history: [],
      humanPlayer: settings.humanFirst ? 0 : 1,
      personaId,
      campaignPersonaId: personaId,
      screen: 'game',
      aiLastSystems: [],
      scenarioId: null,
      scenarioBackup: null,
    });
    void persist(get);
    void runAI(get, set);
  },

  startScenario: (id) => {
    const sc = scenarioById(id);
    if (!sc) return;
    const { game, log, scenarioId, scenarioBackup } = get();
    set({
      // Keep the original backup if a scenario is already active.
      scenarioBackup: scenarioId ? scenarioBackup : game ? { game, log } : null,
      scenarioId: id,
      game: sc.setup(),
      log: [],
      history: [],
      humanPlayer: 0,
      screen: 'game',
      aiLastSystems: [],
    });
  },

  exitScenario: (opts) => {
    const { scenarioBackup, scenarioId, scenarioDone } = get();
    set({
      scenarioId: null,
      scenarioBackup: null,
      scenarioDone:
        opts?.completed && scenarioId
          ? { ...scenarioDone, [scenarioId]: true }
          : scenarioDone,
      game: scenarioBackup?.game ?? null,
      log: scenarioBackup?.log ?? [],
      history: [],
      screen: 'academy',
    });
    void persist(get);
  },

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
      personaId: randomPersona(settings.difficulty).id,
      screen: 'game',
      aiLastSystems: [],
      scenarioId: null,
      scenarioBackup: null,
      campaignPersonaId: null,
    });
    void persist(get);
    void runAI(get, set);
  },

  abandonGame: () => {
    set({
      game: null,
      log: [],
      history: [],
      screen: 'menu',
      aiLastSystems: [],
      scenarioId: null,
      scenarioBackup: null,
      campaignPersonaId: null,
    });
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
        { player: game.current, turn: game.turn, text: moveToNotation(game, move), move },
      ],
      history: isTurnStart ? [...history, { game, log }] : history,
    });
    if (!get().scenarioId) {
      maybeRecordCampaign(get, set);
      void persist(get);
      void runAI(get, set);
    }
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
          settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
          game: data.game ?? null,
          log: data.log ?? [],
          history: data.history ?? [],
          humanPlayer: data.humanPlayer ?? 0,
          personaId: data.personaId ?? null,
          aiLastSystems: data.aiLastSystems ?? [],
          scenarioDone: data.scenarioDone ?? {},
          campaign: data.campaign ?? {},
          campaignPersonaId: data.campaignPersonaId ?? null,
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
