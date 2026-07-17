import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bank, Piece } from '../engine';
import { ReserveGrid } from './ReserveGrid';
import { Starfield } from './Starfield';
import { theme } from './theme';

interface Props {
  bank: Bank;
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** When set, pieces matching one of these keys are pickable. */
  pickable?: Set<string>;
  onPick?: (piece: Piece) => void;
}

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

          <ReserveGrid counts={bank} pickable={pickable} onPick={onPick} />

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
