import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bank, COLORS, Piece, SIZES } from '../engine';
import { Pyramid } from './Pyramid';
import { colorNames, pieceColors, theme } from './theme';

const SIZE_LABELS = { 1: 'small', 2: 'medium', 3: 'large' } as const;

interface Props {
  /** Remaining count per piece key ("g2"); zero renders dimmed. */
  counts: Bank;
  /** Pieces that may be tapped right now (keys). Omit for view-only. */
  pickable?: Set<string>;
  onPick?: (piece: Piece) => void;
  /** Pyramid scale inside cells (default 0.7). */
  scale?: number;
}

/**
 * The four nebula-tinted color columns of the stellar reserve: pieces in
 * star form, stock as supply pips (● ● ○). Shared by the bank panel and the
 * homeworld setup chooser.
 */
export function ReserveGrid({ counts, pickable, onPick, scale = 0.7 }: Props) {
  return (
    <View style={styles.columns}>
      {COLORS.map((c) => (
        <View key={c} style={[styles.column, { borderColor: pieceColors[c] + '55' }]}>
          <Text style={[styles.colorLabel, { color: pieceColors[c] }]}>{colorNames[c]}</Text>
          {SIZES.map((s) => {
            const count = counts[`${c}${s}`] ?? 0;
            const piece: Piece = { color: c, size: s };
            const canPick = !!pickable?.has(`${c}${s}`) && count > 0;
            return (
              <View key={s} style={[styles.cell, count === 0 && { opacity: 0.25 }]}>
                <Pyramid
                  piece={piece}
                  kind="star"
                  scale={scale}
                  highlighted={canPick}
                  onPress={canPick && onPick ? () => onPick(piece) : undefined}
                  disabled={!canPick}
                />
                <View style={styles.pipRow}>
                  {[0, 1, 2].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.pip,
                        {
                          backgroundColor: i < count ? pieceColors[c] : 'transparent',
                          borderColor: pieceColors[c],
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.sizeLabel}>{SIZE_LABELS[s]}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', gap: 8 },
  column: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 8,
    backgroundColor: theme.panel,
  },
  colorLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  cell: { alignItems: 'center', marginTop: 6 },
  pipRow: { flexDirection: 'row', gap: 3, marginTop: 2 },
  pip: { width: 6, height: 6, borderRadius: 3, borderWidth: 1 },
  sizeLabel: { color: theme.textDim, fontSize: 9, marginTop: 2 },
});
