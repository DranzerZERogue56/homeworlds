import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Move } from '../engine';
import { Pyramid } from './Pyramid';
import { useGameStore } from '../store/gameStore';
import { Derived, Selection } from './selectors';
import { colorNames, pieceColors, theme } from './theme';

interface Props {
  selection: Selection | null;
  derived: Derived;
  sysName: (id: number) => string;
  sacrificing: boolean;
  onPlay: (m: Move) => void;
  onDiscover: () => void;
  onCancel: () => void;
}

/**
 * Bottom drawer for the selected ship. Slides up on selection; lists every
 * tappable action, and spells out move/attack gestures instead of hiding them.
 */
export function ActionSheet({
  selection,
  derived,
  sysName,
  sacrificing,
  onPlay,
  onDiscover,
  onCancel,
}: Props) {
  const slide = useRef(new Animated.Value(0)).current;
  const open = selection !== null;
  const animations = useGameStore((s) => s.settings.animations);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: open ? 1 : 0,
      duration: animations ? 180 : 0,
      useNativeDriver: true,
    }).start();
  }, [open, animations, slide]);

  if (!selection) return null;
  const { buildMoves, tradeMoves, discoverMoves, sacrificeMove, moveTargets, attackTargets } =
    derived;

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          transform: [
            { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [220, 0] }) },
          ],
        },
      ]}
    >
      <View style={styles.grabber} />
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Pyramid piece={selection.ship} kind="shipUp" scale={0.7} />
          <Text style={styles.title}>
            {colorNames[selection.ship.color]} {selection.ship.size} at {sysName(selection.system)}
          </Text>
        </View>
        <Pressable onPress={onCancel} hitSlop={10}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        {buildMoves.map((m, i) => (
          <Chip
            key={`b${i}`}
            label={`Build ${colorNames[m.color].toLowerCase()}`}
            color={pieceColors[m.color]}
            onPress={() => onPlay(m)}
          />
        ))}
        {tradeMoves.map((m, i) => (
          <Chip
            key={`t${i}`}
            label={`Trade → ${colorNames[m.toColor].toLowerCase()}`}
            color={pieceColors[m.toColor]}
            onPress={() => onPlay(m)}
          />
        ))}
        {discoverMoves.length > 0 && <Chip label="Discover…" onPress={onDiscover} />}
        {sacrificeMove && !sacrificing && (
          <Chip
            danger
            label={`⚡ Sacrifice for ${selection.ship.size} ${colorNames[selection.ship.color].toLowerCase()} action${selection.ship.size === 1 ? '' : 's'}`}
            onPress={() => onPlay(sacrificeMove)}
          />
        )}
      </View>

      {moveTargets.size > 0 && (
        <Text style={styles.hint}>◉ Tap a highlighted system on the map to move there.</Text>
      )}
      {attackTargets.size > 0 && (
        <Text style={styles.hint}>▼ Tap a glowing enemy ship here to capture it.</Text>
      )}
      {derived.selectionIsDead && (
        <Text style={[styles.hint, { color: theme.danger }]}>
          This ship has no legal action right now — try another ship.
        </Text>
      )}
    </Animated.View>
  );
}

function Chip({
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
        styles.chip,
        color ? { borderColor: color } : null,
        danger ? { borderColor: theme.danger } : null,
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.chipText, danger && { color: theme.danger }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: theme.panelSolid,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 14,
    paddingBottom: 10,
    paddingTop: 6,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
    marginBottom: 6,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: theme.text, fontWeight: '700', fontSize: 14, fontFamily: theme.mono },
  cancel: { color: theme.accent, fontSize: 14, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.panel,
    borderRadius: theme.radius,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  chipText: { color: theme.text, fontSize: 13, fontWeight: '600' },
  hint: { color: theme.textDim, fontSize: 12, marginTop: 8 },
});
