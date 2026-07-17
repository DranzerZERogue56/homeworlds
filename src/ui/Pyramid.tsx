import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { Piece } from '../engine';
import { pieceColors, theme } from './theme';

interface Props {
  piece: Piece;
  /** Ships point up (mine) or down (opponent); stars render as diamonds. */
  kind: 'shipUp' | 'shipDown' | 'star';
  selected?: boolean;
  highlighted?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

const BASE = { 1: 20, 2: 28, 3: 36 } as const;

/** A Looney pyramid as a plain-View triangle (no image assets). */
export function Pyramid({ piece, kind, selected, highlighted, onPress, disabled }: Props) {
  const w = BASE[piece.size];
  const h = Math.round(w * 1.05);
  const color = pieceColors[piece.color];

  const triangle: ViewStyle =
    kind === 'shipDown'
      ? {
          borderLeftWidth: w / 2,
          borderRightWidth: w / 2,
          borderTopWidth: h,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: color,
        }
      : {
          borderLeftWidth: w / 2,
          borderRightWidth: w / 2,
          borderBottomWidth: h,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
        };

  const body =
    kind === 'star' ? (
      <View style={{ width: w * 1.5, height: w * 1.5, alignItems: 'center', justifyContent: 'center' }}>
        {/* glow halo */}
        <View
          style={{
            position: 'absolute',
            width: w * 1.5,
            height: w * 1.5,
            borderRadius: (w * 1.5) / 2,
            backgroundColor: color,
            opacity: 0.22,
          }}
        />
        <View
          style={{
            position: 'absolute',
            width: w * 1.05,
            height: w * 1.05,
            borderRadius: (w * 1.05) / 2,
            backgroundColor: color,
            opacity: 0.28,
          }}
        />
        <View
          style={{
            width: w * 0.72,
            height: w * 0.72,
            backgroundColor: color,
            transform: [{ rotate: '45deg' }],
            borderRadius: 3,
          }}
        />
      </View>
    ) : (
      <View style={{ width: 0, height: 0, ...triangle }} />
    );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        styles.wrap,
        selected && styles.selected,
        highlighted && styles.highlighted,
        pressed && { opacity: 0.6 },
      ]}
      hitSlop={10}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 5,
    margin: 1,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  selected: { borderColor: theme.accent, backgroundColor: '#26304a' },
  highlighted: { borderColor: theme.highlight },
});
