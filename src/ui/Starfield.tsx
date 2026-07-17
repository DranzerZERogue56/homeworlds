import React, { useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';

/** Deterministic LCG so the sky doesn't reshuffle on every render. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const STAR_TINTS = ['#ffffff', '#cfe1ff', '#ffe9c9', '#dcd2ff'];

const NEBULAS = [
  { tint: '#3b2a68', size: 340, alpha: 0.16 },
  { tint: '#173f57', size: 300, alpha: 0.14 },
  { tint: '#4a1f3f', size: 260, alpha: 0.1 },
];

/** Static procedural starfield + nebula blobs. Pure Views, zero assets. */
export const Starfield = React.memo(function Starfield({ seed = 7 }: { seed?: number }) {
  const { width, height } = useWindowDimensions();

  const layers = useMemo(() => {
    const rand = rng(seed);
    const stars = Array.from({ length: 110 }, () => ({
      x: rand() * width,
      y: rand() * height,
      r: rand() < 0.82 ? 1 : 2,
      opacity: 0.25 + rand() * 0.55,
      tint: STAR_TINTS[Math.floor(rand() * STAR_TINTS.length)],
    }));
    const nebulas = NEBULAS.map((n) => ({
      ...n,
      x: rand() * width - n.size / 3,
      y: rand() * height - n.size / 3,
    }));
    return { stars, nebulas };
  }, [seed, width, height]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {layers.nebulas.map((n, i) => (
        <View
          key={`n${i}`}
          style={{
            position: 'absolute',
            left: n.x,
            top: n.y,
            width: n.size,
            height: n.size,
            borderRadius: n.size / 2,
            backgroundColor: n.tint,
            opacity: n.alpha,
          }}
        />
      ))}
      {layers.stars.map((s, i) => (
        <View
          key={`s${i}`}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: s.r * 2,
            height: s.r * 2,
            borderRadius: s.r,
            backgroundColor: s.tint,
            opacity: s.opacity,
          }}
        />
      ))}
    </View>
  );
});
