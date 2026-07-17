import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  COLORS,
  Color,
  Move,
  Piece,
  SIZES,
  getLegalMoves,
  pieceKey,
  samePiece,
} from '../engine';
import { useGameStore } from '../store/gameStore';
import { BankPanel } from './BankPanel';
import { Pyramid } from './Pyramid';
import { SystemView } from './SystemView';
import { colorNames, pieceColors, theme } from './theme';

type Sel = { system: number; ship: Piece } | null;

export function GameScreen() {
  const game = useGameStore((s) => s.game);
  const humanPlayer = useGameStore((s) => s.humanPlayer);
  const aiThinking = useGameStore((s) => s.aiThinking);
  const history = useGameStore((s) => s.history);
  const log = useGameStore((s) => s.log);
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
      if (sel) {
        setSel(null);
        return true;
      }
      setScreen('menu');
      return true;
    });
    return () => sub.remove();
  }, [discoverOpen, bankOpen, sel, setScreen]);

  const humanTurn = !!game && game.phase !== 'finished' && game.current === humanPlayer && !aiThinking;
  const legal = useMemo(
    () => (game && humanTurn ? getLegalMoves(game) : []),
    [game, humanTurn]
  );

  if (!game) return null;

  const play = (move: Move) => {
    setSel(null);
    setDiscoverOpen(false);
    playHuman(move);
  };

  // ----- selection-derived legal options ------------------------------------
  const selMoves = sel
    ? legal.filter((m) => 'system' in m && m.system === sel.system)
    : [];
  const moveTargets = new Set<number>(
    selMoves
      .filter((m): m is Extract<Move, { type: 'move' }> => m.type === 'move' && samePiece(m.ship, sel!.ship))
      .map((m) => m.to)
  );
  const attackMoves = selMoves.filter(
    (m): m is Extract<Move, { type: 'attack' }> => m.type === 'attack'
  );
  const attackTargets = new Set(attackMoves.map((m) => pieceKey(m.target)));
  const buildMoves = selMoves.filter(
    (m): m is Extract<Move, { type: 'build' }> => m.type === 'build'
  );
  const tradeMoves = selMoves.filter(
    (m): m is Extract<Move, { type: 'trade' }> => m.type === 'trade' && samePiece(m.ship, sel!.ship)
  );
  const discoverMoves = selMoves.filter(
    (m): m is Extract<Move, { type: 'discover' }> =>
      m.type === 'discover' && samePiece(m.ship, sel!.ship)
  );
  const sacrificeMove = selMoves.find(
    (m): m is Extract<Move, { type: 'sacrifice' }> =>
      m.type === 'sacrifice' && samePiece(m.ship, sel!.ship)
  );
  const catastropheMoves = legal.filter(
    (m): m is Extract<Move, { type: 'catastrophe' }> => m.type === 'catastrophe'
  );
  const endMove = legal.find((m) => m.type === 'end');

  // ----- board ordering: enemy home, colonies, own home ----------------------
  const enemy = humanPlayer === 0 ? 1 : 0;
  const enemyHome = game.systems.filter((s) => s.home === enemy);
  const colonies = game.systems.filter((s) => s.home === undefined);
  const myHome = game.systems.filter((s) => s.home === humanPlayer);
  const ordered = [...enemyHome, ...colonies, ...myHome];

  const sysName = (id: number) => game.systems.find((s) => s.id === id)?.name ?? '?';

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => setScreen('menu')} hitSlop={10}>
          <Text style={styles.headerBtn}>‹ Menu</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {game.phase === 'finished'
            ? 'Game over'
            : aiThinking
            ? 'Opponent is thinking…'
            : humanTurn
            ? game.phase === 'setup'
              ? 'Found your homeworld'
              : 'Your turn'
            : 'Opponent’s turn'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <Pressable onPress={undo} disabled={history.length === 0 || aiThinking} hitSlop={10}>
            <Text style={[styles.headerBtn, (history.length === 0 || aiThinking) && styles.disabled]}>
              Undo
            </Text>
          </Pressable>
          <Pressable onPress={() => setBankOpen(true)} hitSlop={10}>
            <Text style={styles.headerBtn}>Bank</Text>
          </Pressable>
        </View>
      </View>

      {aiThinking && <ActivityIndicator color={theme.accent} style={{ marginTop: 4 }} />}

      {/* Board */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 6 }}>
        {ordered.map((sys) => (
          <SystemView
            key={sys.id}
            system={sys}
            humanPlayer={humanPlayer}
            selectedShip={sel}
            moveTargets={moveTargets}
            attackTargets={attackTargets}
            interactive={humanTurn}
            onPressOwnShip={(system, ship) =>
              setSel(sel && sel.system === system && samePiece(sel.ship, ship) ? null : { system, ship })
            }
            onPressEnemyShip={(system, target) => {
              const m = attackMoves.find(
                (x) => x.system === system && samePiece(x.target, target)
              );
              if (m) play(m);
            }}
            onPressSystem={(to) => {
              const m = legal.find(
                (x) =>
                  x.type === 'move' &&
                  sel &&
                  x.system === sel.system &&
                  samePiece(x.ship, sel.ship) &&
                  x.to === to
              );
              if (m) play(m);
            }}
          />
        ))}

        {/* Move log */}
        <Pressable style={styles.logHeader} onPress={() => setLogOpen(!logOpen)}>
          <Text style={styles.logTitle}>
            Move log ({log.length}) {logOpen ? '▾' : '▸'}
          </Text>
        </Pressable>
        {logOpen &&
          log
            .slice()
            .reverse()
            .map((e, i) => (
              <Text key={i} style={styles.logEntry}>
                {e.player === humanPlayer ? 'You' : 'AI'} · {e.text}
              </Text>
            ))}
      </ScrollView>

      {/* Status banners */}
      {humanTurn && game.phase === 'sacrifice' && game.sacrifice && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Sacrifice: {game.sacrifice.actionsLeft} {colorNames[game.sacrifice.color].toLowerCase()}{' '}
            action{game.sacrifice.actionsLeft === 1 ? '' : 's'} left
          </Text>
          {endMove && (
            <ActionButton label="End turn" onPress={() => play(endMove)} />
          )}
        </View>
      )}
      {humanTurn && game.phase === 'post' && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Action complete.</Text>
          {endMove && <ActionButton label="End turn" onPress={() => play(endMove)} />}
        </View>
      )}
      {humanTurn && game.phase === 'main' && endMove && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>No actions available.</Text>
          <ActionButton label="Pass" onPress={() => play(endMove)} />
        </View>
      )}
      {humanTurn && catastropheMoves.length > 0 && (
        <View style={[styles.banner, { borderColor: theme.danger }]}>
          <Text style={[styles.bannerText, { color: theme.danger }]}>Catastrophe available!</Text>
          <View style={styles.chipRow}>
            {catastropheMoves.map((m, i) => (
              <ActionButton
                key={i}
                danger
                label={`${colorNames[m.color]} at ${sysName(m.system)}`}
                onPress={() => play(m)}
              />
            ))}
          </View>
        </View>
      )}

      {/* Selected-ship action panel */}
      {humanTurn && sel && game.phase !== 'setup' && (
        <View style={styles.actionPanel}>
          <View style={styles.actionHeader}>
            <Text style={styles.actionTitle}>
              {colorNames[sel.ship.color]} {sel.ship.size} at {sysName(sel.system)}
            </Text>
            <Pressable onPress={() => setSel(null)} hitSlop={8}>
              <Text style={styles.headerBtn}>Cancel</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            {buildMoves.map((m, i) => (
              <ActionButton
                key={`b${i}`}
                label={`Build ${colorNames[m.color].toLowerCase()}`}
                color={pieceColors[m.color]}
                onPress={() => play(m)}
              />
            ))}
            {tradeMoves.map((m, i) => (
              <ActionButton
                key={`t${i}`}
                label={`Trade → ${colorNames[m.toColor].toLowerCase()}`}
                color={pieceColors[m.toColor]}
                onPress={() => play(m)}
              />
            ))}
            {discoverMoves.length > 0 && (
              <ActionButton label="Discover…" onPress={() => setDiscoverOpen(true)} />
            )}
            {sacrificeMove && (
              <ActionButton
                danger
                label={`Sacrifice (${sel.ship.size} ${colorNames[sel.ship.color].toLowerCase()})`}
                onPress={() => play(sacrificeMove)}
              />
            )}
          </View>
          {moveTargets.size > 0 && (
            <Text style={styles.hint}>Tap a highlighted system to move there.</Text>
          )}
          {attackTargets.size > 0 && (
            <Text style={styles.hint}>Tap a highlighted enemy ship to capture it.</Text>
          )}
        </View>
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
            <ActionButton label="Back to menu" onPress={() => { abandonGame(); setScreen('menu'); }} />
          </View>
        </View>
      )}

      {/* Bank (view-only) and discover picker */}
      <BankPanel bank={game.bank} visible={bankOpen} onClose={() => setBankOpen(false)} />
      <BankPanel
        bank={game.bank}
        visible={discoverOpen}
        onClose={() => setDiscoverOpen(false)}
        title="Discover: choose the new star"
        pickable={new Set(discoverMoves.map((m) => pieceKey(m.star)))}
        onPick={(star) => {
          const m = discoverMoves.find((x) => samePiece(x.star, star));
          if (m) play(m);
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------

function ActionButton({
  label,
  onPress,
  color,
  danger,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        color ? { borderColor: color } : null,
        danger ? { borderColor: theme.danger } : null,
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.btnText, danger && { color: theme.danger }]}>{label}</Text>
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
    <View style={styles.actionPanel}>
      <View style={styles.actionHeader}>
        <Text style={styles.actionTitle}>
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
    paddingBottom: 8,
  },
  headerBtn: { color: theme.accent, fontSize: 14, fontWeight: '600' },
  headerTitle: { color: theme.text, fontSize: 14, fontWeight: '700' },
  disabled: { color: theme.textDim, opacity: 0.5 },
  banner: {
    marginHorizontal: 10,
    marginBottom: 6,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.accent,
    backgroundColor: theme.panelHi,
  },
  bannerText: { color: theme.text, fontWeight: '600', marginBottom: 6 },
  actionPanel: {
    backgroundColor: theme.panelHi,
    borderTopWidth: 1,
    borderColor: theme.border,
    padding: 12,
  },
  actionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  actionTitle: { color: theme.text, fontWeight: '700', fontSize: 14 },
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
  btnText: { color: theme.text, fontSize: 13, fontWeight: '600' },
  hint: { color: theme.textDim, fontSize: 11, marginTop: 4 },
  logHeader: { paddingHorizontal: 14, paddingVertical: 8 },
  logTitle: { color: theme.textDim, fontWeight: '700', fontSize: 13 },
  logEntry: { color: theme.textDim, fontSize: 12, paddingHorizontal: 18, paddingVertical: 1 },
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
    backgroundColor: theme.panel,
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
