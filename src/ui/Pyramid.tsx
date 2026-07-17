import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
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
  /** Shrink/grow the pyramid (map nodes use ~0.7). */
  scale?: number;
}

const BASE = { 1: 20, 2: 28, 3: 36 } as const;

/** A Looney pyramid as a plain-View triangle (no image assets). */
export function Pyramid({ piece, kind, selected, highlighted, onPress, disabled, scale = 1 }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (selected || highlighted) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.55, duration: 550, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => {
        loop.stop();
        pulse.setValue(1);
      };
    }
    pulse.setValue(1);
    return undefined;
  }, [selected, highlighted, pulse]);

  const w = Math.round(BASE[piece.size] * scale);
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
        pressed && { opacity: 0.6 },
      ]}
      hitSlop={10}
    >
      {(selected || highlighted) && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            { opacity: pulse, borderColor: selected ? theme.accent : theme.highlight },
          ]}
        />
      )}
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    padding: 5,
    margin: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  selected: { backgroundColor: '#26304a' },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 6,
    borderWidth: 2,
  },
});
