import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Difficulty } from '../ai/ai';
import { useGameStore } from '../store/gameStore';
import { theme } from './theme';

const DIFFICULTIES: { key: Difficulty; label: string; hint: string }[] = [
  { key: 'easy', label: 'Easy', hint: 'Plays loosely — good for learning' },
  { key: 'medium', label: 'Medium', hint: 'Looks a move ahead' },
  { key: 'hard', label: 'Hard', hint: 'Searches deeper, punishes mistakes' },
];

export function MenuScreen() {
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);
  const newGame = useGameStore((s) => s.newGame);
  const game = useGameStore((s) => s.game);
  const setScreen = useGameStore((s) => s.setScreen);

  const canResume = game !== null && game.phase !== 'finished';

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Binary{'\n'}Homeworlds</Text>
      <Text style={styles.subtitle}>The Looney Pyramids space duel</Text>

      <Text style={styles.sectionLabel}>Difficulty</Text>
      <View style={styles.optionsRow}>
        {DIFFICULTIES.map((d) => (
          <Pressable
            key={d.key}
            onPress={() => setSettings({ difficulty: d.key })}
            style={[styles.option, settings.difficulty === d.key && styles.optionActive]}
          >
            <Text
              style={[
                styles.optionText,
                settings.difficulty === d.key && styles.optionTextActive,
              ]}
            >
              {d.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>
        {DIFFICULTIES.find((d) => d.key === settings.difficulty)?.hint}
      </Text>

      <Text style={styles.sectionLabel}>First move</Text>
      <View style={styles.optionsRow}>
        {[
          { v: true, label: 'You first' },
          { v: false, label: 'AI first' },
        ].map((o) => (
          <Pressable
            key={o.label}
            onPress={() => setSettings({ humanFirst: o.v })}
            style={[styles.option, settings.humanFirst === o.v && styles.optionActive]}
          >
            <Text
              style={[
                styles.optionText,
                settings.humanFirst === o.v && styles.optionTextActive,
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ height: 24 }} />

      {canResume && (
        <Pressable style={[styles.bigBtn, styles.resumeBtn]} onPress={() => setScreen('game')}>
          <Text style={styles.bigBtnText}>Resume game</Text>
        </Pressable>
      )}
      <Pressable style={styles.bigBtn} onPress={newGame}>
        <Text style={styles.bigBtnText}>{canResume ? 'New game' : 'Start game'}</Text>
      </Pressable>
      <Pressable style={[styles.bigBtn, styles.ghostBtn]} onPress={() => setScreen('rules')}>
        <Text style={[styles.bigBtnText, { color: theme.accent }]}>How to play</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg, padding: 28, paddingTop: 90 },
  title: { color: theme.text, fontSize: 40, fontWeight: '900', lineHeight: 44 },
  subtitle: { color: theme.textDim, fontSize: 14, marginTop: 6, marginBottom: 30 },
  sectionLabel: {
    color: theme.textDim,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 18,
    marginBottom: 8,
  },
  optionsRow: { flexDirection: 'row', gap: 8 },
  option: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.panel,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  optionActive: { borderColor: theme.accent, backgroundColor: theme.panelHi },
  optionText: { color: theme.textDim, fontWeight: '600' },
  optionTextActive: { color: theme.text },
  hint: { color: theme.textDim, fontSize: 12, marginTop: 6 },
  bigBtn: {
    backgroundColor: theme.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  resumeBtn: { backgroundColor: theme.ok },
  ghostBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.accent },
  bigBtnText: { color: '#0b1020', fontSize: 16, fontWeight: '800' },
});
