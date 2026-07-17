import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PlayerId } from '../engine';
import { theme } from './theme';

interface Props {
  /** Normalized advantage from player 0's perspective (-1..+1). */
  value: number;
  /** Which side the viewing human plays; the bar fills toward them when ahead. */
  humanPlayer: PlayerId;
}

/** Thin chess-style advantage bar: cyan = you, red = the opponent. */
export function EvalBar({ value, humanPlayer }: Props) {
  const mine = humanPlayer === 0 ? value : -value; // + = human ahead
  const pct = (mine + 1) / 2; // 0..1 share of the bar
  const label =
    Math.abs(mine) < 0.08 ? 'EVEN' : `${mine > 0 ? 'YOU' : 'FOE'} +${Math.abs(mine).toFixed(2)}`;

  return (
    <View style={styles.row}>
      <View style={styles.track}>
        <View style={[styles.fill, { flex: pct }]} />
        <View style={[styles.foe, { flex: 1 - pct }]} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 4 },
  track: {
    flex: 1,
    height: 6,
    flexDirection: 'row',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  },
  fill: { backgroundColor: theme.accent },
  foe: { backgroundColor: theme.danger, opacity: 0.75 },
  label: {
    color: theme.textDim,
    fontFamily: theme.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    minWidth: 64,
    textAlign: 'right',
  },
});
