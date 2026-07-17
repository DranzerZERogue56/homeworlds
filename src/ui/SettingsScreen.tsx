import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Settings, useGameStore } from '../store/gameStore';
import { Starfield } from './Starfield';
import { theme } from './theme';

const TOGGLES: { key: keyof Settings; label: string; hint: string }[] = [
  { key: 'animations', label: 'Animations', hint: 'Pulses, slides and ship motion' },
  { key: 'evalBar', label: 'Advantage meter', hint: 'Live who’s-ahead bar during games (always shown in replays)' },
  { key: 'confirmMoves', label: 'Confirm moves', hint: 'Ask before committing every move' },
  { key: 'colorblind', label: 'Colorblind glyphs', hint: 'Letter markers on pieces (R Y G B)' },
];

export function SettingsScreen() {
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);
  const setScreen = useGameStore((s) => s.setScreen);
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        padding: 24,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 24,
      }}
    >
      <Starfield seed={5} />
      <View style={styles.headerRow}>
        <Pressable onPress={() => setScreen('menu')} hitSlop={10}>
          <Text style={styles.back}>‹ Menu</Text>
        </Pressable>
        <Text style={styles.title}>SYSTEMS CONFIG</Text>
        <View style={{ width: 52 }} />
      </View>

      {TOGGLES.map((t) => (
        <View key={t.key} style={styles.row}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.label}>{t.label}</Text>
            <Text style={styles.hint}>{t.hint}</Text>
          </View>
          <Switch
            value={settings[t.key] as boolean}
            onValueChange={(v) => setSettings({ [t.key]: v })}
            trackColor={{ false: theme.border, true: theme.accent }}
            thumbColor={theme.text}
          />
        </View>
      ))}

      <Text style={styles.footer}>
        Difficulty and first-move are chosen on the main menu before each game.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  back: { color: theme.accent, fontSize: 14, fontWeight: '600' },
  title: {
    color: theme.accent,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
    fontFamily: theme.mono,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius,
    backgroundColor: theme.panel,
    padding: 14,
    marginBottom: 10,
  },
  label: { color: theme.text, fontSize: 14, fontWeight: '700' },
  hint: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  footer: { color: theme.textDim, fontSize: 12, marginTop: 12, textAlign: 'center' },
});
