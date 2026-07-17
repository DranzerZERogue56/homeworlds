import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, Move, Piece, SIZES, getLegalMoves, pieceKey, samePiece } from '../engine';
import { useGameStore } from '../store/gameStore';
import { ActionSheet } from './ActionSheet';
import { BankPanel } from './BankPanel';
import { GalaxyMap } from './GalaxyMap';
import { Pyramid } from './Pyramid';
import { actionableShipKeys, derive, moveLosesGame, Selection } from './selectors';
import { Starfield } from './Starfield';
import { TurnGuide } from './TurnGuide';
import { colorNames, theme } from './theme';

type Sel = Selection | null;

export function GameScreen() {
  const game = useGameStore((s) => s.game);
  const humanPlayer = useGameStore((s) => s.humanPlayer);
  const aiThinking = useGameStore((s) => s.aiThinking);
  const history = useGameStore((s) => s.history);
  const log = useGameStore((s) => s.log);
  const aiLastSystems = useGameStore((s) => s.aiLastSystems);
  const settings = useGameStore((s) => s.settings);
  const playHuman = useGameStore((s) => s.playHuman);
  const undo = useGameStore((s) => s.undo);
  const abandonGame = useGameStore((s) => s.abandonGame);
  const newGame = useGameStore((s) => s.newGame);
  const setScreen = useGameStore((s) => s.setScreen);

  const [sel, setSel] = useState<Sel>(null);
  const [bankOpen, setBankOpen] = useState(false);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const insets = useSafeAreaInsets();

  // Android hardware back: close modal -> deselect -> back to menu (game persists).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (discoverOpen) {
        setDiscoverOpen(false);
        return true;
      }
      if (bankOpen) {
        setBankOpen(false);
        return true;
      }
      if (logOpen) {
        setLogOpen(false);
        return true;
      }
      if (sel) {
        setSel(null);
        return true;
      }
      setScreen('menu');
      return true;
    });
    return () => sub.remove();
  }, [discoverOpen, bankOpen, logOpen, sel, setScreen]);

  const humanTurn =
    !!game && game.phase !== 'finished' && game.current === humanPlayer && !aiThinking;
  const legal = useMemo(
    () => (game && humanTurn ? getLegalMoves(game) : []),
    [game, humanTurn]
  );
  const actionable = useMemo(
    () => (game && humanTurn ? actionableShipKeys(legal, game) : new Set<string>()),
    [game, humanTurn, legal]
  );

  if (!game) return null;

  // All tappable options derive from getLegalMoves via the tested selector.
  const d = derive(legal, sel);

  const play = (move: Move) => {
    // Guard rail: warn before a move that immediately loses the game
    // (abandoning or sacrificing the last ship at your homeworld).
    if (moveLosesGame(game, move, humanPlayer)) {
      Alert.alert(
        'This loses the game',
        'Your homeworld would be left without your ships and destroyed. Do it anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Do it',
            style: 'destructive',
            onPress: () => {
              setSel(null);
              setDiscoverOpen(false);
              playHuman(move);
            },
          },
        ]
      );
      return;
    }
    setSel(null);
    setDiscoverOpen(false);
    playHuman(move);
  };

  const sysName = (id: number) => game.systems.find((s) => s.id === id)?.name ?? '?';

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6, paddingBottom: insets.bottom }]}>
      <Starfield />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => setScreen('menu')} hitSlop={10}>
          <Text style={styles.headerBtn}>‹ Menu</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {game.phase === 'finished' ? 'Game over' : humanTurn ? 'Your turn' : ' '}
        </Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Pressable onPress={undo} disabled={history.length === 0 || aiThinking} hitSlop={10}>
            <Text
              style={[styles.headerBtn, (history.length === 0 || aiThinking) && styles.disabled]}
            >
              Undo
            </Text>
          </Pressable>
          <Pressable onPress={() => setBankOpen(true)} hitSlop={10}>
            <Text style={styles.headerBtn}>Bank</Text>
          </Pressable>
          <Pressable onPress={() => setLogOpen(true)} hitSlop={10}>
            <Text style={styles.headerBtn}>Log</Text>
          </Pressable>
        </View>
      </View>

      {aiThinking && <ActivityIndicator color={theme.accent} style={{ marginBottom: 2 }} />}

      {/* Always-on "what do I do now" strip */}
      <TurnGuide
        game={game}
        humanTurn={humanTurn}
        aiThinking={aiThinking}
        difficulty={settings.difficulty}
        hasSelection={sel !== null}
        catastropheMoves={humanTurn ? d.catastropheMoves : []}
        endMove={humanTurn ? d.endMove : undefined}
        sysName={sysName}
        onPlay={play}
      />

      {/* The galaxy */}
      <GalaxyMap
        systems={game.systems}
        humanPlayer={humanPlayer}
        selected={sel}
        moveTargets={d.moveTargets}
        attackTargets={d.attackTargets}
        actionable={actionable}
        recent={aiLastSystems}
        interactive={humanTurn}
        onPressOwnShip={(system, ship) =>
          setSel(
            sel && sel.system === system && samePiece(sel.ship, ship) ? null : { system, ship }
          )
        }
        onPressEnemyShip={(system, target) => {
          const m = d.attackMoves.find((x) => x.system === system && samePiece(x.target, target));
          if (m) play(m);
        }}
        onPressSystem={(to) => {
          const m = d.moveMoves.find((x) => x.to === to);
          if (m) play(m);
        }}
      />

      {/* Latest-move ticker */}
      {log.length > 0 && (
        <Text style={styles.ticker} numberOfLines={1}>
          Last: {log[log.length - 1].player === humanPlayer ? 'You' : 'AI'} ·{' '}
          {log[log.length - 1].text}
        </Text>
      )}

      {/* Selected-ship drawer */}
      {humanTurn && game.phase !== 'setup' && (
        <ActionSheet
          selection={sel}
          derived={d}
          sysName={sysName}
          sacrificing={game.phase === 'sacrifice'}
          onPlay={play}
          onDiscover={() => setDiscoverOpen(true)}
          onCancel={() => setSel(null)}
        />
      )}

      {/* Guided homeworld setup */}
      {humanTurn && game.phase === 'setup' && <SetupPanel legal={legal} onPlay={play} />}

      {/* Game over overlay */}
      {game.phase === 'finished' && (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayTitle}>
              {game.winner === 'draw'
                ? 'Draw'
                : game.winner === humanPlayer
                ? 'You win! 🎉'
                : 'You lose'}
            </Text>
            <ActionButton label="New game" onPress={newGame} />
            <ActionButton
              label="Back to menu"
              onPress={() => {
                abandonGame();
                setScreen('menu');
              }}
            />
          </View>
        </View>
      )}

      {/* Move log overlay */}
      {logOpen && (
        <Pressable style={styles.overlay} onPress={() => setLogOpen(false)}>
          <View style={[styles.overlayCard, { maxHeight: '70%' }]}>
            <Text style={styles.overlayTitle}>Move log</Text>
            <ScrollView>
              {log.length === 0 && <Text style={styles.logEntry}>No moves yet.</Text>}
              {log
                .slice()
                .reverse()
                .map((e, i) => (
                  <Text key={i} style={styles.logEntry}>
                    {e.player === humanPlayer ? 'You' : 'AI'} · {e.text}
                  </Text>
                ))}
            </ScrollView>
            <ActionButton label="Close" onPress={() => setLogOpen(false)} />
          </View>
        </Pressable>
      )}

      {/* Bank (view-only) and discover picker */}
      <BankPanel bank={game.bank} visible={bankOpen} onClose={() => setBankOpen(false)} />
      <BankPanel
        bank={game.bank}
        visible={discoverOpen}
        onClose={() => setDiscoverOpen(false)}
        title="Discover: choose the new star"
        pickable={new Set(d.discoverMoves.map((m) => pieceKey(m.star)))}
        onPick={(star) => {
          const m = d.discoverMoves.find((x) => samePiece(x.star, star));
          if (m) play(m);
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------

function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

/** Three-step homeworld chooser: star, star, first ship. */
function SetupPanel({ legal, onPlay }: { legal: Move[]; onPlay: (m: Move) => void }) {
  const game = useGameStore((s) => s.game)!;
  const [picks, setPicks] = useState<Piece[]>([]);

  const remaining = (piece: Piece) =>
    (game.bank[pieceKey(piece)] ?? 0) - picks.filter((p) => samePiece(p, piece)).length;

  const slotLabels = ['Star 1', 'Star 2', 'First ship'];
  const done = picks.length === 3;

  const confirm = () => {
    const [a, b, ship] = picks;
    const move = legal.find(
      (m) =>
        m.type === 'setup' &&
        samePiece(m.ship, ship) &&
        ((samePiece(m.star1, a) && samePiece(m.star2, b)) ||
          (samePiece(m.star1, b) && samePiece(m.star2, a)))
    );
    if (move) {
      setPicks([]);
      onPlay(move);
    }
  };

  return (
    <View style={styles.setupPanel}>
      <View style={styles.setupHeader}>
        <Text style={styles.setupTitle}>
          {done ? 'Confirm your homeworld' : `Pick: ${slotLabels[picks.length]}`}
        </Text>
        {picks.length > 0 && (
          <Pressable onPress={() => setPicks([])} hitSlop={8}>
            <Text style={styles.headerBtn}>Reset</Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.chipRow, { minHeight: 44, alignItems: 'flex-end' }]}>
        {picks.map((p, i) => (
          <View key={i} style={{ alignItems: 'center' }}>
            <Pyramid piece={p} kind={i < 2 ? 'star' : 'shipUp'} />
            <Text style={styles.hint}>{slotLabels[i]}</Text>
          </View>
        ))}
      </View>

      {!done && (
        <View>
          {COLORS.map((c) => (
            <View key={c} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.hint, { width: 52 }]}>{colorNames[c]}</Text>
              {SIZES.map((s) => {
                const piece = { color: c, size: s };
                const left = remaining(piece);
                return (
                  <View key={s} style={{ alignItems: 'center', width: 56 }}>
                    <Pyramid
                      piece={piece}
                      kind="shipUp"
                      disabled={left <= 0}
                      onPress={left > 0 ? () => setPicks([...picks, piece]) : undefined}
                    />
                    <Text style={styles.hint}>×{left}</Text>
                  </View>
                );
              })}
            </View>
          ))}
          <Text style={styles.hint}>
            Tip: two different star sizes reach more of the galaxy; a green ship lets you build.
          </Text>
        </View>
      )}

      {done && <ActionButton label="Found homeworld" onPress={confirm} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  headerBtn: { color: theme.accent, fontSize: 14, fontWeight: '600' },
  headerTitle: { color: theme.text, fontSize: 14, fontWeight: '700' },
  disabled: { color: theme.textDim, opacity: 0.5 },
  ticker: {
    color: theme.textDim,
    fontSize: 12,
    paddingHorizontal: 14,
    paddingVertical: 3,
    textAlign: 'center',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.panel,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 3,
  },
  btnText: { color: theme.text, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  hint: { color: theme.textDim, fontSize: 11, marginTop: 4 },
  setupPanel: {
    backgroundColor: theme.panelSolid,
    borderTopWidth: 1,
    borderColor: theme.border,
    padding: 12,
  },
  setupHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  setupTitle: { color: theme.text, fontWeight: '700', fontSize: 14 },
  logEntry: { color: theme.textDim, fontSize: 12, paddingVertical: 2 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCard: {
    backgroundColor: theme.panelSolid,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 24,
    width: '80%',
    gap: 8,
    alignItems: 'stretch',
  },
  overlayTitle: {
    color: theme.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
});
