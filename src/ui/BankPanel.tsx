import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bank, COLORS, Piece, SIZES } from '../engine';
import { Pyramid } from './Pyramid';
import { Starfield } from './Starfield';
import { colorNames, pieceColors, theme } from './theme';

interface Props {
  bank: Bank;
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** When set, pieces matching one of these keys are pickable. */
  pickable?: Set<string>;
  onPick?: (piece: Piece) => void;
}

const SIZE_LABELS = { 1: 'small', 2: 'medium', 3: 'large' } as const;

/**
 * The bank as a "stellar reserve": four colored nebula columns over a
 * starfield, pieces rendered in star form (core + size rings), remaining
 * stock shown as supply pips (● ● ○).
 */
export function BankPanel({ bank, visible, onClose, title, pickable, onPick }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 18 }]}>
          <View style={StyleSheet.absoluteFill}>
            <Starfield seed={11} />
          </View>
          <View style={styles.grabber} />
          <Text style={styles.title}>{title ?? 'Stellar reserve'}</Text>
          <Text style={styles.subtitle}>
            {pickable ? 'Tap a glowing star to place it.' : 'Unclaimed material — 36 pieces minus everything in play.'}
          </Text>

          <View style={styles.columns}>
            {COLORS.map((c) => (
              <View key={c} style={[styles.column, { borderColor: pieceColors[c] + '55' }]}>
                <Text style={[styles.colorLabel, { color: pieceColors[c] }]}>
                  {colorNames[c]}
                </Text>
                {SIZES.map((s) => {
                  const count = bank[`${c}${s}`] ?? 0;
                  const piece: Piece = { color: c, size: s };
                  const canPick = !!pickable?.has(`${c}${s}`) && count > 0;
                  return (
                    <View key={s} style={[styles.cell, count === 0 && { opacity: 0.25 }]}>
                      <Pyramid
                        piece={piece}
                        kind="star"
                        scale={0.7}
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

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
    marginBottom: 8,
  },
  title: { color: theme.text, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  subtitle: {
    color: theme.textDim,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 12,
  },
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
  closeBtn: {
    marginTop: 14,
    backgroundColor: theme.panelHi,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  closeText: { color: theme.text, fontWeight: '600' },
});
