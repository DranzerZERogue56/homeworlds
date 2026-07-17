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

  // Stars: the core diamond grows steeply with size AND gains one orbit ring
  // per size step (1 = bare, 2 = one ring, 3 = two rings) so sizes are
  // unmistakable even at map scale.
  const starCore = Math.round(w * { 1: 0.55, 2: 0.75, 3: 0.95 }[piece.size]);
  const starBox = Math.round(w * 1.7);
  const ring = (d: number, opacity: number, key: string) => (
    <View
      key={key}
      style={{
        position: 'absolute',
        width: d,
        height: d,
        borderRadius: d / 2,
        borderWidth: 1.5,
        borderColor: color,
        opacity,
      }}
    />
  );

  const body =
    kind === 'star' ? (
      <View style={{ width: starBox, height: starBox, alignItems: 'center', justifyContent: 'center' }}>
        {/* glow halo scales with size */}
        <View
          style={{
            position: 'absolute',
            width: starCore * 2,
            height: starCore * 2,
            borderRadius: starCore,
            backgroundColor: color,
            opacity: 0.18 + piece.size * 0.04,
          }}
        />
        {piece.size >= 2 && ring(Math.round(starCore * 1.7), 0.75, 'r1')}
        {piece.size >= 3 && ring(Math.round(starCore * 2.3), 0.45, 'r2')}
        <View
          style={{
            width: starCore,
            height: starCore,
            backgroundColor: color,
            transform: [{ rotate: '45deg' }],
            borderRadius: 3,
          }}
        />
      </View>
    ) : (
      // Ships: colored hull triangle with a shaded inner keel and an engine
      // glow at the base (below for own ships, above for enemy ships).
      <View style={{ alignItems: 'center' }}>
        {kind === 'shipDown' && (
          <View
            style={{
              width: w * 0.55,
              height: 3,
              borderRadius: 2,
              backgroundColor: color,
              opacity: 0.9,
              marginBottom: 1,
            }}
          />
        )}
        <View style={{ width: w, height: h, alignItems: 'center' }}>
          {/* faint halo behind the hull */}
          <View
            style={{
              position: 'absolute',
              top: h * 0.15,
              width: w * 1.1,
              height: h * 0.9,
              borderRadius: w * 0.55,
              backgroundColor: color,
              opacity: 0.14,
            }}
          />
          <View style={{ position: 'absolute', width: 0, height: 0, ...triangle }} />
          {/* shaded keel: smaller dark triangle anchored to the base */}
          <View
            style={{
              position: 'absolute',
              [kind === 'shipDown' ? 'top' : 'bottom']: 0,
              width: 0,
              height: 0,
              borderLeftWidth: w * 0.28,
              borderRightWidth: w * 0.28,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              ...(kind === 'shipDown'
                ? { borderTopWidth: h * 0.45, borderTopColor: '#0b102080' }
                : { borderBottomWidth: h * 0.45, borderBottomColor: '#0b102080' }),
            }}
          />
        </View>
        {kind === 'shipUp' && (
          <View
            style={{
              width: w * 0.55,
              height: 3,
              borderRadius: 2,
              backgroundColor: color,
              opacity: 0.9,
              marginTop: 1,
            }}
          />
        )}
      </View>
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
