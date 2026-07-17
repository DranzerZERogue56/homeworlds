import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { advantage } from '../ai/ai';
import { GameState, applyMove, initialState } from '../engine';
import { useGameStore } from '../store/gameStore';
import { EvalBar } from './EvalBar';
import { GalaxyMap } from './GalaxyMap';
import { Starfield } from './Starfield';
import { theme } from './theme';

const noop = () => {};

/**
 * Step through the finished game move by move on the galaxy map, with the
 * advantage graph across the whole game. Built by re-applying the structured
 * move log from the initial state.
 */
export function ReplayScreen() {
  const log = useGameStore((s) => s.log);
  const humanPlayer = useGameStore((s) => s.humanPlayer);
  const setScreen = useGameStore((s) => s.setScreen);
  const insets = useSafeAreaInsets();

  // Fold the move list into a state timeline. Entries without structured
  // moves (pre-1.5 saves) truncate the replay at that point.
  const timeline = useMemo(() => {
    const states: GameState[] = [initialState()];
    for (const entry of log) {
      if (!entry.move) break;
      try {
        states.push(applyMove(states[states.length - 1], entry.move));
      } catch {
        break;
      }
    }
    return states;
  }, [log]);

  const [step, setStep] = useState(timeline.length - 1);
  const state = timeline[Math.min(step, timeline.length - 1)];
  const entry = step > 0 ? log[step - 1] : null;
  const evals = useMemo(() => timeline.map((s) => advantage(s)), [timeline]);

  const jump = (to: number) => setStep(Math.max(0, Math.min(timeline.length - 1, to)));

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6, paddingBottom: insets.bottom }]}>
      <Starfield seed={9} />
      <View style={styles.header}>
        <Pressable onPress={() => setScreen('menu')} hitSlop={10}>
          <Text style={styles.headerBtn}>‹ Menu</Text>
        </Pressable>
        <Text style={styles.title}>REPLAY {String(step).padStart(3, '0')}/{String(timeline.length - 1).padStart(3, '0')}</Text>
        <View style={{ width: 52 }} />
      </View>

      <EvalBar value={evals[Math.min(step, evals.length - 1)]} humanPlayer={humanPlayer} />

      {/* Advantage graph: one sliver per position, tap to scrub */}
      <View style={styles.graph}>
        {evals.map((v, i) => {
          const mine = humanPlayer === 0 ? v : -v;
          return (
            <Pressable key={i} style={styles.graphCol} onPress={() => jump(i)}>
              <View
                style={[
                  styles.graphBar,
                  {
                    height: 3 + Math.abs(mine) * 15,
                    backgroundColor: mine >= 0 ? theme.accent : theme.danger,
                    opacity: i === step ? 1 : 0.45,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.moveText} numberOfLines={2}>
        {entry
          ? `${entry.player === humanPlayer ? 'You' : 'AI'} · ${entry.explain ?? entry.text}`
          : 'Initial position'}
      </Text>

      <GalaxyMap
        systems={state.systems}
        humanPlayer={humanPlayer}
        selected={null}
        moveTargets={new Set()}
        attackTargets={new Set()}
        actionable={new Set()}
        recent={[]}
        interactive={false}
        onPressOwnShip={noop}
        onPressEnemyShip={noop}
        onPressSystem={noop}
      />

      <View style={styles.controls}>
        <Ctl label="⏮" onPress={() => jump(0)} />
        <Ctl label="◀" onPress={() => jump(step - 1)} />
        <Ctl label="▶" onPress={() => jump(step + 1)} />
        <Ctl label="⏭" onPress={() => jump(timeline.length - 1)} />
      </View>
    </View>
  );
}

function Ctl({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.ctl, pressed && { opacity: 0.5 }]}>
      <Text style={styles.ctlText}>{label}</Text>
    </Pressable>
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
  title: {
    color: theme.accent,
    fontFamily: theme.mono,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  graph: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 24,
    marginHorizontal: 14,
    marginBottom: 4,
  },
  graphCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 24 },
  graphBar: { width: '70%', borderRadius: 1 },
  moveText: {
    color: theme.text,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
    minHeight: 32,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  ctl: {
    borderWidth: 1,
    borderColor: theme.accent,
    borderRadius: theme.radius,
    backgroundColor: theme.panelSolid,
    paddingVertical: 8,
    width: 64,
    alignItems: 'center',
  },
  ctlText: { color: theme.accent, fontSize: 16, fontWeight: '800' },
});
