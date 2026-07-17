import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Bank, COLORS, Piece, SIZES } from '../engine';
import { Pyramid } from './Pyramid';
import { colorNames, theme } from './theme';

interface Props {
  bank: Bank;
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** When set, pieces matching one of these keys are pickable. */
  pickable?: Set<string>;
  onPick?: (piece: Piece) => void;
}

/** The bank as a 4-color x 3-size grid with remaining counts. */
export function BankPanel({ bank, visible, onClose, title, pickable, onPick }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title ?? 'Bank'}</Text>
          {COLORS.map((c) => (
            <View key={c} style={styles.row}>
              <Text style={styles.colorLabel}>{colorNames[c]}</Text>
              {SIZES.map((s) => {
                const count = bank[`${c}${s}`] ?? 0;
                const piece: Piece = { color: c, size: s };
                const canPick = !!pickable?.has(`${c}${s}`) && count > 0;
                return (
                  <View key={s} style={styles.cell}>
                    <Pyramid
                      piece={piece}
                      kind="shipUp"
                      highlighted={canPick}
                      onPress={canPick && onPick ? () => onPick(piece) : undefined}
                      disabled={!canPick}
                    />
                    <Text style={[styles.count, count === 0 && { color: theme.danger }]}>
                      ×{count}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
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
    backgroundColor: theme.panel,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: { color: theme.text, fontSize: 17, fontWeight: '700', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  colorLabel: { color: theme.textDim, width: 64, fontSize: 13 },
  cell: { alignItems: 'center', width: 64 },
  count: { color: theme.textDim, fontSize: 11, marginTop: 2 },
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
